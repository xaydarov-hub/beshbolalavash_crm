import crypto from 'node:crypto';
import { calculateCommission, TRASH_RETENTION_MS, restoreAllowed } from '../src/lib/salaryEntries.js';

const fail = (message, status = 400) => { throw Object.assign(new Error(message), { status }); };
const validId = id => typeof id === 'string' && /^[\w-]{1,128}$/.test(id);
const stamp = now => new Date(now).toISOString();
const canManage = (session, branchId) => session.role === 'boss' || (session.role === 'admin' && session.branchId && session.branchId === branchId);
function authorize(session, branchId) {
  if (!canManage(session, branchId)) fail('Faqat o‘z filialingizning maosh yozuvlarini boshqarishingiz mumkin.', 403);
}
function audit(state, session, action, branchId, employeeId, now) {
  return [{ id: crypto.randomUUID(), actorId: session.id, actor: session.name, branchId, ...(employeeId ? { employeeId } : {}), action, at: stamp(now) }, ...(state.auditLog || [])];
}
function changed(state, updates) { return { ...state, ...updates, revision: (state.revision || 0) + 1 }; }
const businessDate = now => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tashkent', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(now));

export function saveSalaryEntry(state, session, input, now = Date.now()) {
  if (!validId(input.id)) fail('Yozuv identifikatori kerak. Formani qayta oching.');
  if (!['boss', 'admin'].includes(session.role)) fail('Maosh kiritish huquqi yo‘q.', 403);
  const existing = (state.salaryEntries || []).find(entry => entry.id === input.id);
  if (existing) {
    authorize(session, existing.branchId);
    if (existing.employeeId === input.employeeId && existing.rawAmount === input.rawAmount && existing.note === String(input.note || '').trim() && existing.actorId === session.id) return state;
    fail('Bu identifikator boshqa maosh yozuviga tegishli.', 409);
  }
  const employee = state.users.find(user => user.id === input.employeeId && user.role === 'employee' && user.active !== false);
  if (!employee) fail('Faol xodim topilmadi.', 404);
  authorize(session, employee.branchId);
  if (!state.branches.some(branch => branch.id === employee.branchId)) fail('Xodim filiali topilmadi.');
  if (employee.salaryType !== 'foiz') fail('Xodimning maosh turi foizli emas.');
  if (typeof input.rawAmount !== 'number' || !Number.isFinite(input.rawAmount) || input.rawAmount < 0 || input.rawAmount > 1e12) fail('Summa 0–1 000 000 000 000 oralig‘idagi son bo‘lsin.');
  const rate = Number(employee.rate);
  if (typeof input.expectedRate !== 'number' || input.expectedRate !== rate) fail('Xodimning foiz stavkasi yangilandi. Ma’lumotlarni yangilab qayta saqlang.', 409);
  if (input.note !== undefined && (typeof input.note !== 'string' || input.note.length > 2000)) fail('Izoh 2000 belgidan oshmasin.');
  const entry = { id: input.id, employeeId: employee.id, employeeName: employee.name, branchId: employee.branchId,
    rawAmount: input.rawAmount, rate, calculatedAmount: calculateCommission(input.rawAmount, rate),
    date: businessDate(now), createdAt: stamp(now), updatedAt: stamp(now), by: session.name, actorId: session.id,
    note: (input.note || '').trim(), isSettled: false, isDeleted: false, status: 'active', restoreAllowed: false };
  return changed(state, { salaryEntries: [entry, ...(state.salaryEntries || [])], auditLog: audit(state, session, `${employee.name}: maosh yozuvi yaratildi (${entry.calculatedAmount} so‘m).`, employee.branchId, employee.id, now) });
}

export function settle15DayCycle(state, session, input, now = Date.now()) {
  authorize(session, input.branchId);
  if (!state.branches.some(branch => branch.id === input.branchId)) fail('Filial topilmadi.');
  if (!validId(input.id) || !Array.isArray(input.entryIds) || !input.entryIds.length || !input.entryIds.every(validId) || new Set(input.entryIds).size !== input.entryIds.length) fail('Yakunlanadigan yozuvlar ro‘yxati noto‘g‘ri.');
  const existing = (state.salarySettlements || []).find(row => row.id === input.id);
  const sameIds = (a, b) => { const ids = new Set(b); return a.length === b.length && a.every(id => ids.has(id)); };
  if (existing) {
    if (existing.branchId === input.branchId && sameIds(existing.entryIds, input.entryIds)) return state;
    fail('Yakunlash identifikatori band.', 409);
  }
  const entries = (state.salaryEntries || []).filter(entry => entry.branchId === input.branchId && !entry.isSettled && !entry.isDeleted);
  if (!sameIds(entries.map(entry => entry.id), input.entryIds)) fail('Ochiq hisoblar o‘zgardi. Ma’lumotlarni yangilab, jami summani qayta tekshiring.', 409);
  const employees = new Map();
  for (const entry of entries) {
    if (!Number.isFinite(entry.calculatedAmount) || entry.calculatedAmount < 0) fail('Eski yozuv summasi noto‘g‘ri. Boshliq bilan tekshiring.');
    const record = employees.get(entry.employeeId) || { employeeId: entry.employeeId, employeeName: entry.employeeName, total: 0, count: 0 };
    record.total += entry.calculatedAmount; record.count += 1; employees.set(entry.employeeId, record);
  }
  const settlement = { id: input.id, branchId: input.branchId, entryIds: entries.map(entry => entry.id), total: entries.reduce((sum, entry) => sum + entry.calculatedAmount, 0), employees: [...employees.values()],
    settledAt: stamp(now), settlementPeriod: '15-day', period: 15, by: session.name, actorId: session.id };
  const ids = new Set(settlement.entryIds);
  return changed(state, {
    salaryEntries: state.salaryEntries.map(entry => ids.has(entry.id) ? { ...entry, isSettled: true, settledAt: settlement.settledAt, settlementPeriod: '15-day', period: 15, settlementId: settlement.id, updatedAt: stamp(Math.max(now, (Date.parse(entry.updatedAt) || 0) + 1)) } : entry),
    salarySettlements: [settlement, ...(state.salarySettlements || [])],
    auditLog: audit(state, session, `15 kunlik hisob yakunlandi: ${entries.length} yozuv, ${settlement.total} so‘m.`, input.branchId, null, now),
  });
}

export function moveToTrash(state, session, id, input, now = Date.now()) {
  const entry = (state.salaryEntries || []).find(row => row.id === id);
  if (!entry) fail('Maosh yozuvi topilmadi.', 404);
  authorize(session, entry.branchId);
  if (entry.isDeleted) return state;
  if (!input.expectedUpdatedAt || input.expectedUpdatedAt !== (entry.updatedAt || entry.createdAt)) fail('Yozuv yangilandi. Ro‘yxatni yangilab qayta urinib ko‘ring.', 409);
  const deletion = { isDeleted: true, status: 'trash', deletedAt: stamp(now), expiresAt: stamp(now + TRASH_RETENTION_MS), restoreAllowed: true };
  const trash = { id: crypto.randomUUID(), source: 'salaryEntries', recordId: id, employeeId: entry.employeeId, branchId: entry.branchId, ...deletion, deletedBy: session.name };
  return changed(state, { salaryEntries: state.salaryEntries.map(row => row.id === id ? { ...row, ...deletion, updatedAt: stamp(Math.max(now, (Date.parse(entry.updatedAt) || 0) + 1)) } : row),
    trash: [trash, ...(state.trash || []).filter(row => !(row.source === 'salaryEntries' && row.recordId === id))],
    auditLog: audit(state, session, `${entry.employeeName}: maosh yozuvi 30 kunlik korzinkaga ko‘chirildi.`, entry.branchId, entry.employeeId, now) });
}

export function restoreFromTrashIfStillValid(state, session, id, input, now = Date.now()) {
  const entry = (state.salaryEntries || []).find(row => row.id === id);
  if (!entry) fail('Yozuv topilmadi yoki 30 kunlik tiklash muddati tugagan.', 410);
  authorize(session, entry.branchId);
  if (!entry.isDeleted) {
    if (entry.restoredFromDeletedAt === input.expectedDeletedAt) return state;
    fail('Bu yozuv korzinkada emas.', 409);
  }
  if (!restoreAllowed(entry, now)) fail('30 kunlik tiklash muddati tugagan. Yozuvni qaytarib bo‘lmaydi.', 410);
  if (!input.expectedDeletedAt || input.expectedDeletedAt !== entry.deletedAt) fail('Korzinka yozuvi yangilandi. Ro‘yxatni yangilang.', 409);
  return changed(state, { salaryEntries: state.salaryEntries.map(row => {
    if (row.id !== id) return row;
    const { deletedAt, expiresAt, ...record } = row;
    return { ...record, isDeleted: false, status: 'active', restoreAllowed: false, restoredAt: stamp(now), restoredFromDeletedAt: deletedAt, updatedAt: stamp(Math.max(now, (Date.parse(row.updatedAt) || 0) + 1)) };
  }), trash: (state.trash || []).filter(row => !(row.source === 'salaryEntries' && row.recordId === id)),
  auditLog: audit(state, session, `${entry.employeeName}: maosh yozuvi korzinkadan qaytarildi.`, entry.branchId, entry.employeeId, now) });
}
export const restoreDeletedEntry = restoreFromTrashIfStillValid;

export function purgeExpiredTrash(state, now = Date.now()) {
  const expired = new Set((state.salaryEntries || []).filter(row => row.isDeleted && Number.isFinite(Date.parse(row.expiresAt)) && Date.parse(row.expiresAt) <= now).map(row => row.id));
  const trash = (state.trash || []).filter(row => row.source !== 'salaryEntries' || (!expired.has(row.recordId) && !(Number.isFinite(Date.parse(row.expiresAt)) && Date.parse(row.expiresAt) <= now)));
  if (!expired.size && trash.length === (state.trash || []).length) return state;
  return changed(state, { salaryEntries: (state.salaryEntries || []).filter(row => !expired.has(row.id)), trash });
}

export function visibleSalaryState(state, session, now = Date.now()) {
  const visible = row => session.role === 'boss' || (session.role === 'admin' ? Boolean(session.branchId) && row.branchId === session.branchId : row.employeeId === session.id);
  const salaryEntries = (state.salaryEntries || []).filter(row => visible(row) && (!row.isDeleted || restoreAllowed(row, now))).map(row => ({ ...row, restoreAllowed: restoreAllowed(row, now) }));
  const ids = new Set(salaryEntries.map(row => row.id));
  const trash = (state.trash || []).filter(row => row.source === 'salaryEntries' && visible(row) && ids.has(row.recordId));
  const salarySettlements = (state.salarySettlements || []).filter(row => session.role === 'employee' ? row.employees.some(employee => employee.employeeId === session.id) : visible(row)).map(row => {
    if (session.role !== 'employee') return row;
    const employees = row.employees.filter(employee => employee.employeeId === session.id);
    return { ...row, employees, entryIds: row.entryIds.filter(id => ids.has(id)), total: employees.reduce((sum, employee) => sum + employee.total, 0) };
  });
  return { salaryEntries, salarySettlements, trash, salaryEntryApiVersion: 1 };
}

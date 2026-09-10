import { uid, todayISO } from '../src/lib/utils.js';
export function applySale(state, session, input) {
  const employee = state.users.find(u => u.id === input.employeeId && u.role === 'employee' && u.active !== false);
  const fail = (message, status = 400) => { throw Object.assign(new Error(message), { status }); };
  if (!employee || !['boss', 'admin'].includes(session.role) || (session.role === 'admin' && employee.branchId !== session.branchId)) fail('Bu xodim savdosini kiritish huquqi yo‘q.', 403);
  const { date, amount } = input;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '') || !Number.isFinite(Date.parse(date)) || new Date(date).toISOString().slice(0,10) !== date || date > todayISO()) fail('To‘g‘ri sana kiriting. Kelajak uchun savdo yozilmaydi.');
  if (typeof amount !== 'number' || !Number.isSafeInteger(amount) || amount < 0 || amount > 1e12) fail('Savdo 0 dan 1 000 000 000 000 so‘mgacha butun son bo‘lishi kerak.');
  const records = state.dailySales || [];
  const existing = records.find(r => r.employeeId === employee.id && r.date === date);
  if ((existing?.updatedAt ?? null) !== (input.expectedUpdatedAt ?? null)) fail('Bu savdo boshqa qurilmada o‘zgardi. Sahifani yangilab qayta kiriting.', 409);
  if (!existing && employee.salaryType !== 'foiz') fail('Xodimning maosh turi foizli emas.');
  const rate = Number(existing?.rate ?? employee.rate);
  if (!Number.isFinite(rate) || rate < 0 || rate > 100) fail('Foiz stavkasi 0–100 oralig‘ida bo‘lishi kerak.');
  const updatedAt = new Date(Math.max(Date.now(), (Date.parse(existing?.updatedAt) || 0) + 1)).toISOString();
  const record = { id: existing?.id || uid(), employeeId: employee.id, branchId: employee.branchId, date, amount, rate, note: String(input.note || '').slice(0,500), by: session.name, updatedAt, revisions: existing ? [...(existing.revisions || []), { amount: existing.amount, rate: existing.rate, note: existing.note, by: existing.by, updatedAt: existing.updatedAt }] : [] };
  return { ...state, dailySales: [...records.filter(r => r.id !== record.id), record], auditLog: [{ id: uid(), employeeId: employee.id, at: record.updatedAt, actor: session.name, action: `${employee.name}: ${date} savdo ${amount} so‘m, ${rate}%, ish haqi ${Math.round(amount * rate / 100)} so‘m.` }, ...(state.auditLog || [])] };
}

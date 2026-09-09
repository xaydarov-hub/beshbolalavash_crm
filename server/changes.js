import { isDeepStrictEqual } from 'node:util';
import { EDITABLE_COLLECTIONS } from '../src/lib/changes.js';

export function applyChanges(visible, changes, session) {
  const fail = (message, status = 400) => { throw Object.assign(new Error(message), { status }); };
  if (!Array.isArray(changes) || changes.length > 1000) fail('O‘zgarishlar noto‘g‘ri.');
  const allowed = session.role === 'boss' ? EDITABLE_COLLECTIONS : session.role === 'admin' ? ['attendance', 'evaluations', 'transfers', 'users', 'auditLog'] : ['leaveRequests'];
  const next = { ...visible };
  for (const change of changes) {
    if (!change || typeof change !== 'object') fail('O‘zgarish formati noto‘g‘ri.');
    const { collection, id, before, after } = change;
    if (!allowed.includes(collection)) fail('Bu ma’lumotni o‘zgartirish huquqi yo‘q.', 403);
    if (typeof id !== 'string' || !id || id.length > 128 || (after !== null && (!after || after.id !== id))) fail('Yozuv identifikatori noto‘g‘ri.');
    const rows = next[collection] || [];
    const existing = rows.find(row => row.id === id) || null;
    if (!isDeepStrictEqual(existing, before)) fail('Aynan shu yozuv boshqa qurilmada o‘zgardi. Yangilab qayta urinib ko‘ring.', 409);
    if (session.role === 'admin') {
      if (collection === 'users') {
        // An admin can only transfer an existing employee, with a matching transfer record.
        if (!existing || !after || !isDeepStrictEqual({ ...existing, branchId: after.branchId }, after) || existing.role !== 'employee' || existing.branchId !== session.branchId || !changes.some(c => c.collection === 'transfers' && c.after?.employeeId === id && c.after?.toBranchId === after.branchId)) fail('Faqat filialni ko‘chirish mumkin.', 403);
      } else if (collection === 'auditLog') {
        if (existing || !after) fail('Tarixni o‘zgartirish mumkin emas.', 403);
      } else if (![before, after].filter(Boolean).every(row => visible.users.some(user => user.id === row.employeeId && user.branchId === session.branchId))) fail('Boshqa filial yozuvini o‘zgartirish mumkin emas.', 403);
    }
    if (session.role === 'employee' && (existing || !after || after.employeeId !== session.id || after.status !== 'kutilmoqda')) fail('Faqat o‘zingiz uchun yangi ta’til so‘rovi yuborishingiz mumkin.', 403);
    if (after && ['attendance', 'evaluations'].includes(collection) && rows.some(row => row.id !== id && row.employeeId === after.employeeId && row.date === after.date)) fail('Bu sana uchun yozuv allaqachon mavjud. Yangilab qayta urinib ko‘ring.', 409);
    next[collection] = after ? [...rows.filter(row => row.id !== id), after] : rows.filter(row => row.id !== id);
  }
  return next;
}

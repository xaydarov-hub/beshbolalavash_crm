import { isDeepStrictEqual } from 'node:util';
import { uid } from '../src/lib/utils.js';

export function eraseAccount(state, employeeId) {
  const next = { ...state, users: state.users.filter(u => u.id !== employeeId) };
  for (const key of ['attendance', 'adjustments', 'evaluations', 'leaveRequests', 'transfers', 'dailySales', 'notifications']) {
    next[key] = (state[key] || []).filter(row => row.employeeId !== employeeId);
  }
  next.sales = Object.fromEntries(Object.entries(state.sales || {}).filter(([key]) => !key.startsWith(`${employeeId}:`)));
  next.payrollHistory = (state.payrollHistory || []).map(record => {
    if (!(record.employees || []).some(row => row.employeeId === employeeId)) return record;
    const employees = record.employees.filter(row => row.employeeId !== employeeId);
    return { ...record, employees, total: employees.reduce((sum, row) => sum + (Number(row.total) || 0), 0) };
  }).filter(record => record.employees?.length);
  return next;
}

export function deleteAccount(state, session, id, expectedUser, visibleUser) {
  const fail = (message, status) => { throw Object.assign(new Error(message), { status }); };
  if (session.role !== 'boss') fail('Hisobni faqat boshliq o‘chira oladi.', 403);
  const user = state.users.find(row => row.id === id);
  if (!user) return state; // Safe to retry when a response was lost.
  if (id === session.id || user.role === 'boss') fail('Boshliq hisobini o‘chirish mumkin emas.', 403);
  if (!expectedUser || !isDeepStrictEqual(expectedUser, visibleUser)) fail('Profil yangilangan. Uni qayta ochib o‘chiring.', 409);
  return { ...eraseAccount(state, id), auditLog: [{ id: uid(), employeeId: id, at: new Date().toISOString(), actor: session.name, action: `${user.name}: hisob va unga bog‘liq yozuvlar butunlay o‘chirildi.` }, ...(state.auditLog || [])] };
}

export function removeLegacyDemoAccounts(state) {
  // Match both the old seed ID and login. A real employee reusing a seed ID is preserved.
  const ids = state.users.filter(u => (u.id === 'admin-1' && u.phone === 'admin.local' && u.role === 'admin') || (u.id === 'employee-1' && u.phone === 'employee.local' && u.role === 'employee')).map(u => u.id);
  if (!ids.length) return state;
  const cleaned = ids.reduce(eraseAccount, state);
  return { ...cleaned, revision: (state.revision || 0) + 1, auditLog: [{ id: uid(), at: new Date().toISOString(), actor: 'System', action: `${ids.length} ta eski demo hisob tozalandi.` }, ...(state.auditLog || [])] };
}

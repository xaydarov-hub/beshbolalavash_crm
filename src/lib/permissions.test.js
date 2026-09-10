import { it, expect } from 'vitest';
import { publicState, mergeScopedState } from '../../server/index.js';
const users = [{ id: 'a', name: 'Admin', role: 'admin', branchId: 'b' }, { id: 'e', role: 'employee', branchId: 'b', passwordHash: 'hidden' }, { id: 'f', role: 'employee', branchId: 'c' }];
const records = [{ employeeId: 'e' }, { employeeId: 'f' }];
const state = { users, branches: [{ id: 'b' }, { id: 'c' }], attendance: records, evaluations: records, adjustments: records, leaveRequests: records, transfers: [], dailySales: records, sales: { 'e:2026-01': 100, 'f:2026-01': 200 }, auditLog: records, notifications: [], payrollHistory: [{ employees: [{ employeeId: 'e', total: 7 }, { employeeId: 'f', total: 14 }], total: 21 }] };
it('employee sees only own pay, sales, history and no passwords', () => {
  const visible = publicState(state, users[1]);
  expect(visible.users).toHaveLength(1); expect(visible.users[0].passwordHash).toBeUndefined();
  expect(visible.dailySales).toEqual([{ employeeId: 'e' }]);
  expect(visible.sales).toEqual({ 'e:2026-01': 100 });
  expect(visible.payrollHistory[0].total).toBe(7);
});
it('admin sees only own branch while boss sees all sales', () => {
  for (const session of [users[0], { role: 'boss' }]) {
    expect(publicState(state, session).users.every(user => !user.passwordHash)).toBe(true);
  }
  expect(publicState(state, users[0]).dailySales).toEqual([{ employeeId: 'e' }]);
  expect(publicState(state, { role: 'boss' }).dailySales).toHaveLength(2);
});
it('generic state updates cannot bypass the daily sales endpoint', async () => {
  for (const user of [...users, { role: 'boss' }]) {
    const result = await mergeScopedState(state, { ...state, dailySales: [], sales: {} }, user);
    expect(result.dailySales).toEqual(records); expect(result.sales).toEqual(state.sales);
  }
});

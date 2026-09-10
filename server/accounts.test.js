import { it, expect } from 'vitest';
import { deleteAccount, eraseAccount, removeLegacyDemoAccounts } from './accounts.js';
import { validateChanges } from './validation.js';

const boss = { id: 'boss', role: 'boss', name: 'Boss' };
const employee = { id: 'e', role: 'employee', name: 'Employee', branchId: 'missing' };
const state = { users: [boss, employee, { id: 'other', role: 'employee' }], branches: [], attendance: [{ employeeId: 'e' }, { employeeId: 'other' }], adjustments: [{ employeeId: 'e' }], evaluations: [{ employeeId: 'e' }], leaveRequests: [{ employeeId: 'e' }], transfers: [{ employeeId: 'e', fromBranchId: 'missing' }], dailySales: [{ employeeId: 'e' }], notifications: [{ employeeId: 'e' }], sales: { 'e:2026-01': 10, 'other:2026-01': 20 }, payrollHistory: [{ id: 'pay', employees: [{ employeeId: 'e', total: 7 }, { employeeId: 'other', total: 14 }], total: 21 }], auditLog: [] };

it('deletes an orphaned account and linked records while preserving other staff and audit', () => {
  const next = deleteAccount(state, boss, 'e', employee, employee);
  expect(next.users.some(u => u.id === 'e')).toBe(false);
  for (const key of ['attendance', 'adjustments', 'evaluations', 'leaveRequests', 'transfers', 'dailySales', 'notifications']) expect(next[key].some(r => r.employeeId === 'e')).toBe(false);
  expect(next.attendance).toEqual([{ employeeId: 'other' }]);
  expect(next.sales).toEqual({ 'other:2026-01': 20 });
  expect(next.payrollHistory[0].total).toBe(14);
  expect(next.auditLog[0].actor).toBe('Boss');
  expect(state.users).toHaveLength(3);
});
it('protects boss accounts, rejects admin deletes and stale profiles, and allows retry', () => {
  expect(() => deleteAccount(state, boss, boss.id, boss, boss)).toThrow(/Boshliq/);
  expect(() => deleteAccount(state, { role: 'admin' }, 'e', employee, employee)).toThrow(/faqat boshliq/);
  expect(() => deleteAccount(state, boss, 'e', { ...employee, name: 'Old' }, employee)).toThrow(/yangilangan/);
  const next = eraseAccount(state, 'e');
  expect(deleteAccount(next, boss, 'e', employee, undefined)).toBe(next);
});
it('removes only untouched legacy seed identities, including their orphaned records', () => {
  const input = { ...state, users: [boss, { id: 'admin-1', phone: 'admin.local', role: 'admin', branchId: 'deleted' }, { id: 'employee-1', phone: '956604409', role: 'employee' }, { id: 'custom-admin', phone: 'admin.local', role: 'admin' }], attendance: [{ employeeId: 'admin-1' }, { employeeId: 'employee-1' }] };
  const cleaned = removeLegacyDemoAccounts(input);
  expect(cleaned.users.map(u => u.id)).toEqual(['boss', 'employee-1', 'custom-admin']);
  expect(cleaned.attendance).toEqual([{ employeeId: 'employee-1' }]);
  expect(removeLegacyDemoAccounts(cleaned)).toBe(cleaned);
});
it('archives an old malformed account without requiring its deleted branch, but refuses activation', () => {
  const archived = { ...employee, active: false, endDate: '2026-09-10' };
  expect(() => validateChanges(state, { ...state, users: [boss, archived] }, [{ collection: 'users', before: employee, after: archived }], boss)).not.toThrow();
  expect(() => validateChanges(state, state, [{ collection: 'users', before: archived, after: { ...archived, active: true } }], boss)).toThrow();
});

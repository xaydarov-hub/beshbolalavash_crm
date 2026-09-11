import { describe, it, expect } from 'vitest';
import { publicState, mergeScopedState } from './index.js';
import { applyChanges } from './changes.js';
import { validateChanges } from './validation.js';
import { applyWorkflowEffects } from './workflows.js';
import { stateChanges } from '../src/lib/changes.js';
import { getJobRole, dashboardPath } from '../src/lib/roles.js';

const profile = (id, role, branchId) => ({ id, role, jobRole: role === 'employee' ? 'waiter' : role, branchId, name: id, phone: id, position: role === 'employee' ? 'Ofitsiant' : 'Admin', workStart: '08:00', workEnd: '17:00', salaryType: 'kunlik', rate: 100000, hireDate: '2026-01-01', passwordHash: 'scrypt:existing', authVersion: 0 });
const boss = profile('boss', 'boss', null), admin = profile('admin', 'admin', 'b1');
const waiter = profile('waiter', 'employee', 'b1'), other = profile('other', 'employee', 'b2');
function fixture() {
  return { users: [boss, admin, waiter, other], branches: [{ id: 'b1', name: 'One' }, { id: 'b2', name: 'Two' }], attendance: [], adjustments: [], evaluations: [], transfers: [], leaveRequests: [], payrollHistory: [], auditLog: [], notifications: [], dailySales: [], sales: {} };
}
async function transaction(current, session, update) {
  const visible = publicState(current, session);
  const changes = stateChanges(visible, update(visible));
  const next = applyChanges(visible, changes, session);
  validateChanges(current, next, changes, session);
  return applyWorkflowEffects(current, await mergeScopedState(current, next, session), changes, session);
}

describe('branch employee management', () => {
  it('saves a waiter created by admin with employee access, hashed password and global visibility', async () => {
    const newUser = { ...profile('new', 'employee', 'b1'), passwordHash: undefined, authVersion: undefined, customPassword: 'new-password' };
    const saved = await transaction(fixture(), admin, state => ({ ...state, users: [...state.users, newUser] }));
    const user = saved.users.find(row => row.id === 'new');
    expect(user).toMatchObject({ role: 'employee', jobRole: 'waiter', branchId: 'b1' });
    expect(user.passwordHash).toMatch(/^scrypt:/);
    expect(user.customPassword).toBeUndefined();
    expect(dashboardPath(user)).toBe('/employee/waiter');
    expect(publicState(saved, boss).users.some(row => row.id === 'new')).toBe(true);
    expect(publicState(saved, admin).users.some(row => row.id === 'new')).toBe(true);
    expect(publicState(saved, other).users.some(row => row.id === 'new')).toBe(false);
  });
  it('denies admin privilege creation, cross-branch creation and hidden login/id collisions', async () => {
    for (const patch of [{ role: 'admin', jobRole: 'admin' }, { branchId: 'b2' }, { phone: other.phone }, { id: other.id }]) {
      const newUser = { ...profile('new', 'employee', 'b1'), passwordHash: undefined, authVersion: undefined, customPassword: 'new-password', ...patch };
      await expect(transaction(fixture(), admin, state => ({ ...state, users: [...state.users, newUser] }))).rejects.toThrow();
    }
  });
  it('rejects inconsistent access/job role and invalidates old sessions on demotion and archive/restore', async () => {
    await expect(transaction(fixture(), boss, state => ({ ...state, users: state.users.map(user => user.id === waiter.id ? { ...user, role: 'admin' } : user) }))).rejects.toThrow(/mos emas/);
    const demoted = await transaction(fixture(), boss, state => ({ ...state, users: state.users.map(user => user.id === admin.id ? { ...user, role: 'employee', jobRole: 'waiter', position: 'Ofitsiant' } : user) }));
    expect(demoted.users.find(user => user.id === admin.id).authVersion).toBe(1);
    const archived = await transaction(fixture(), admin, state => ({ ...state, users: state.users.map(user => user.id === waiter.id ? { ...user, active: false, endDate: '2026-09-01' } : user) }));
    const restored = await transaction(archived, admin, state => ({ ...state, users: state.users.map(user => user.id === waiter.id ? { ...user, active: true, endDate: '' } : user) }));
    expect(restored.users.find(user => user.id === waiter.id).authVersion).toBe(2);
    expect(restored.users.find(user => user.id === waiter.id).passwordHash).toBe(waiter.passwordHash);
  });
  it('keeps legacy admin rights explicit and derives employee job from old position', () => {
    expect(getJobRole({ role: 'admin', position: 'Ofitsiant' })).toBe('admin');
    expect(getJobRole({ role: 'employee', position: 'Oshpaz' })).toBe('cook');
    expect(dashboardPath({ role: 'unknown', position: 'Admin' })).toBe('/login');
  });
});

describe('atomic branch operations', () => {
  it('applies leave attendance without client-supplied attendance and preserves a worked day', async () => {
    const state = fixture();
    state.attendance = [{ id: 'work', employeeId: waiter.id, date: '2026-01-10', status: 'keldi', checkIn: '08:00', checkOut: '17:00' }];
    state.leaveRequests = [{ id: 'leave', employeeId: waiter.id, from: '2026-01-10', to: '2026-01-12', type: 'tatil', reason: 'Oilaviy sabab', status: 'kutilmoqda' }];
    const saved = await transaction(state, admin, visible => ({ ...visible, leaveRequests: visible.leaveRequests.map(row => ({ ...row, status: 'tasdiqlandi' })) }));
    expect(saved.attendance).toHaveLength(3);
    expect(saved.attendance.find(row => row.date === '2026-01-10').status).toBe('keldi');
    expect(saved.attendance.filter(row => row.status === 'tatil')).toHaveLength(2);
    expect(saved.leaveRequests[0].decidedBy).toBe(admin.name);
  });
  it('records transfer and moves employee atomically without requiring a second user edit', async () => {
    const state = fixture();
    const saved = await transaction(state, admin, visible => ({ ...visible, transfers: [{ id: 'transfer', employeeId: waiter.id, fromBranchId: 'b1', toBranchId: 'b2', effectiveDate: '2026-01-12' }] }));
    expect(saved.users.find(user => user.id === waiter.id).branchId).toBe('b2');
    expect(publicState(saved, admin).users.some(user => user.id === waiter.id)).toBe(false);
    const targetAdmin = { ...admin, id: 'target-admin', branchId: 'b2' };
    expect(publicState({ ...saved, users: [...saved.users, targetAdmin] }, targetAdmin).users.some(user => user.id === waiter.id)).toBe(true);
    await expect(transaction(saved, boss, visible => ({ ...visible, transfers: [] }))).rejects.toThrow(/tarix/);
  });
  it('recalculates branch payroll totals and preserves cross-branch snapshot rows', async () => {
    const state = fixture();
    state.attendance = [{ id: 'work', employeeId: waiter.id, date: '2026-01-10', status: 'keldi', checkIn: '08:00', checkOut: '17:00' }];
    state.payrollHistory = [{ id: 'all-branches', month: '2025-12', branchId: 'all', employees: [{ employeeId: waiter.id, total: 1 }, { employeeId: other.id, total: 2 }], total: 3 }];
    const saved = await transaction(state, admin, visible => ({ ...visible, payrollHistory: [...visible.payrollHistory, { id: 'report', month: '2026-01', branchId: 'all', employees: [{ employeeId: waiter.id, total: 9999999 }], total: 9999999 }] }));
    expect(saved.payrollHistory[0]).toEqual(state.payrollHistory[0]);
    expect(saved.payrollHistory[1]).toMatchObject({ total: 100000, branchId: 'b1', savedBy: admin.name });
    expect(saved.payrollHistory[1].employees[0].total).toBe(100000);
  });
  it('does not expose targeted notifications to another user of the same role', () => {
    const state = { ...fixture(), notifications: [{ id: 'private', employeeId: other.id, forRole: 'employee', text: 'Private' }, { id: 'branch', forRole: 'admin', branchId: 'b2', text: 'Branch two' }, { id: 'all', text: 'All staff' }] };
    expect(publicState(state, waiter).notifications.map(row => row.id)).toEqual(['all']);
    expect(publicState(state, admin).notifications.map(row => row.id)).toEqual(['all']);
  });
});

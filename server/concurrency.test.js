import { it, expect } from 'vitest';
import { createStore } from './store.js';
import { applyChanges } from './changes.js';
import { stateChanges } from '../src/lib/changes.js';

it('publishes only durable writes and leaves reads independent of pending disk IO', async () => {
  let finish;
  const store = createStore({ n: 0 }, () => new Promise(resolve => { finish = resolve; }));
  const pending = store.update(() => ({ n: 1 }));
  await Promise.resolve(); await Promise.resolve();
  expect(store.get().n).toBe(0);
  finish(); await pending;
  expect(store.get().n).toBe(1);
});
it('does not lose simultaneous updates or publish failed writes', async () => {
  let reject = true;
  const store = createStore({ n: 0 }, async () => { if (reject) { reject = false; throw new Error('disk failed'); } });
  await expect(store.update(s => ({ n: s.n + 1 }))).rejects.toThrow('disk failed');
  expect(store.get().n).toBe(0);
  await Promise.all(Array.from({ length: 15 }, () => store.update(s => ({ n: s.n + 1 }))));
  expect(store.get().n).toBe(15);
});
const admin = { id: 'a', role: 'admin', branchId: 'b' };
const initial = { users: [{ id: 'e1', role: 'employee', branchId: 'b' }, { id: 'e2', role: 'employee', branchId: 'b' }], attendance: [{ id: 'r1', employeeId: 'e1', date: '2026-01-01', status: 'kelmadi' }, { id: 'r2', employeeId: 'e2', date: '2026-01-01', status: 'kelmadi' }] };
it('merges independent stale edits while rejecting conflicts on the same record', () => {
  const next1 = { ...initial, attendance: initial.attendance.map(r => r.id === 'r1' ? { ...r, status: 'keldi' } : r) };
  const next2 = { ...initial, attendance: initial.attendance.map(r => r.id === 'r2' ? { ...r, status: 'keldi' } : r) };
  const merged = applyChanges(applyChanges(initial, stateChanges(initial, next1), admin), stateChanges(initial, next2), admin);
  expect(merged.attendance.every(r => r.status === 'keldi')).toBe(true);
  expect(() => applyChanges(merged, stateChanges(initial, next1), admin)).toThrow(/boshqa qurilmada/);
});
it('rejects unauthorized patches and duplicate daily attendance', () => {
  expect(() => applyChanges(initial, [{ collection: 'sales', id: 'bad', before: null, after: { id: 'bad' } }], admin)).toThrow();
  expect(() => applyChanges(initial, [{ collection: 'attendance', id: 'bad', before: null, after: { id: 'bad', employeeId: 'e1', date: '2026-01-01' } }], admin)).toThrow(/allaqachon/);
});

// Real HTTP workflows, isolated from all user and production data.
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { stateChanges } from '../src/lib/changes.js';
import { emptyScores } from '../src/lib/evaluation.js';
import { computeEmployeeReport } from '../src/lib/salary.js';

const folder = await mkdtemp(join(tmpdir(), 'crm-workflow-'));
const dbPath = join(folder, 'db.json');
const user = (id, role, branchId, phone = id) => ({ id, name: id, role, branchId, phone, customPassword: 'test-password', salaryType: 'foiz', rate: 7, workStart: '08:00', workEnd: '17:00', hireDate: '2026-01-01', position: 'Test' });
await writeFile(dbPath, JSON.stringify({
  users: [user('boss', 'boss', null), user('admin1', 'admin', 'b1'), user('admin2', 'admin', 'b2'), user('admin-1', 'admin', 'deleted-branch', 'admin.local')],
  branches: [{ id: 'b1', name: 'Branch one' }, { id: 'b2', name: 'Branch two' }],
  attendance: [], adjustments: [], evaluations: [], transfers: [], leaveRequests: [], auditLog: [], notifications: [], sales: {}, dailySales: [], payrollHistory: [], revision: 0
}));
let child, base;
async function start() {
  child = spawn(process.execPath, ['server/index.js'], { env: { ...process.env, NODE_ENV: 'production', PORT: '0', DB_PATH: dbPath, JWT_SECRET: '', JWT_SECRET_FILE: join(folder, '.jwt-secret') }, stdio: ['ignore', 'pipe', 'pipe'] });
  let errors = '';
  child.stderr.on('data', data => { errors += data; });
  base = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Startup timeout: ' + errors)), 15000);
    child.stdout.on('data', data => { const match = String(data).match(/http:\/\/localhost:\d+/); if (match) { clearTimeout(timer); resolve(match[0]); } });
    child.once('exit', code => { clearTimeout(timer); reject(new Error('Startup failed ' + code + ': ' + errors)); });
  });
}
async function stop() { if (child && child.exitCode === null) { child.kill(); await once(child, 'exit'); } }
async function call(path, token, method = 'GET', body, status = 200) {
  const res = await fetch(base + path, { method, signal: AbortSignal.timeout(15000), headers: { ...(token ? { Authorization: 'Bearer ' + token } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
  const data = await res.json();
  assert.equal(res.status, status, method + ' ' + path + ': ' + JSON.stringify(data.message));
  return data;
}
const login = (phone, pass = 'test-password', status = 200) => call('/api/login', null, 'POST', { phone, pass }, status);
async function patch(token, update, status = 200) {
  const { state } = await call('/api/state', token);
  return call('/api/state', token, 'PATCH', { changes: stateChanges(state, update(state)) }, status);
}
try {
  await start();
  const boss = await login('boss'), admin1 = await login('admin1'), admin2 = await login('admin2');
  await login('admin.local', 'test-password', 401);
  const employee = user('employee', 'employee', 'b1', '956604409');
  await patch(boss.token, s => ({ ...s, users: [...s.users, { ...employee, branchId: 'missing' }] }), 400);
  await patch(boss.token, s => ({ ...s, users: [...s.users, employee] }));
  await patch(boss.token, s => ({ ...s, users: [...s.users, { ...employee, id: 'duplicate', phone: '+998956604409' }] }), 400);
  const ownBranch = await call('/api/state', admin1.token);
  assert.ok(ownBranch.state.users.some(u => u.id === employee.id), 'new employee visible to existing admin session');
  assert.ok(!(await call('/api/state', admin2.token)).state.users.some(u => u.id === employee.id), 'other branch stays private');
  for (const phone of ['956604409', '+998 95 660-44-09', '998956604409']) assert.equal((await login(phone)).user.id, employee.id);
  await login('956604409', 'wrong-password', 401);
  let account = await login('956604409');
  assert.equal(account.state.users.length, 1);
  for (const data of [boss, ownBranch, account]) assert.ok(data.state.users.every(u => !u.passwordHash && !u.customPassword && !u.year));
  await patch(admin1.token, s => ({ ...s, attendance: [...s.attendance, { id: 'att', employeeId: employee.id, date: '2026-01-10', status: 'keldi', checkIn: '08:00', checkOut: '17:00' }] }));
  await call('/api/sales', admin1.token, 'POST', { employeeId: employee.id, date: '2026-01-10', amount: 10000000, expectedUpdatedAt: null });
  await patch(admin1.token, s => ({ ...s, evaluations: [...s.evaluations, { id: 'score', employeeId: employee.id, date: '2026-01-10', scores: Object.fromEntries(Object.keys(emptyScores()).map(k => [k, 5])) }] }));
  await patch(account.token, s => ({ ...s, leaveRequests: [...s.leaveRequests, { id: 'leave', employeeId: employee.id, from: '2026-01-11', to: '2026-01-11', type: 'tatil', reason: 'Test leave', status: 'kutilmoqda' }] }));
  await patch(account.token, s => ({ ...s, users: s.users.map(u => ({ ...u, role: 'boss' })) }), 403);
  await patch(boss.token, s => ({ ...s, leaveRequests: s.leaveRequests.map(r => ({ ...r, status: 'tasdiqlandi' })), attendance: [...s.attendance, { id: 'leave-att', employeeId: employee.id, date: '2026-01-11', status: 'tatil', checkIn: '', checkOut: '' }] }));
  const report = computeEmployeeReport((await call('/api/state', account.token)).state, employee.id, '2026-01');
  assert.equal(report.base, 700000); assert.equal(report.worked, 1); assert.equal(report.leaveDays, 1); assert.equal(report.evaluation.average, 5);
  await patch(admin1.token, s => ({ ...s, users: s.users.map(u => u.id === employee.id ? { ...u, branchId: 'b2' } : u), transfers: [...s.transfers, { id: 'transfer', employeeId: employee.id, fromBranchId: 'b1', toBranchId: 'b2', effectiveDate: '2026-01-12' }] }));
  assert.ok(!(await call('/api/state', admin1.token)).state.users.some(u => u.id === employee.id));
  assert.ok((await call('/api/state', admin2.token)).state.users.some(u => u.id === employee.id));
  await patch(boss.token, s => ({ ...s, users: s.users.map(u => u.id === employee.id ? { ...u, customPassword: 'new-test-password' } : u) }));
  await call('/api/state', account.token, 'GET', undefined, 401);
  await login('956604409', 'test-password', 401);
  account = await login('956604409', 'new-test-password');
  await patch(boss.token, s => ({ ...s, users: s.users.filter(u => u.id !== employee.id) }), 400);
  await patch(boss.token, s => ({ ...s, users: s.users.map(u => u.id === employee.id ? { ...u, active: false } : u) }));
  await call('/api/state', account.token, 'GET', undefined, 401);
  await login('956604409', 'new-test-password', 401);
  await patch(boss.token, s => ({ ...s, users: s.users.map(u => u.id === employee.id ? { ...u, active: true } : u) }));
  const saved = JSON.parse(await readFile(dbPath, 'utf8'));
  assert.ok(saved.users.every(u => !u.customPassword && !u.year));
  await stop(); await start();
  account = await login('956604409', 'new-test-password');
  assert.equal(account.state.databaseId, saved.databaseId);
  assert.equal(account.state.revision, saved.revision);
  assert.equal(account.state.dailySales.length, 1);
  assert.equal(account.state.transfers.length, 1);
  assert.equal(account.user.branchId, 'b2');
  const deletionBody = { expectedUser: account.user };
  await call('/api/users/employee', admin2.token, 'DELETE', deletionBody, 403);
  await call('/api/users/employee', boss.token, 'DELETE', { expectedUser: { ...account.user, name: 'stale' } }, 409);
  await call('/api/users/employee', boss.token, 'DELETE', deletionBody);
  await call('/api/users/employee', boss.token, 'DELETE', deletionBody);
  await login('956604409', 'new-test-password', 401);
  const remaining = (await call('/api/state', boss.token)).state;
  assert.ok(!remaining.users.some(u => u.id === 'employee'));
  for (const key of ['attendance', 'dailySales', 'evaluations', 'leaveRequests', 'transfers']) assert.ok(!remaining[key].some(r => r.employeeId === 'employee'));
  await patch(boss.token, s => ({ ...s, branches: s.branches.filter(b => b.id !== 'b2') }), 400);
  await call('/api/users/admin2', boss.token, 'DELETE', { expectedUser: remaining.users.find(u => u.id === 'admin2') });
  await patch(boss.token, s => ({ ...s, branches: s.branches.filter(b => b.id !== 'b2') }));
  await stop(); await start();
  const restarted = await login('boss');
  assert.ok(!restarted.state.users.some(u => ['employee', 'admin2', 'admin-1'].includes(u.id)));
  assert.ok(!restarted.state.branches.some(b => b.id === 'b2'));
  await login('admin.local', 'test-password', 401);
  console.log('PASS: create, branch visibility, normalized login, permissions, attendance, commission, 5-point scores, leave, transfer, password reset, archive/restore, permanent deletion, deleted branch, demo cleanup, durable restart.');
} finally {
  await stop();
  if (!folder.startsWith(join(tmpdir(), 'crm-workflow-'))) throw new Error('Unexpected test directory');
  await rm(folder, { recursive: true, force: true });
}

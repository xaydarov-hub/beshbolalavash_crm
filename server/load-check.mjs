// Isolated HTTP verification. Never reads or writes the production database.
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import crypto from 'node:crypto';
import { performance } from 'node:perf_hooks';
const folder = await mkdtemp(join(tmpdir(), 'crm-load-'));
const salt = crypto.randomBytes(16).toString('hex');
const passwordHash = `scrypt:${salt}:${crypto.scryptSync('test-only-password', salt, 64).toString('hex')}`;
const users = Array.from({ length: 15 }, (_, i) => ({ id: `a${i}`, name: `Test admin ${i}`, phone: `test${i}`, role: 'admin', branchId: 'b', passwordHash }));
const employees = Array.from({ length: 15 }, (_, i) => ({ id: `e${i}`, name: `Test employee ${i}`, role: 'employee', branchId: 'b', salaryType: 'foiz', rate: 7 }));
const attendance = Array.from({ length: 10000 }, (_, i) => ({ id: `att${i}`, employeeId: `e${i % 15}`, date: '2026-01-01', status: 'keldi', checkIn: '08:00', checkOut: '17:00' }));
await writeFile(join(folder, 'db.json'), JSON.stringify({ users: [...users, ...employees], branches: [{ id: 'b' }], attendance, adjustments: [], evaluations: [], transfers: [], leaveRequests: [], auditLog: [], notifications: [], sales: {}, dailySales: [], payrollHistory: [], revision: 0 }));
const child = spawn(process.execPath, ['server/index.js'], { env: { ...process.env, NODE_ENV: 'production', RENDER: 'true', PORT: '0', DB_PATH: join(folder, 'db.json'), JWT_SECRET: '', JWT_SECRET_FILE: join(folder, '.jwt-secret') }, stdio: ['ignore', 'pipe', 'pipe'] });
let errors = '';
child.stderr.on('data', data => { errors += data; });
try {
  const base = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Server did not start: ${errors}`)), 20000);
    child.stdout.on('data', data => { const match = String(data).match(/http:\/\/localhost:\d+/); if (match) { clearTimeout(timer); resolve(match[0]); } });
    child.once('exit', code => { clearTimeout(timer); reject(new Error(`Server exited ${code}: ${errors}`)); });
  });
  async function call(path, token, method = 'GET', body, headers = {}) {
    const response = await fetch(base + path, { method, signal: AbortSignal.timeout(15000), headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}), ...headers }, ...(body ? { body: JSON.stringify(body) } : {}) });
    assert.ok(response.ok || response.status === 304, `HTTP ${response.status} ${path}: ${await (!response.ok && response.status !== 304 ? response.text() : Promise.resolve(''))}`);
    return response;
  }
  const start = performance.now();
  const tokens = await Promise.all(users.map(async user => (await (await call('/api/login', null, 'POST', { phone: user.phone, pass: 'test-only-password' })).json()).token));
  const loginMs = Math.round(performance.now() - start);
  const readStart = performance.now();
  await Promise.all(Array.from({ length: 150 }, (_, i) => call('/api/state', tokens[i % 15], 'GET', null, { 'If-None-Match': `"a${i % 15}:0"` }).then(r => assert.equal(r.status, 304))));
  const readMs = Math.round(performance.now() - readStart);
  const saleStart = performance.now();
  await Promise.all(tokens.map((token, i) => call('/api/sales', token, 'POST', { employeeId: `e${i}`, date: '2026-01-10', amount: 10000000 })));
  const saleMs = Math.round(performance.now() - saleStart);
  await Promise.all(tokens.map((token, i) => call('/api/state', token, 'PATCH', { changes: [{ collection: 'attendance', id: `new${i}`, before: null, after: { id: `new${i}`, employeeId: `e${i}`, date: '2026-01-11', status: 'keldi', checkIn: '08:00', checkOut: '17:00' } }] })));
  const final = (await (await call('/api/state', tokens[0])).json()).state;
  assert.equal(final.dailySales.length, 15);
  assert.equal(final.attendance.length, 10015);
  assert.equal(final.dailySales.reduce((sum, r) => sum + r.amount * r.rate / 100, 0), 10500000);
  const health = await call('/api/health'); assert.equal((await health.json()).apiVersion, 2);
  console.log(JSON.stringify({ concurrentUsers: 15, historyRecords: 10000, loginBatchMs: loginMs, conditionalReadRequests: 150, conditionalReadBatchMs: readMs, concurrentSaleBatchMs: saleMs, lostWrites: 0 }, null, 2));
} finally {
  child.kill();
  if (child.exitCode === null) await once(child, 'exit');
  // Only remove the exact test-created directory under the OS temporary directory.
  if (!folder.startsWith(join(tmpdir(), 'crm-load-'))) throw new Error('Unexpected test directory');
  await rm(folder, { recursive: true, force: true });
}

import { validateChanges } from './validation.js';
import { stateChanges } from '../src/lib/changes.js';
import { prepareDatabase } from './storage.js';
import { deleteAccount, removeLegacyDemoAccounts } from './accounts.js';
import { loginKey } from '../src/lib/identity.js';
import { applySale } from './sales.js';
import { migrateEvaluations, normalizeScores, evaluationTotal } from '../src/lib/evaluation.js';
import express from 'express';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import crypto from 'node:crypto';
import { Low } from 'lowdb';
import { JSONFile } from 'lowdb/node';
import { uid, todayISO } from '../src/lib/utils.js';
import { promisify } from 'node:util';
import { createStore } from './store.js';
import { applyChanges } from './changes.js';
import { gzip } from 'node:zlib';
import { serverConfig } from './config.js';
import { normalizeUserRole } from '../src/lib/roles.js';
import { applyWorkflowEffects } from './workflows.js';
import { saveSalaryEntry, settle15DayCycle, moveToTrash, restoreDeletedEntry, purgeExpiredTrash, visibleSalaryState } from './salaryEntries.js';

const app = express();
const { port: PORT, host: HOST, secret: JWT_SECRET } = serverConfig();
const dbFile = new JSONFile(process.env.DB_PATH || './server/db.json');
const db = new Low(dbFile, { users: [], branches: [], attendance: [], adjustments: [], sales: {}, leaveRequests: [], auditLog: [], notifications: [], evaluations: [], transfers: [] });
let store;
const scrypt = promisify(crypto.scrypt);
const zip = promisify(gzip);

async function sendState(req, res, payload) {
  res.set('Cache-Control', 'private, no-store');
  res.vary('Accept-Encoding');
  const json = JSON.stringify(payload);
  if (json.length > 2048 && req.acceptsEncodings('gzip')) {
    const body = await zip(json, { level: 1 });
    return res.type('json').set('Content-Encoding', 'gzip').send(body);
  }
  return res.type('json').send(json);
}

async function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = (await scrypt(String(password), salt, 64)).toString('hex');
  return `scrypt:${salt}:${hash}`;
}

async function verifyPassword(password, storedHash) {
  if (!String(storedHash || '').startsWith('scrypt:')) return false;
  const [, salt, expected] = String(storedHash).split(':');
  if (!salt || !expected || expected.length !== 128) return false;
  const actual = (await scrypt(String(password), salt, 64)).toString('hex');
  return expected.length === actual.length && crypto.timingSafeEqual(Buffer.from(actual), Buffer.from(expected));
}

async function migratePasswords(users) {
  const result = [];
  for (const user of users) {
    const withSchedule = normalizeUserRole({ workStart: '08:00', workEnd: '17:00', ...user });
    const { year, customPassword, ...safeUser } = withSchedule;
    if (withSchedule.passwordHash) { result.push(safeUser); continue; }
    const plainPassword = withSchedule.customPassword || withSchedule.year;
    if (!plainPassword) { result.push(withSchedule); continue; }
    result.push({ ...safeUser, passwordHash: await hashPassword(plainPassword) });
  }
  return result;
}

async function initDb() {
  await prepareDatabase();
  const existing = await dbFile.read();
  if (existing === null) db.data = buildState();
  else {
    if (!Array.isArray(existing.users) || !existing.users.length || !Array.isArray(existing.branches)) throw new Error('Existing CRM database is invalid. Restore a verified backup; existing data was not replaced.');
    db.data = existing;
  }
  for (const collection of ['attendance', 'adjustments', 'leaveRequests', 'auditLog', 'notifications', 'evaluations', 'transfers', 'dailySales', 'payrollHistory', 'salaryEntries', 'salarySettlements', 'trash']) {
    db.data[collection] ??= [];
    if (!Array.isArray(db.data[collection])) throw new Error(`Invalid CRM collection: ${collection}. Existing data was not replaced.`);
  }
  db.data.evaluations = migrateEvaluations(db.data.evaluations || []);
  db.data.dailySales ||= [];
  db.data.revision ||= 0;
  db.data.databaseId ||= crypto.randomUUID();
  const migratedUsers = await migratePasswords(db.data.users || []);
  if (JSON.stringify(migratedUsers) !== JSON.stringify(db.data.users)) {
    db.data.users = migratedUsers;
  }
  if (!Array.isArray(db.data.payrollHistory)) db.data.payrollHistory = [];
  db.data = removeLegacyDemoAccounts(db.data);
  db.data = purgeExpiredTrash(db.data);
  await db.write();
  store = createStore(db.data, next => dbFile.write(next));
}

function makeUsers() {
  return [
    {
      id: 'boss-1',
      role: 'boss',
      name: 'Besh Bola Lavash',
      phone: 'beshbola.hr',
      year: '1122334411',
      branchId: null,
      position: 'Direktor',
      workStart: '08:00',
      workEnd: '17:00',
      salaryType: 'oylik',
      rate: 0,
      hireDate: todayISO(),
      firstLogin: false,
    },

  ];
}

function buildState() {
  const today = todayISO();
  return {
    branches: [],
    users: makeUsers(),
    attendance: [],
    adjustments: [],
    sales: {},
    leaveRequests: [],
    auditLog: [{ id: uid(), at: new Date().toLocaleString('uz-UZ'), actor: 'System', action: 'CRM serveri ishga tushdi.' }],
    notifications: [{ id: uid(), forRole: 'boss', text: 'Sistema ishga tushdi. Boshqaruv tayyor.', at: today, read: false }],
    evaluations: [],
    transfers: [],
    payrollHistory: [],
    salaryEntries: [],
    salarySettlements: [],
    trash: [],
  };
}

const frontendUrl = process.env.FRONTEND_URL?.trim();
const allowedOrigins = (frontendUrl || 'http://localhost:5173,http://localhost:4173')
  .split(',').map((origin) => origin.trim()).filter(Boolean);
app.use(cors({
  origin: frontendUrl ? allowedOrigins : true,
  credentials: Boolean(frontendUrl),
  maxAge: 600,
}));
app.use(express.json({ limit: '5mb' }));

const authMiddleware = (req, res, next) => {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) return res.status(401).json({ message: 'Token required' });
  try {
    req.user = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] });
    if (!req.user.id || !['boss', 'admin', 'employee'].includes(req.user.role)) {
      return res.status(401).json({ message: 'Invalid user session' });
    }
    const liveUser = store.get().users.find(user => user.id === req.user.id);
    if (!liveUser || liveUser.active === false || liveUser.role !== req.user.role || (liveUser.authVersion || 0) !== (req.user.authVersion || 0)) return res.status(401).json({ message: 'Hisob yangilangan. Qayta kiring.' });
    req.user = liveUser;
    next();
  } catch {
    return res.status(401).json({ message: 'Invalid token' });
  }
};

function publicUser(user) {
  if (!user) return null;

  const { year, customPassword, passwordHash, ...safeUser } = user;
  return normalizeUserRole(safeUser);
}

export function publicState(state, session) {
  if (session.role === 'boss') {
    return { ...state, ...visibleSalaryState(state, session), users: state.users.map((user) => publicUser(user)) };
  }

  const currentUser = state.users.find((user) => user.id === session.id) || session;
  const visibleUsers = state.users.filter((user) => {
    if (user.id === session.id) return true;
    if (session.role === 'admin') return Boolean(currentUser.branchId) && user.role === 'employee' && user.branchId === currentUser.branchId;
    if (session.role === 'employee') return false;
    return false;
  });
  const visibleIds = new Set(visibleUsers.map((user) => user.id));

  return {
    ...state,
    users: visibleUsers.map(user => publicUser(user)),
    dailySales: (state.dailySales || []).filter(r => visibleIds.has(r.employeeId)),
    sales: Object.fromEntries(Object.entries(state.sales || {}).filter(([key]) => [...visibleIds].some(id => key.startsWith(`${id}:`)))),
    payrollHistory: (state.payrollHistory || []).map(r => ({ ...r, employees: (r.employees || []).filter(e => visibleIds.has(e.employeeId)) })).filter(r => r.employees.length).map(r => ({ ...r, total: r.employees.reduce((sum, e) => sum + e.total, 0) })),
    ...visibleSalaryState(state, currentUser),
    auditLog: (state.auditLog || []).filter(r => visibleIds.has(r.employeeId) || r.actor === session.name),
    notifications: (state.notifications || []).filter(r => (!r.employeeId || r.employeeId === session.id) && (!r.forRole || r.forRole === session.role) && (!r.branchId || r.branchId === currentUser.branchId)),
    attendance: state.attendance.filter((record) => visibleIds.has(record.employeeId)),
    adjustments: state.adjustments.filter((record) => visibleIds.has(record.employeeId)),
    evaluations: state.evaluations.filter((record) => visibleIds.has(record.employeeId)),
    leaveRequests: state.leaveRequests.filter((record) => visibleIds.has(record.employeeId)),
    transfers: state.transfers.filter((record) => visibleIds.has(record.employeeId)),
  };
}

export async function mergeScopedState(current, next, session) {
  const merged = { ...current };
  const visible = publicState(current, session);
  const replaceVisible = collection => {
    const ids = new Set((visible[collection] || []).map(row => row.id));
    return [...(current[collection] || []).filter(row => !ids.has(row.id)), ...(next[collection] || [])];
  };
  if (session.role === 'boss') Object.assign(merged, next);
  else if (session.role === 'admin') {
    for (const collection of ['users', 'attendance', 'adjustments', 'leaveRequests', 'evaluations', 'transfers']) merged[collection] = replaceVisible(collection);
    // Reports may contain multiple branches. Never replace a filtered report with its visible subset.
    const reportIds = new Set((current.payrollHistory || []).map(row => row.id));
    merged.payrollHistory = [...(current.payrollHistory || []), ...(next.payrollHistory || []).filter(row => !reportIds.has(row.id)).map(row => ({ ...row, branchId: session.branchId, savedBy: session.name }))];
    const auditIds = new Set((current.auditLog || []).map(row => row.id));
    merged.auditLog = [...(next.auditLog || []).filter(row => !auditIds.has(row.id)).map(row => ({ ...row, actor: session.name, actorId: session.id, branchId: session.branchId })), ...(current.auditLog || [])];
  } else if (session.role === 'employee') {
    merged.leaveRequests = replaceVisible('leaveRequests');
  }
  merged.dailySales = current.dailySales || [];
  merged.sales = current.sales || {};
  // The commission ledger is written only by its authenticated transactional endpoints.
  for (const collection of ['salaryEntries', 'salarySettlements', 'trash']) merged[collection] = current[collection] || [];
  if (session.role === 'boss' || session.role === 'admin') {
    merged.users = await Promise.all(merged.users.map(async incoming => {
      const existing = current.users.find(user => user.id === incoming.id);
      // Hidden accounts remain untouched, including malformed legacy records.
      if (incoming === existing) return existing;
      const { year, customPassword, passwordHash, authVersion, ...safe } = incoming;
      const password = customPassword || year;
      const securityChanged = !existing || ['role', 'phone', 'active'].some(key => incoming[key] !== existing[key]);
      return normalizeUserRole({ ...safe,
        ...(password || existing?.passwordHash ? { passwordHash: password ? await hashPassword(password) : existing.passwordHash } : {}),
        authVersion: (existing?.authVersion || 0) + (password || securityChanged ? 1 : 0),
      });
    }));
  }
  return merged;
}

const release = process.env.RENDER_GIT_COMMIT || process.env.COMMIT_REF || 'local';
app.get('/api/health', (_, res) => res.json({ ok: true, release, apiVersion: 2, salaryEntryApiVersion: 1, uptime: Math.floor(process.uptime()) }));

const loginAttempts = new Map();
function checkLoginLimit(key, res) {
  const now = Date.now();
  for (const [storedKey, attempt] of loginAttempts) if (attempt.until <= now) loginAttempts.delete(storedKey);
  const attempt = loginAttempts.get(key);
  if (attempt && attempt.count >= 12) {
    res.set('Retry-After', String(Math.ceil((attempt.until - now) / 1000))).status(429).json({ message: 'Ko‘p marta noto‘g‘ri parol kiritildi. 15 daqiqadan keyin qayta urinib ko‘ring.' });
    return false;
  }
  if (loginAttempts.size >= 10000 && !attempt) loginAttempts.delete(loginAttempts.keys().next().value);
  loginAttempts.set(key, { count: (attempt?.count || 0) + 1, until: attempt?.until || now + 15 * 60 * 1000 });
  return true;
}

function issueToken(user) {
  return jwt.sign({ id: user.id, role: user.role, authVersion: user.authVersion || 0 }, JWT_SECRET, { algorithm: 'HS256', expiresIn: '8h' });
}

app.post('/api/login', async (req, res) => {
  const body = req.body || {};
  const login = String(body.phone ?? body.login ?? body.username ?? '').trim().toLowerCase();
  const password = String(body.pass ?? body.password ?? '');
  if (!login || !password || login.length > 200 || password.length > 1024) return res.status(400).json({ message: 'Login va parolni tekshiring.' });
  const attemptKey = `${req.ip}:${loginKey(login)}`;
  if (!checkLoginLimit(attemptKey, res)) return;
  const snapshot = store.get();
  const user = snapshot.users.find(item => loginKey(item.phone) === loginKey(login));
  if (!user || user.active === false || !await verifyPassword(password, user.passwordHash)) return res.status(401).json({ message: "Login yoki parol noto'g'ri." });
  const current = store.get();
  const liveUser = current.users.find(item => item.id === user.id);
  if (!liveUser || liveUser.active === false || liveUser.passwordHash !== user.passwordHash) return res.status(401).json({ message: 'Hisob yangilangan. Qayta kiring.' });
  if (!['boss', 'admin', 'employee'].includes(liveUser.role)) return res.status(401).json({ message: 'Hisob roli noto‘g‘ri. Boshliq bilan bog‘laning.' });
  loginAttempts.delete(attemptKey);
  const token = issueToken(liveUser);
  return sendState(req, res, { token, user: publicUser(liveUser), state: publicState(current, liveUser) });
});

app.get('/api/state', authMiddleware, async (req, res) => {
  const current = store.get();
  const user = current.users.find(item => item.id === req.user.id);
  if (!user) return res.status(401).json({ message: 'Hisob mavjud emas.' });
  const etag = `"${user.id}:${current.databaseId || ""}:${current.revision || 0}"`;
  res.set({ ETag: etag, 'Cache-Control': 'private, no-cache' });
  if (req.headers['if-none-match'] === etag) return res.status(304).end();
  return sendState(req, res, { user: publicUser(user), state: publicState(current, user) });
});

function sessionUser(state, identity) {
  const id = typeof identity === 'string' ? identity : identity.id;
  const user = state.users.find(item => item.id === id);
  if (!user || user.active === false) throw Object.assign(new Error('Sessiya tugagan.'), { status: 401 });
  if (typeof identity === 'object' && (user.role !== identity.role || (user.authVersion || 0) !== (identity.authVersion || 0))) throw Object.assign(new Error('Hisob yangilangan. Qayta kiring.'), { status: 401 });
  return user;
}
function normalizeState(next, revision) {
  return { ...next, revision, evaluations: (next.evaluations || []).map(r => ({ ...r, scores: normalizeScores(r.scores), total: evaluationTotal(r.scores), scaleVersion: 2 })) };
}

// Compatibility route for older clients. Modern clients send record-level changes.
app.put('/api/state', authMiddleware, async (req, res) => {
  const nextState = req.body?.state;
  if (!nextState) return res.status(400).json({ message: 'State not provided' });
  const updated = await store.update(async current => {
    const user = sessionUser(current, req.user);
    if ((nextState.revision || 0) !== (current.revision || 0)) throw Object.assign(new Error('Yozuvlar yangilangan. Sahifani yangilang.'), { status: 409 });
    const visible = publicState(current, user);
    const changes = stateChanges(visible, nextState);
    const next = applyChanges(visible, changes, user);
    validateChanges(current, next, changes, user);
    return normalizeState(applyWorkflowEffects(current, await mergeScopedState(current, next, user), changes, user), (current.revision || 0) + 1);
  });
  return sendState(req, res, { ok: true, state: publicState(updated, sessionUser(updated, req.user.id)) });
});

app.patch('/api/state', authMiddleware, async (req, res) => {
  const updated = await store.update(async current => {
    const user = sessionUser(current, req.user);
    const next = applyChanges(publicState(current, user), req.body?.changes, user);
    validateChanges(current, next, req.body.changes, user);
    return normalizeState(applyWorkflowEffects(current, await mergeScopedState(current, next, user), req.body.changes, user), (current.revision || 0) + 1);
  });
  return sendState(req, res, { ok: true, state: publicState(updated, sessionUser(updated, req.user.id)) });
});

app.post('/api/sales', authMiddleware, async (req, res) => {
  const updated = await store.update(current => ({ ...applySale(current, sessionUser(current, req.user), req.body || {}), revision: (current.revision || 0) + 1 }));
  return sendState(req, res, { state: publicState(updated, sessionUser(updated, req.user.id)) });
});

for (const [path, action] of [
  ['/api/salary-entries', (state, user, req) => saveSalaryEntry(state, user, req.body || {})],
  ['/api/salary-settlements', (state, user, req) => settle15DayCycle(state, user, req.body || {})],
  ['/api/salary-entries/:id/trash', (state, user, req) => moveToTrash(state, user, req.params.id, req.body || {})],
  ['/api/salary-entries/:id/restore', (state, user, req) => restoreDeletedEntry(state, user, req.params.id, req.body || {})],
]) {
  app.post(path, authMiddleware, async (req, res) => {
    const updated = await store.update(current => action(current, sessionUser(current, req.user), req));
    return sendState(req, res, { ok: true, state: publicState(updated, sessionUser(updated, req.user.id)) });
  });
}

app.delete('/api/users/:id', authMiddleware, async (req, res) => {
  const updated = await store.update(current => {
    const user = sessionUser(current, req.user);
    const next = deleteAccount(current, user, req.params.id, req.body?.expectedUser, publicUser(current.users.find(row => row.id === req.params.id)));
    return next === current ? current : { ...next, revision: (current.revision || 0) + 1 };
  });
  return sendState(req, res, { ok: true, state: publicState(updated, sessionUser(updated, req.user.id)) });
});

app.post('/api/password', authMiddleware, async (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  if (typeof currentPassword !== 'string' || !currentPassword || currentPassword.length > 1024 || typeof newPassword !== 'string' || newPassword.trim().length < 8 || newPassword.length > 1024) return res.status(400).json({ message: 'Joriy parolni va kamida 8 belgili yangi parolni kiriting.' });
  if (currentPassword === newPassword) return res.status(400).json({ message: 'Yangi parol avvalgisidan farq qilishi kerak.' });
  const attemptKey = `password:${req.user.id}`;
  if (!checkLoginLimit(attemptKey, res)) return;
  // Password verification is outside the write queue so other users can save normally.
  if (!await verifyPassword(currentPassword, req.user.passwordHash)) return res.status(400).json({ message: 'Joriy parol noto‘g‘ri.' });
  const passwordHash = await hashPassword(newPassword);
  const updated = await store.update(current => {
    const user = sessionUser(current, req.user);
    return { ...current, revision: (current.revision || 0) + 1,
      users: current.users.map(row => row.id === user.id ? { ...row, passwordHash, authVersion: (row.authVersion || 0) + 1, firstLogin: false } : row),
      auditLog: [{ id: uid(), actor: user.name, actorId: user.id, employeeId: user.id, action: 'Hisob paroli yangilandi.', at: new Date().toISOString() }, ...(current.auditLog || [])],
    };
  });
  loginAttempts.delete(attemptKey);
  const user = sessionUser(updated, req.user.id);
  return sendState(req, res, { ok: true, token: issueToken(user), user: publicUser(user), state: publicState(updated, user) });
});

app.post('/api/reset', authMiddleware, async (req, res) => {
  const updated = await store.update(async current => {
    const user = sessionUser(current, req.user);
    if (user.role !== 'boss') throw Object.assign(new Error('Only the boss can reset the system'), { status: 403 });
    const next = buildState();
    next.users = [{ ...user, branchId: null }];
    return { ...next, databaseId: crypto.randomUUID(), dailySales: [], revision: (current.revision || 0) + 1 };
  });
  res.json({ ok: true, state: publicState(updated, { role: 'boss' }) });
});

app.use((error, req, res, next) => {
  console.error('API request failed:', error.status || 500, error.message);
  res.status(error.status || 500).json({ message: error.status ? error.message : 'Serverda saqlash bajarilmadi. Qayta urinib ko?ring.' });
});

if (process.env.NODE_ENV !== 'test') {
  await initDb();
  // Runs without an open browser, and startup above catches up after downtime.
  const trashTimer = setInterval(() => {
    if (purgeExpiredTrash(store.get()) === store.get()) return;
    store.update(current => purgeExpiredTrash(current)).catch(error => console.error('Trash cleanup failed:', error.message));
  }, 60_000);
  trashTimer.unref();
  const server = app.listen(PORT, HOST, () => {
    const address = server.address();
    const actualPort = address && typeof address === 'object' ? address.port : PORT;
    console.log(`CRM backend running on http://localhost:${actualPort}`);
  });

  server.on('error', (error) => {
    console.error('Backend listen failed:', error);
    process.exitCode = 1;
  });
}

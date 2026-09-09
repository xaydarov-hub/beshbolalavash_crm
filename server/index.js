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

const app = express();
const PORT = Number(process.env.PORT ?? 4000);
const JWT_SECRET = process.env.JWT_SECRET || (process.env.NODE_ENV === 'production' ? '' : crypto.randomBytes(32).toString('hex'));
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

if (!JWT_SECRET || JWT_SECRET.length < 32) {
  throw new Error('JWT_SECRET must be set and at least 32 characters long.');
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
    const withSchedule = { workStart: '08:00', workEnd: '17:00', ...user };
    if (withSchedule.passwordHash) { result.push(withSchedule); continue; }
    const plainPassword = withSchedule.customPassword || withSchedule.year;
    if (!plainPassword) { result.push(withSchedule); continue; }
    const { year, customPassword, ...safeUser } = withSchedule;
    result.push({ ...safeUser, passwordHash: await hashPassword(plainPassword) });
  }
  return result;
}

async function initDb() {
  await db.read();
  if (!db.data || !db.data.users || db.data.users.length === 0) {
    db.data = buildState();
  }
  db.data.evaluations = migrateEvaluations(db.data.evaluations || []);
  db.data.dailySales ||= [];
  db.data.revision ||= 0;
  const migratedUsers = await migratePasswords(db.data.users || []);
  if (JSON.stringify(migratedUsers) !== JSON.stringify(db.data.users)) {
    db.data.users = migratedUsers;
  }
  if (!Array.isArray(db.data.payrollHistory)) db.data.payrollHistory = [];
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
    {
      id: 'admin-1',
      role: 'admin',
      name: 'Filial Admini',
      phone: 'admin.local',
      year: '2024',
      branchId: 'branch-1',
      position: 'Filial admini',
      workStart: '08:00',
      workEnd: '17:00',
      salaryType: 'oylik',
      rate: 3200000,
      hireDate: todayISO(),
      firstLogin: false,
    },
    {
      id: 'employee-1',
      role: 'employee',
      name: 'Yangi xodim',
      phone: 'employee.local',
      year: '2024',
      branchId: 'branch-1',
      position: 'Ofitsiant',
      workStart: '08:00',
      workEnd: '17:00',
      salaryType: 'kunlik',
      rate: 120000,
      hireDate: todayISO(),
      firstLogin: true,
    },
  ];
}

function buildState() {
  const today = todayISO();
  return {
    branches: [
      { id: 'branch-1', name: 'Chilonzor filiali' },
      { id: 'branch-2', name: 'Yunusobod filiali' },
      { id: 'branch-3', name: 'Sergeli filiali' },
    ],
    users: makeUsers(),
    attendance: [
      { id: uid(), employeeId: 'employee-1', date: today, status: 'keldi', checkIn: '08:15', checkOut: '17:30', late: true },
      { id: uid(), employeeId: 'admin-1', date: today, status: 'keldi', checkIn: '08:00', checkOut: '17:00', late: false },
    ],
    adjustments: [],
    sales: {},
    leaveRequests: [],
    auditLog: [{ id: uid(), at: new Date().toLocaleString('uz-UZ'), actor: 'System', action: 'CRM serveri ishga tushdi.' }],
    notifications: [{ id: uid(), forRole: 'boss', text: 'Sistema ishga tushdi. Boshqaruv tayyor.', at: today, read: false }],
    evaluations: [],
    transfers: [],
    payrollHistory: [],
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
    req.user = jwt.verify(token, JWT_SECRET);
    if (!req.user.id || !['boss', 'admin', 'employee'].includes(req.user.role)) {
      return res.status(401).json({ message: 'Invalid user session' });
    }
    next();
  } catch {
    return res.status(401).json({ message: 'Invalid token' });
  }
};

function publicUser(user) {
  if (!user) return null;
  const { year, customPassword, passwordHash, ...safeUser } = user;
  return safeUser;
}

export function publicState(state, session) {
  if (session.role === 'boss') {
    return { ...state, users: state.users.map(publicUser) };
  }

  const visibleUsers = state.users.filter((user) => user.id === session.id || (session.role === 'admin' && user.branchId === session.branchId));
  const visibleIds = new Set(visibleUsers.map((user) => user.id));
  return {
    ...state,
    users: visibleUsers.map(publicUser),
    dailySales: (state.dailySales || []).filter(r => visibleIds.has(r.employeeId)),
    sales: Object.fromEntries(Object.entries(state.sales || {}).filter(([key]) => [...visibleIds].some(id => key.startsWith(`${id}:`)))),
    payrollHistory: (state.payrollHistory || []).map(r => ({ ...r, employees: (r.employees || []).filter(e => visibleIds.has(e.employeeId)) })).filter(r => r.employees.length).map(r => ({ ...r, total: r.employees.reduce((sum, e) => sum + e.total, 0) })),
    auditLog: (state.auditLog || []).filter(r => visibleIds.has(r.employeeId)),
    notifications: (state.notifications || []).filter(r => r.employeeId === session.id),
    attendance: state.attendance.filter((record) => visibleIds.has(record.employeeId)),
    adjustments: state.adjustments.filter((record) => visibleIds.has(record.employeeId)),
    evaluations: state.evaluations.filter((record) => visibleIds.has(record.employeeId)),
    leaveRequests: state.leaveRequests.filter((record) => visibleIds.has(record.employeeId)),
    transfers: state.transfers.filter((record) => visibleIds.has(record.employeeId)),
  };
}

export async function mergeScopedState(current, next, session) {
  if (session.role === 'boss') {
    return {
      ...next,
      dailySales: current.dailySales || [],
      sales: current.sales || {},
      users: await Promise.all((next.users || []).map(async (incomingUser) => {
        const existingUser = current.users.find((user) => user.id === incomingUser.id);
        const plainPassword = incomingUser.customPassword || incomingUser.year;
        if (plainPassword) {
          const { year, customPassword, ...safeUser } = incomingUser;
          return { ...safeUser, passwordHash: await hashPassword(plainPassword) };
        }
        return existingUser?.passwordHash ? { ...incomingUser, passwordHash: existingUser.passwordHash } : incomingUser;
      })),
    };
  }
  const merged = { ...current };
  const visibleUsers = current.users.filter((user) => user.id === session.id || (session.role === 'admin' && user.branchId === session.branchId));
  const visibleIds = new Set(visibleUsers.map((user) => user.id));

  if (session.role === 'admin') {
    for (const collection of ['attendance', 'evaluations', 'transfers']) {
      const incoming = Array.isArray(next[collection]) ? next[collection] : [];
      const preserved = current[collection].filter((record) => !visibleIds.has(record.employeeId));
      merged[collection] = [...preserved, ...incoming.filter((record) => visibleIds.has(record.employeeId))];
    }
  }

  if (session.role === 'admin') {
    const auditIds = new Set((current.auditLog || []).map(row => row.id));
    merged.auditLog = [...(next.auditLog || []).filter(row => !auditIds.has(row.id)).map(row => ({ ...row, actor: session.name })), ...(current.auditLog || [])];
    const previousIds = new Set((current.transfers || []).map(r => r.id));
    for (const transfer of (merged.transfers || []).filter(r => !previousIds.has(r.id))) {
      const employee = current.users.find(u => u.id === transfer.employeeId && u.role === 'employee' && u.branchId === session.branchId);
      if (employee && transfer.fromBranchId === employee.branchId && current.branches.some(b => b.id === transfer.toBranchId)) {
        merged.users = (merged.users || current.users).map(u => u.id === employee.id ? { ...u, branchId: transfer.toBranchId } : u);
      }
    }
  }

  if (session.role === 'employee') {
    const incoming = Array.isArray(next.leaveRequests) ? next.leaveRequests : [];
    merged.leaveRequests = [
      ...current.leaveRequests.filter((request) => request.employeeId !== session.id),
      ...incoming.filter((request) => request.employeeId === session.id),
    ];
  }

  return merged;
}

const release = process.env.RENDER_GIT_COMMIT || process.env.COMMIT_REF || 'local';
app.get('/api/health', (_, res) => res.json({ ok: true, release, apiVersion: 2, uptime: Math.floor(process.uptime()) }));

app.post('/api/login', async (req, res) => {
  const body = req.body || {};
  const login = String(body.phone ?? body.login ?? body.username ?? '').trim().toLowerCase();
  const password = String(body.pass ?? body.password ?? '').trim();
  if (!login || !password || login.length > 200 || password.length > 1024) return res.status(400).json({ message: 'Login va parolni tekshiring.' });
  const snapshot = store.get();
  const user = snapshot.users.find(item => {
    const candidate = String(item.phone || '').trim().toLowerCase();
    if (candidate === login) return true;
    const digits = login.replace(/\D/g, '');
    return digits && candidate.replace(/\D/g, '') === digits;
  });
  if (!user || !await verifyPassword(password, user.passwordHash)) return res.status(401).json({ message: "Login yoki parol noto'g'ri." });
  const current = store.get();
  const liveUser = current.users.find(item => item.id === user.id);
  if (!liveUser || liveUser.passwordHash !== user.passwordHash) return res.status(401).json({ message: 'Hisob yangilangan. Qayta kiring.' });
  const token = jwt.sign({ id: liveUser.id, role: liveUser.role }, JWT_SECRET, { expiresIn: '8h' });
  return sendState(req, res, { token, user: publicUser(liveUser), state: publicState(current, liveUser) });
});

app.get('/api/state', authMiddleware, async (req, res) => {
  const current = store.get();
  const user = current.users.find(item => item.id === req.user.id);
  if (!user) return res.status(401).json({ message: 'Hisob mavjud emas.' });
  const etag = `"${user.id}:${current.revision || 0}"`;
  res.set({ ETag: etag, 'Cache-Control': 'private, no-cache' });
  if (req.headers['if-none-match'] === etag) return res.status(304).end();
  return sendState(req, res, { user: publicUser(user), state: publicState(current, user) });
});

function sessionUser(state, id) {
  const user = state.users.find(item => item.id === id);
  if (!user) throw Object.assign(new Error('Sessiya tugagan.'), { status: 401 });
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
    const user = sessionUser(current, req.user.id);
    if ((nextState.revision || 0) !== (current.revision || 0)) throw Object.assign(new Error('Yozuvlar yangilangan. Sahifani yangilang.'), { status: 409 });
    return normalizeState(await mergeScopedState(current, nextState, user), (current.revision || 0) + 1);
  });
  return sendState(req, res, { ok: true, state: publicState(updated, sessionUser(updated, req.user.id)) });
});

app.patch('/api/state', authMiddleware, async (req, res) => {
  const updated = await store.update(async current => {
    const user = sessionUser(current, req.user.id);
    const next = applyChanges(publicState(current, user), req.body?.changes, user);
    return normalizeState(await mergeScopedState(current, next, user), (current.revision || 0) + 1);
  });
  return sendState(req, res, { ok: true, state: publicState(updated, sessionUser(updated, req.user.id)) });
});

app.post('/api/sales', authMiddleware, async (req, res) => {
  const updated = await store.update(current => ({ ...applySale(current, sessionUser(current, req.user.id), req.body || {}), revision: (current.revision || 0) + 1 }));
  return sendState(req, res, { state: publicState(updated, sessionUser(updated, req.user.id)) });
});

app.post('/api/reset', authMiddleware, async (req, res) => {
  const updated = await store.update(async current => {
    if (sessionUser(current, req.user.id).role !== 'boss') throw Object.assign(new Error('Only the boss can reset the system'), { status: 403 });
    const next = buildState();
    next.users = await migratePasswords(next.users);
    return { ...next, dailySales: [], revision: (current.revision || 0) + 1 };
  });
  res.json({ ok: true, state: publicState(updated, { role: 'boss' }) });
});

app.use((error, req, res, next) => {
  console.error('API request failed:', error.status || 500, error.message);
  res.status(error.status || 500).json({ message: error.status ? error.message : 'Serverda saqlash bajarilmadi. Qayta urinib ko?ring.' });
});

if (process.env.NODE_ENV !== 'test') {
  await initDb();
  const server = app.listen(PORT, () => {
    const address = server.address();
    const actualPort = address && typeof address === 'object' ? address.port : PORT;
    console.log(`CRM backend running on http://localhost:${actualPort}`);
  });

  server.on('error', (error) => {
    console.error('Backend listen failed:', error);
    process.exitCode = 1;
  });
}

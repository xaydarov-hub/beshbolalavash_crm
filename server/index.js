import express from 'express';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import crypto from 'node:crypto';
import { Low } from 'lowdb';
import { JSONFile } from 'lowdb/node';
import { uid, todayISO } from '../src/lib/utils.js';

const app = express();
const PORT = Number(process.env.PORT) || 4000;
const JWT_SECRET = process.env.JWT_SECRET || (process.env.NODE_ENV === 'production' ? '' : 'beshbola-secret-2026');
const dbFile = new JSONFile('./server/db.json');
const db = new Low(dbFile, { users: [], branches: [], attendance: [], adjustments: [], sales: {}, leaveRequests: [], auditLog: [], notifications: [], evaluations: [], transfers: [] });

if (!JWT_SECRET || JWT_SECRET.length < 32) {
  throw new Error('JWT_SECRET must be set and at least 32 characters long.');
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(String(password), salt, 64).toString('hex');
  return `scrypt:${salt}:${hash}`;
}

function verifyPassword(password, storedHash) {
  if (!String(storedHash || '').startsWith('scrypt:')) return false;
  const [, salt, expected] = String(storedHash).split(':');
  const actual = crypto.scryptSync(String(password), salt, 64).toString('hex');
  return expected.length === actual.length && crypto.timingSafeEqual(Buffer.from(actual), Buffer.from(expected));
}

function migratePasswords(users) {
  return users.map((user) => {
    const withSchedule = { workStart: '08:00', workEnd: '17:00', ...user };
    if (withSchedule.passwordHash) return withSchedule;
    const plainPassword = withSchedule.customPassword || withSchedule.year;
    if (!plainPassword) return withSchedule;
    const { year, customPassword, ...safeUser } = withSchedule;
    return { ...safeUser, passwordHash: hashPassword(plainPassword) };
  });
}

async function initDb() {
  await db.read();
  if (!db.data || !db.data.users || db.data.users.length === 0) {
    db.data = buildState();
  }
  const migratedUsers = migratePasswords(db.data.users || []);
  if (JSON.stringify(migratedUsers) !== JSON.stringify(db.data.users)) {
    db.data.users = migratedUsers;
  }
  if (!Array.isArray(db.data.payrollHistory)) db.data.payrollHistory = [];
  await db.write();
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
}));
app.use(express.json({ limit: '256kb' }));

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

function publicState(state, session) {
  if (session.role === 'boss') {
    return { ...state, users: state.users.map(publicUser) };
  }

  const visibleUsers = state.users.filter((user) => user.id === session.id || user.branchId === session.branchId);
  const visibleIds = new Set(visibleUsers.map((user) => user.id));
  return {
    ...state,
    users: visibleUsers.map(publicUser),
    attendance: state.attendance.filter((record) => visibleIds.has(record.employeeId)),
    adjustments: state.adjustments.filter((record) => visibleIds.has(record.employeeId)),
    evaluations: state.evaluations.filter((record) => visibleIds.has(record.employeeId)),
    leaveRequests: state.leaveRequests.filter((record) => visibleIds.has(record.employeeId)),
    transfers: state.transfers.filter((record) => visibleIds.has(record.employeeId)),
  };
}

function mergeScopedState(current, next, session) {
  if (session.role === 'boss') {
    return {
      ...next,
      users: (next.users || []).map((incomingUser) => {
        const existingUser = current.users.find((user) => user.id === incomingUser.id);
        if (incomingUser.passwordHash) return incomingUser;
        const plainPassword = incomingUser.customPassword || incomingUser.year;
        if (plainPassword) {
          const { year, customPassword, ...safeUser } = incomingUser;
          return { ...safeUser, passwordHash: hashPassword(plainPassword) };
        }
        return existingUser?.passwordHash ? { ...incomingUser, passwordHash: existingUser.passwordHash } : incomingUser;
      }),
    };
  }
  const merged = { ...current };
  const visibleUsers = current.users.filter((user) => user.id === session.id || user.branchId === session.branchId);
  const visibleIds = new Set(visibleUsers.map((user) => user.id));

  if (session.role === 'admin') {
    for (const collection of ['attendance', 'evaluations', 'transfers']) {
      const incoming = Array.isArray(next[collection]) ? next[collection] : [];
      const preserved = current[collection].filter((record) => !visibleIds.has(record.employeeId));
      merged[collection] = [...preserved, ...incoming.filter((record) => visibleIds.has(record.employeeId))];
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

app.get('/api/health', async (_, res) => {
  await db.read();
  res.json({ ok: true, message: 'CRM backend is running', count: (db.data?.users || []).length });
});

app.post('/api/login', async (req, res) => {
  const body = req.body || {};
  const phone = body.phone ?? body.login ?? body.username;
  const pass = body.pass ?? body.password;
  await db.read();
  const login = String(phone || '').trim().toLowerCase();
  const password = String(pass || '').trim();
  const user = (db.data?.users || []).find((item) => {
    const candidate = String(item.phone || '').trim().toLowerCase();
    if (candidate === login) return true;
    const numericLogin = login.replace(/\D/g, '');
    const numericCandidate = candidate.replace(/\D/g, '');
    return numericLogin && numericCandidate && numericCandidate === numericLogin;
  });

  if (!user || !verifyPassword(password, user.passwordHash)) {
    return res.status(401).json({ message: 'Login yoki parol noto\'g\'ri.' });
  }

  const token = jwt.sign({ id: user.id, role: user.role, name: user.name, phone: user.phone }, JWT_SECRET, { expiresIn: '8h' });
  return res.json({ token, user: publicUser(user), state: publicState(db.data, user) });
});

app.get('/api/state', authMiddleware, async (req, res) => {
  await db.read();
  const user = (db.data?.users || []).find((item) => item.id === req.user.id);
  res.json({ user: publicUser(user), state: user ? publicState(db.data, user) : null });
});

app.put('/api/state', authMiddleware, async (req, res) => {
  const nextState = req.body?.state;
  if (!nextState) return res.status(400).json({ message: 'State not provided' });
  await db.read();
  const currentUser = (db.data?.users || []).find((user) => user.id === req.user.id);
  if (!currentUser) return res.status(401).json({ message: 'User no longer exists' });
  db.data = mergeScopedState(db.data, nextState, currentUser);
  await db.write();
  return res.json({ ok: true, state: publicState(db.data, currentUser) });
});

app.post('/api/reset', authMiddleware, async (req, res) => {
  if (req.user.role !== 'boss') return res.status(403).json({ message: 'Only the boss can reset the system' });
  db.data = buildState();
  await db.write();
  res.json({ ok: true, state: publicState(db.data, req.user) });
});

await initDb();
app.listen(PORT, () => {
  console.log(`CRM backend running on http://localhost:${PORT}`);
});

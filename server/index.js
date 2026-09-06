import express from 'express';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import { Low } from 'lowdb';
import { JSONFile } from 'lowdb/node';
import { uid, todayISO } from '../src/lib/utils.js';

const app = express();
const PORT = 4000;
const JWT_SECRET = process.env.JWT_SECRET || 'beshbola-secret-2026';
const dbFile = new JSONFile('./server/db.json');
const db = new Low(dbFile, { users: [], branches: [], attendance: [], adjustments: [], sales: {}, leaveRequests: [], auditLog: [], notifications: [], evaluations: [], transfers: [] });

async function initDb() {
  await db.read();
  if (!db.data || !db.data.users || db.data.users.length === 0) {
    db.data = buildState();
    await db.write();
  }
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
  };
}

app.use(cors());
app.use(express.json());

const authMiddleware = (req, res, next) => {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) return res.status(401).json({ message: 'Token required' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ message: 'Invalid token' });
  }
};

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

  if (!user || password !== String(user.customPassword || user.year || '')) {
    return res.status(401).json({ message: 'Login yoki parol noto\'g\'ri.' });
  }

  const token = jwt.sign({ id: user.id, role: user.role, name: user.name, phone: user.phone }, JWT_SECRET, { expiresIn: '8h' });
  return res.json({ token, user, state: db.data });
});

app.get('/api/state', authMiddleware, async (req, res) => {
  await db.read();
  const user = (db.data?.users || []).find((item) => item.id === req.user.id);
  res.json({ user: user || null, state: db.data });
});

app.put('/api/state', authMiddleware, async (req, res) => {
  const nextState = req.body?.state;
  if (!nextState) return res.status(400).json({ message: 'State not provided' });
  db.data = nextState;
  await db.write();
  return res.json({ ok: true, state: db.data });
});

app.post('/api/reset', authMiddleware, async (_, res) => {
  db.data = buildState();
  await db.write();
  res.json({ ok: true, state: db.data });
});

await initDb();
app.listen(PORT, () => {
  console.log(`CRM backend running on http://localhost:${PORT}`);
});

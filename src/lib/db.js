import { uid, todayISO, addDays } from "./utils.js";

const KEY = "bbl-crm-state-v1";

const SCHEDULE = { start: "08:00", end: "21:00" };

function makeUsers(branches) {
  return [
    {
      id: uid(),
      role: "boss",
      name: "Besh Bola Lavash",
      phone: "beshbola.hr",
      year: "1122334411",
      branchId: null,
      position: "Direktor",
      salaryType: "oylik",
      rate: 0,
      hireDate: todayISO(),
      firstLogin: false,
    },
  ];
}

function rand(seed) {
  // simple deterministic-ish pseudo random from a numeric seed
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

function genAttendance(users) {
  const attendance = [];
  const employees = users.filter((u) => u.role === "employee" || u.role === "admin");
  const today = todayISO();
  let dayCursor = addDays(today, -44); // ~45 days back (covers this + last month)

  let seedCounter = 1;
  while (dayCursor <= today) {
    const dow = new Date(dayCursor).getDay(); // 0 = sunday
    for (const emp of employees) {
      const r = rand(seedCounter++);
      // ~1 day off per week roughly, biased to sunday
      const isDayOff = dow === 0 ? r < 0.5 : r < 0.06;
      if (isDayOff) {
        const rr = rand(seedCounter++);
        attendance.push({
          id: uid(), employeeId: emp.id, date: dayCursor,
          status: rr < 0.15 ? "kasal" : rr < 0.3 ? "tatil" : "kelmadi",
          checkIn: "", checkOut: "", late: false,
        });
        continue;
      }
      const lateRoll = rand(seedCounter++);
      const late = lateRoll > 0.82;
      const lateMins = late ? Math.floor(rand(seedCounter++) * 50) + 5 : 0;
      const [sh, sm] = SCHEDULE.start.split(":").map(Number);
      let inMin = sh * 60 + sm + (late ? lateMins : Math.floor(rand(seedCounter++) * 8) - 4);
      inMin = Math.max(0, inMin);
      const checkIn = `${String(Math.floor(inMin / 60)).padStart(2, "0")}:${String(inMin % 60).padStart(2, "0")}`;
      const [eh, em] = SCHEDULE.end.split(":").map(Number);
      let outMin = eh * 60 + em + Math.floor(rand(seedCounter++) * 20) - 10;
      const checkOut = `${String(Math.floor(outMin / 60)).padStart(2, "0")}:${String(outMin % 60).padStart(2, "0")}`;
      attendance.push({
        id: uid(), employeeId: emp.id, date: dayCursor,
        status: "keldi", checkIn, checkOut, late,
      });
    }
    dayCursor = addDays(dayCursor, 1);
  }
  return attendance;
}

function genAdjustments(users, boss) {
  const employees = users.filter((u) => u.role === "employee");
  const today = todayISO();
  const list = [
    { name: "Aziz Karimov", type: "bonus", amount: 300000, comment: "Oyni yaxshi natija bilan yakunladi.", daysAgo: 3 },
    { name: "Aziz Karimov", type: "jarima", amount: 50000, comment: "Ishga 1 soat kechikdi.", daysAgo: 12 },
    { name: "Diyor Rashidov", type: "bonus", amount: 200000, comment: "Qo'shimcha buyurtmalarni o'z vaqtida yetkazdi.", daysAgo: 6 },
    { name: "Nodira Tosheva", type: "jarima", amount: 30000, comment: "Ish joyida tartibsizlik.", daysAgo: 9 },
    { name: "Javlon Mirzaev", type: "bonus", amount: 500000, comment: "Yangi taomlar retseptini ishlab chiqdi.", daysAgo: 20 },
    { name: "Kamola Saidova", type: "jarima", amount: 40000, comment: "Kassada kamomad aniqlandi.", daysAgo: 15 },
    { name: "Bekzod Alimov", type: "bonus", amount: 250000, comment: "Filial oshxonasida namunali tozalik.", daysAgo: 5 },
    { name: "Anvar Tursunov", type: "jarima", amount: 60000, comment: "3 marta kechikdi.", daysAgo: 25 },
  ];
  return list.map((a) => {
    const emp = employees.find((e) => e.name === a.name);
    return {
      id: uid(), employeeId: emp.id, type: a.type, amount: a.amount, comment: a.comment,
      date: addDays(today, -a.daysAgo), by: boss.name,
    };
  });
}

function genSales(users) {
  const sales = {};
  const today = todayISO();
  const thisMonth = today.slice(0, 7);
  const lastMonth = addDays(today, -30).slice(0, 7);
  users.filter((u) => u.salaryType === "foiz").forEach((u) => {
    sales[`${u.id}:${thisMonth}`] = 4200000 + Math.floor(rand(u.name.length * 7) * 3000000);
    sales[`${u.id}:${lastMonth}`] = 3800000 + Math.floor(rand(u.name.length * 3) * 3000000);
  });
  return sales;
}

function genLeaveRequests(users) {
  const employees = users.filter((u) => u.role === "employee");
  const today = todayISO();
  return [
    { id: uid(), employeeId: employees[2].id, from: addDays(today, 5), to: addDays(today, 8),
      type: "tatil", reason: "Oilaviy sabab", status: "kutilmoqda", requestedAt: addDays(today, -1) },
    { id: uid(), employeeId: employees[5].id, from: addDays(today, -10), to: addDays(today, -8),
      type: "kasal", reason: "Shifokor ma'lumotnomasi bilan", status: "tasdiqlandi", requestedAt: addDays(today, -12) },
    { id: uid(), employeeId: employees[0].id, from: addDays(today, 15), to: addDays(today, 17),
      type: "tatil", reason: "Qarindoshlar to'yi", status: "kutilmoqda", requestedAt: todayISO() },
  ];
}

function genAuditLog(boss, admins) {
  const today = todayISO();
  return [
    { id: uid(), at: `${addDays(today, -3)} 09:14`, actor: boss.name, action: "Aziz Karimovga +300 000 so'm bonus berdi. Sabab: Oyni yaxshi natija bilan yakunladi." },
    { id: uid(), at: `${addDays(today, -12)} 10:02`, actor: boss.name, action: "Aziz Karimovga -50 000 so'm jarima qo'ydi. Sabab: Ishga 1 soat kechikdi." },
    { id: uid(), at: `${today} 08:03`, actor: admins[0]?.name || "Admin", action: "Aziz Karimovni 08:03 da kelgan deb belgiladi." },
    { id: uid(), at: `${today} 21:01`, actor: admins[0]?.name || "Admin", action: "Nodira Toshevani 21:01 da ketgan deb belgiladi." },
    { id: uid(), at: `${addDays(today, -1)} 16:40`, actor: boss.name, action: "Yangi filial qo'shdi: Toshkent filiali." },
  ];
}

function genNotifications(users) {
  const today = todayISO();
  return [
    { id: uid(), forRole: "boss", text: "Anvar Tursunov 2 kundan beri ishga kelmadi.", at: today, read: false },
    { id: uid(), forRole: "boss", text: "Bu oy maosh xarajati o'tgan oyga nisbatan 4.7% oshdi.", at: today, read: false },
    { id: uid(), forRole: "boss", text: "3 ta xodim ta'til so'rovi kutmoqda.", at: today, read: false },
  ];
}

export function seedState() {
  const branches = [
    { id: uid(), name: "Chilonzor filiali" },
    { id: uid(), name: "Yunusobod filiali" },
    { id: uid(), name: "Sergeli filiali" },
  ];
  const users = makeUsers(branches);
  const boss = users.find((u) => u.role === "boss");
  const admins = users.filter((u) => u.role === "admin");

  return {
    branches,
    users,
    attendance: genAttendance(users),
    adjustments: genAdjustments(users, boss),
    sales: genSales(users),
    leaveRequests: genLeaveRequests(users),
    auditLog: genAuditLog(boss, admins),
    notifications: genNotifications(users),
    evaluations: [],
    transfers: [],
  };
}

export function loadState() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const saved = JSON.parse(raw);
    // Older demo data remains usable when new modules are introduced.
    return {
      ...saved,
      evaluations: Array.isArray(saved.evaluations) ? saved.evaluations : [],
      transfers: Array.isArray(saved.transfers) ? saved.transfers : [],
      notifications: Array.isArray(saved.notifications) ? saved.notifications : [],
      auditLog: Array.isArray(saved.auditLog) ? saved.auditLog : [],
    };
  } catch {
    return null;
  }
}

export function saveState(state) {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch (e) {
    console.error("Saqlashda xato:", e);
  }
}

export function resetState() {
  const s = seedState();
  saveState(s);
  return s;
}

export function logAction(state, actor, action) {
  const entry = { id: uid(), at: new Date().toLocaleString("uz-UZ"), actor, action };
  return { ...state, auditLog: [entry, ...state.auditLog] };
}

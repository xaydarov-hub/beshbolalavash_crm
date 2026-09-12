import { loginKey } from '../src/lib/identity.js';
import { EVALUATION_CRITERIA } from '../src/lib/evaluation.js';
import { isDeepStrictEqual } from 'node:util';
import { JOB_ROLES } from '../src/lib/roles.js';
import { todayISO } from '../src/lib/utils.js';

const date = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
const time = value => typeof value === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
const text = (value, max = 200) => typeof value === 'string' && value.trim().length > 0 && value.length <= max;
const money = value => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1e12;
const fail = message => { throw Object.assign(new Error(message), { status: 400 }); };

export function validateChanges(current, next, changes, session) {
  const userById = new Map(next.users.map(user => [user.id, user]));
  const branchIds = new Set(next.branches.map(branch => branch.id));
  for (const { collection, id, before, after: row } of changes) {
    if (['salaryEntries', 'salarySettlements', 'trash'].includes(collection)) fail('Maosh yozuvlari uchun maosh kiritish, yakunlash yoki korzinka amalidan foydalaning.');
    if (!before && row && (current[collection] || []).some(existing => existing.id === id)) throw Object.assign(new Error('Bu yozuv identifikatori allaqachon mavjud.'), { status: 409 });
    if (!row) {
      if (collection === 'branches' && ['salaryEntries', 'salarySettlements', 'trash'].some(key => (current[key] || []).some(record => record.branchId === before.id))) fail('Bu filialga tegishli maosh yoki yakunlash tarixi bor. Filialni o‘chirish mumkin emas.');
      if (collection === 'users') fail('Xodim tarixini saqlash uchun uni arxivlang.');
      if (['transfers', 'payrollHistory'].includes(collection)) fail('Saqlangan tarix o‘chirilmaydi. Yangi yozuv yoki hisobot versiyasini yarating.');
      if (collection === 'branches' && (next.users.some(u => u.branchId === before.id) || next.transfers.some(r => r.fromBranchId === before.id || r.toBranchId === before.id))) fail('Bu filialga bog‘langan xodim yoki ko‘chirish tarixi bor.');
      continue;
    }
    if (collection === 'users') {
      // Closing a malformed legacy account changes only its active flag and end date.
      if (before && before.id !== session.id && before.role !== 'boss' && row.active === false && date(row.endDate) && isDeepStrictEqual(row, { ...before, active: false, endDate: row.endDate })) continue;
      if (!text(row.name) || !text(row.phone, 100) || !loginKey(row.phone)) fail('Ism va telefon/loginni to‘liq kiriting.');
      if (!['boss', 'admin', 'employee'].includes(row.role)) fail('Rol noto‘g‘ri.');
      if (row.jobRole !== undefined && (row.role === 'employee' ? !JOB_ROLES.some(job => job.id === row.jobRole) : row.jobRole !== row.role)) fail('Lavozim va tizimga kirish huquqi mos emas. Lavozimni qayta tanlang.');
      if (!text(row.position)) fail('Lavozimni tanlang yoki kiriting.');
      if (row.role === 'boss' && (!before || before.role !== 'boss')) fail('Yangi boshliq hisobi bu yerda yaratilmaydi.');
      if (before?.id === session.id && (row.role !== before.role || row.active === false)) fail('O‘z boshqaruv hisobingizni o‘chira olmaysiz.');
      if (row.role !== 'boss' && !branchIds.has(row.branchId)) fail('Xodim yoki admin uchun mavjud filialni tanlang.');
      if (row.active !== undefined && typeof row.active !== 'boolean') fail('Hisob holati noto‘g‘ri.');
      const allUsers = new Map(current.users.map(user => [user.id, user]));
      next.users.forEach(user => allUsers.set(user.id, user));
      if ([...allUsers.values()].some(u => u.id !== row.id && loginKey(u.phone) === loginKey(row.phone))) fail('Bu telefon yoki login allaqachon band.');
      if (!['oylik', 'kunlik', 'soatlik', 'foiz'].includes(row.salaryType) || !money(row.rate) || (row.salaryType === 'foiz' && row.rate > 100)) fail('Maosh turi yoki stavkasi noto‘g‘ri.');
      if (!time(row.workStart) || !time(row.workEnd) || !date(row.hireDate)) fail('Ish vaqti yoki ishga kirish sanasi noto‘g‘ri.');
      if (row.endDate && !date(row.endDate)) fail('Ish tugash sanasi noto‘g‘ri.');
      if (row.passwordHash !== undefined || row.authVersion !== before?.authVersion) fail('Hisobning himoya maydonlarini o‘zgartirish mumkin emas.');
      const password = row.customPassword || row.year;
      if ((!before && !password) || (password && (typeof password !== 'string' || password.trim().length < 4 || password.length > 1024))) fail('Boshlang‘ich parol kamida 4 belgidan iborat bo‘lsin.');
    }
    if (collection === 'branches' && (!text(row.name) || next.branches.some(b => b.id !== row.id && b.name.trim().toLowerCase() === row.name.trim().toLowerCase()))) fail('Filial nomi bo‘sh yoki takrorlangan.');
    if (['attendance', 'adjustments', 'evaluations', 'leaveRequests', 'transfers'].includes(collection) && !userById.has(row.employeeId)) fail('Xodim topilmadi. Ro‘yxatni yangilang.');
    if (['attendance', 'adjustments', 'evaluations'].includes(collection) && !date(row.date)) fail('Sanani to‘g‘ri kiriting.');
    if (collection === 'attendance') {
      if (!['keldi', 'kelmadi', 'tatil', 'kasal'].includes(row.status)) fail('Davomat holati noto‘g‘ri.');
      if ((row.checkIn && !time(row.checkIn)) || (row.checkOut && !time(row.checkOut))) fail('Vaqtni HH:MM formatida kiriting.');
    }
    if (collection === 'adjustments' && (!['bonus', 'jarima'].includes(row.type) || !money(row.amount) || row.amount <= 0 || !text(row.comment, 2000))) fail('Bonus/jarima uchun musbat summa va sabab kerak.');
    if (collection === 'evaluations' && EVALUATION_CRITERIA.some(c => typeof row.scores?.[c.id] !== 'number' || !Number.isFinite(row.scores[c.id]) || row.scores[c.id] < 0 || row.scores[c.id] > 5)) fail('Har bir mezon 0–5 ball oralig‘ida bo‘lsin.');
    if (collection === 'leaveRequests') {
      if (!date(row.from) || !date(row.to) || row.to < row.from || (Date.parse(row.to) - Date.parse(row.from)) / 86400000 > 365 || !text(row.reason, 2000) || !['tatil', 'kasal'].includes(row.type) || !['kutilmoqda', 'tasdiqlandi', 'radetildi'].includes(row.status)) fail('Ta’til sanalari, turi yoki sababi noto‘g‘ri. Davr bir yildan oshmasin.');
      if (before && before.status !== 'kutilmoqda' && row.status !== before.status) fail('Bu so‘rov bo‘yicha qaror allaqachon saqlangan.');
      if (before && ['employeeId', 'from', 'to', 'type', 'reason'].some(key => before[key] !== row[key])) fail('Yuborilgan so‘rov matni va sanalarini o‘zgartirish mumkin emas.');
      if (!before && row.status !== 'kutilmoqda') fail('Yangi so‘rov kutilmoqda holatida yuboriladi.');
    }
    if (collection === 'transfers') {
      if (before) fail('Ko‘chirish tarixi o‘zgartirilmaydi. Yangi ko‘chirish yarating.');
      const employee = current.users.find(u => u.id === row.employeeId);
      if (!branchIds.has(row.toBranchId) || row.fromBranchId === row.toBranchId || !date(row.effectiveDate) || row.effectiveDate > todayISO() || employee?.branchId !== row.fromBranchId || employee.role !== 'employee' || employee.active === false) fail('Ko‘chirish filiali yoki sanasi noto‘g‘ri.');
      if (changes.filter(change => change.collection === 'transfers' && change.after?.employeeId === row.employeeId).length > 1) fail('Bir xodimni bir saqlashda bir marta ko‘chirish mumkin.');
    }
    if (collection === 'payrollHistory') {
      if (before) fail('Saqlangan hisobot o‘zgartirilmaydi. Yangi versiyasini saqlang.');
      if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(row.month) || !Array.isArray(row.employees) || !row.employees.length || row.employees.some(employee => !userById.has(employee.employeeId)) || new Set(row.employees.map(employee => employee.employeeId)).size !== row.employees.length || !Number.isFinite(row.total)) fail('Oylik hisoboti noto‘g‘ri.');
    }
  }
}

import { addDays, isLate, uid, fmt } from '../src/lib/utils.js';
import { computeEmployeeReport } from '../src/lib/salary.js';

// A new request pings the branch's admin and the boss; neither has to be watching the tab.
function notifyReviewers(notifications, employee, text) {
  const at = new Date().toISOString();
  return [...(notifications || []),
    { id: uid(), forRole: 'admin', branchId: employee.branchId, text, at, read: false },
    { id: uid(), forRole: 'boss', text, at, read: false },
  ];
}
// A decision pings back the employee who asked, whether it was approved or not.
function notifyRequester(notifications, employeeId, text) {
  return [...(notifications || []), { id: uid(), employeeId, text, at: new Date().toISOString(), read: false }];
}

// Business side effects share the same durable transaction as the requested edit.
export function applyWorkflowEffects(current, input, changes, session) {
  let next = { ...input };
  for (const { collection, before, after } of changes) {
    if (!after) continue;
    if (collection === 'transfers' && !before) {
      next.users = next.users.map(user => user.id === after.employeeId ? { ...user, branchId: after.toBranchId } : user);
      next.transfers = next.transfers.map(row => row.id === after.id ? { ...row, by: session.name, actorId: session.id } : row);
    }
    if (collection === 'leaveRequests') {
      const employee = next.users.find(user => user.id === after.employeeId);
      next.leaveRequests = next.leaveRequests.map(row => row.id === after.id ? {
        ...row, branchId: employee.branchId,
        ...(!before ? { requestedAt: new Date().toISOString() } : { decidedBy: session.name, decidedAt: new Date().toISOString() }),
      } : row);
      if (after.status === 'tasdiqlandi' && before?.status === 'kutilmoqda') {
        const byDate = new Map(next.attendance.map(row => [`${row.employeeId}:${row.date}`, row]));
        for (let date = after.from; date <= after.to; date = addDays(date, 1)) {
          const key = `${after.employeeId}:${date}`;
          const existing = byDate.get(key);
          if (existing?.status === 'keldi') continue;
          byDate.set(key, { id: existing?.id || uid(), employeeId: after.employeeId, date, status: after.type, checkIn: '', checkOut: '', late: false, by: session.name });
        }
        next.attendance = [...byDate.values()];
      }
      const kind = after.type === 'kasal' ? 'kasallik' : "ta'til";
      if (!before) next.notifications = notifyReviewers(next.notifications, employee, `${employee.name} ${kind} so'rovi yubordi: ${after.from} — ${after.to}.`);
      else if (before.status === 'kutilmoqda' && after.status !== 'kutilmoqda') next.notifications = notifyRequester(next.notifications, after.employeeId, `Sizning ${after.from} — ${after.to} ${kind} so'rovingiz ${after.status === 'tasdiqlandi' ? 'tasdiqlandi' : 'rad etildi'}.`);
    }
    if (collection === 'advances') {
      const employee = next.users.find(user => user.id === after.employeeId);
      next.advances = next.advances.map(row => row.id === after.id ? {
        ...row, branchId: employee.branchId,
        ...(!before ? { requestedAt: new Date().toISOString() } : { decidedBy: session.name, decidedAt: new Date().toISOString() }),
      } : row);
      if (!before) next.notifications = notifyReviewers(next.notifications, employee, `${employee.name} avans so'radi: ${fmt(after.amount)} so'm.`);
      else if (before.status === 'kutilmoqda' && after.status !== 'kutilmoqda') next.notifications = notifyRequester(next.notifications, after.employeeId, `Sizning ${fmt(after.amount)} so'mlik avans so'rovingiz ${after.status === 'tasdiqlandi' ? 'tasdiqlandi' : 'rad etildi'}.`);
    }
    if (collection === 'attendance') {
      const employee = next.users.find(user => user.id === after.employeeId);
      next.attendance = next.attendance.map(row => row.id === after.id ? {
        ...row, by: session.name,
        ...(row.status === 'keldi' ? { late: isLate(row.checkIn, employee.workStart) } : { checkIn: '', checkOut: '', late: false }),
      } : row);
    }
    if (collection === 'adjustments') next.adjustments = next.adjustments.map(row => row.id === after.id ? { ...row, by: session.name } : row);
    if (collection === 'evaluations') next.evaluations = next.evaluations.map(row => row.id === after.id ? { ...row, assessedBy: session.name, updatedAt: new Date().toISOString() } : row);
  }
  // Compute reports after all attendance, leave, and adjustment changes have applied.
  for (const { collection, after } of changes) {
    if (collection !== 'payrollHistory' || !after) continue;
    const employees = after.employees.map(({ employeeId }) => {
      const report = computeEmployeeReport(next, employeeId, after.month);
      return { employeeId, name: report.emp.name, branchId: report.emp.branchId, worked: report.worked, hours: report.totalHours, sales: report.sales, saleRecords: report.saleRecords, salaryEntryCommission: report.salaryEntryCommission, salaryEntryRawAmount: report.salaryEntryRawAmount, base: report.base, bonuses: report.bonuses, fines: report.fines, advances: report.advances, total: report.total };
    });
    next.payrollHistory = next.payrollHistory.map(row => row.id === after.id ? {
      id: row.id, month: after.month, branchId: session.role === 'admin' ? session.branchId : (after.branchId || 'all'),
      employees, total: employees.reduce((sum, employee) => sum + employee.total, 0), createdAt: new Date().toISOString(), savedBy: session.name,
    } : row);
  }
  const auditIds = new Set((current.auditLog || []).map(row => row.id));
  next.auditLog = (next.auditLog || []).map(row => !auditIds.has(row.id) ? { ...row, actor: session.name, actorId: session.id, at: new Date().toISOString() } : row);
  return next;
}

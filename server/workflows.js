import { addDays, isLate, uid } from '../src/lib/utils.js';
import { computeEmployeeReport } from '../src/lib/salary.js';

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
      return { employeeId, name: report.emp.name, branchId: report.emp.branchId, worked: report.worked, hours: report.totalHours, sales: report.sales, saleRecords: report.saleRecords, salaryEntryCommission: report.salaryEntryCommission, salaryEntryRawAmount: report.salaryEntryRawAmount, base: report.base, bonuses: report.bonuses, fines: report.fines, total: report.total };
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

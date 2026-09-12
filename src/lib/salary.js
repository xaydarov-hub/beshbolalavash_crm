import { hoursBetween, monthKey } from "./utils.js";
import { employeeEvaluationStats } from "./evaluation.js";

export const SALARY_TYPES = [
  { id: "oylik", label: "Oylik (fiks)" },
  { id: "kunlik", label: "Kunlik stavka" },
  { id: "soatlik", label: "Soatlik stavka" },
  { id: "foiz", label: "Foizli (savdodan %)" },
];

// Compute a single employee's stats + salary for a given month.
export function computeEmployeeReport(state, employeeId, month) {
  const emp = state.users.find((u) => u.id === employeeId);
  if (!emp) return null;

  const att = state.attendance.filter(
    (a) => a.employeeId === employeeId && monthKey(a.date) === month
  );
  const worked = att.filter((a) => a.status === "keldi");
  const absentDays = att.filter((a) => a.status === "kelmadi").length;
  const leaveDays = att.filter((a) => a.status === "tatil" || a.status === "kasal").length;
  const lateDays = worked.filter((a) => a.late).length;

  const totalHours = worked.reduce((s, a) => s + hoursBetween(a.checkIn, a.checkOut), 0);

  const adj = state.adjustments.filter(
    (a) => a.employeeId === employeeId && monthKey(a.date) === month
  );
  const bonuses = adj.filter((a) => a.type === "bonus").reduce((s, a) => s + (Number(a.amount) || 0), 0);
  const fines = adj.filter((a) => a.type === "jarima").reduce((s, a) => s + (Number(a.amount) || 0), 0);

  const saleRecords = (state.dailySales || []).filter(a => a.employeeId === employeeId && monthKey(a.date) === month);
  const salaryEntryRecords = (state.salaryEntries || []).filter(entry => entry.employeeId === employeeId && !entry.isDeleted && monthKey(entry.date) === month);
  const salaryEntryCommission = salaryEntryRecords.reduce((sum, entry) => sum + (Number(entry.calculatedAmount) || 0), 0);
  const salaryEntryRawAmount = salaryEntryRecords.reduce((sum, entry) => sum + (Number(entry.rawAmount) || 0), 0);
  const legacySales = Number(state.sales?.[`${employeeId}:${month}`]) || 0;
  const sales = legacySales + saleRecords.reduce((sum, a) => sum + (Number(a.amount) || 0), 0);

  let base = 0;
  const rate = Number(emp.rate) || 0;
  switch (emp.salaryType) {
    case "oylik":
      base = (emp.hireDate && month < monthKey(emp.hireDate)) || (emp.endDate && month > monthKey(emp.endDate)) ? 0 : rate;
      break;
    case "kunlik":
      base = rate * worked.length;
      break;
    case "soatlik":
      base = rate * totalHours;
      break;
    case "foiz":
      base = Math.round(legacySales * rate / 100) + saleRecords.reduce((sum, a) => sum + Math.round(a.amount * a.rate / 100), 0);
      break;
    default:
      base = 0;
  }

  // Entries are additive commission records; closing a cycle never adds them twice.
  base += salaryEntryCommission;
  const total = base + bonuses - fines;
  const evaluation = employeeEvaluationStats(state, employeeId, month);

  return {
    emp,
    worked: worked.length,
    absentDays,
    leaveDays,
    lateDays,
    totalHours,
    bonuses,
    fines,
    sales,
    saleRecords,
    salaryEntryRecords,
    salaryEntryCommission,
    salaryEntryRawAmount,
    legacySales,
    base,
    total,
    evaluation,
    attRecords: att,
    adjRecords: adj,
  };
}

export function computeAllReports(state, month, branchId) {
  return state.users
    .filter((u) => u.role === "employee")
    .filter((u) => !branchId || branchId === "all" || u.branchId === branchId)
    .map((u) => computeEmployeeReport(state, u.id, month));
}

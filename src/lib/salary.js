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
  const bonuses = adj.filter((a) => a.type === "bonus").reduce((s, a) => s + a.amount, 0);
  const fines = adj.filter((a) => a.type === "jarima").reduce((s, a) => s + a.amount, 0);

  const sales = state.sales[`${employeeId}:${month}`] || 0;

  let base = 0;
  const rate = emp.rate || 0;
  switch (emp.salaryType) {
    case "oylik":
      base = rate;
      break;
    case "kunlik":
      base = rate * worked.length;
      break;
    case "soatlik":
      base = rate * totalHours;
      break;
    case "foiz":
      base = sales * (rate / 100);
      break;
    default:
      base = 0;
  }

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

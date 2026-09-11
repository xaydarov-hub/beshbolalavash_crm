export function managesEmployee(session, employee) {
  return employee?.role === 'employee' && (session?.role === 'boss' || (session?.role === 'admin' && Boolean(session.branchId) && employee.branchId === session.branchId));
}

export function validDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value || '') && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
}

export function sameRecord(left, right) {
  return JSON.stringify(left ?? null) === JSON.stringify(right ?? null);
}

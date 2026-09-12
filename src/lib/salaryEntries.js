export const TRASH_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

export function calculateCommission(rawAmount, rate) {
  const amount = Number(rawAmount), percent = Number(rate);
  if (!Number.isFinite(amount) || amount < 0 || amount > 1e12 || !Number.isFinite(percent) || percent < 0 || percent > 100) throw new Error('Summa yoki foiz stavkasi noto‘g‘ri.');
  return amount * percent / 100;
}

export function loadSalaryEntriesForBranch(entries, branchId, { deleted = false } = {}) {
  return (entries || []).filter(entry => entry.branchId === branchId && Boolean(entry.isDeleted) === deleted);
}

export function restoreAllowed(entry, now = Date.now()) {
  return entry?.isDeleted === true && Number.isFinite(Date.parse(entry.expiresAt)) && Date.parse(entry.expiresAt) > now;
}

export function salaryMoney(value) {
  return new Intl.NumberFormat('uz-UZ', { maximumFractionDigits: 4 }).format(Number(value) || 0);
}

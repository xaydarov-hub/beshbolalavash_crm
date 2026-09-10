export function uid() {
  return globalThis.crypto?.randomUUID?.() || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

export function fmt(n) {
  return Math.round(n || 0)
    .toLocaleString("ru-RU")
    .replace(/,/g, " ");
}

export function todayISO() {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en", { timeZone: "Asia/Tashkent", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date()).map(p => [p.type, p.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function monthKey(dateStr) {
  return (dateStr || todayISO()).slice(0, 7);
}

export function addDays(dateStr, days) {
  const d = new Date(dateStr);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function hoursBetween(checkIn, checkOut) {
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(checkIn) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(checkOut)) return 0;
  const [h1, m1] = checkIn.split(":").map(Number);
  const [h2, m2] = checkOut.split(":").map(Number);
  let mins = h2 * 60 + m2 - (h1 * 60 + m1);
  if (mins < 0) mins += 24 * 60;
  return mins / 60;
}

export function isLate(checkIn, workStart = "08:00") {
  return Boolean(checkIn && workStart && checkIn > workStart);
}

export function fmtHours(h) {
  const minutes = Number.isFinite(h) ? Math.max(0, Math.round(h * 60)) : 0;
  const hh = Math.floor(minutes / 60);
  const mm = minutes % 60;
  return `${hh} soat${mm ? " " + mm + " daq" : ""}`;
}

export function dateLabel(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleDateString("uz-UZ", { day: "2-digit", month: "2-digit" });
}

export function uid() {
  return Math.random().toString(36).slice(2, 10);
}

export function fmt(n) {
  return Math.round(n || 0)
    .toLocaleString("ru-RU")
    .replace(/,/g, " ");
}

export function todayISO() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tashkent", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

export function monthKey(dateStr) {
  return (dateStr || todayISO()).slice(0, 7);
}

export function addDays(dateStr, days) {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export function hoursBetween(checkIn, checkOut) {
  if (!checkIn || !checkOut) return 0;
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
  const hh = Math.floor(h);
  const mm = Math.round((h - hh) * 60);
  return `${hh} soat${mm ? " " + mm + " daq" : ""}`;
}

export function dateLabel(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleDateString("uz-UZ", { day: "2-digit", month: "2-digit" });
}

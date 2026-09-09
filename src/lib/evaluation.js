import { monthKey } from "./utils.js";

export const EVALUATION_CRITERIA = [
  { id: "greeting", label: "Mehmonni eshik oldida kutib olib, skript bo'yicha kuzatishi", max: 5, top: true },
  { id: "service", label: "Tabassum va muomala madaniyatiga rioya qilishi", max: 5, top: true },
  { id: "order", label: "Buyurtmani kassaga/dasturga xatosiz kiritishi", max: 5, top: true },
  { id: "tableCheck", label: "Mehmon stolini kamida 3 marta nazorat qilishi", max: 5, top: true },
  { id: "tableClean", label: "Stol ustini toza saqlashi va bo'sh idishlarni vaqtida olib ketishi", max: 5, top: true },
  { id: "uniform", label: "Forma va bejigi toza, tartibli bo'lishi", max: 5 },
  { id: "menu", label: "Menyu bilan ishlashi va taom tanlashda yordam berishi", max: 5 },
  { id: "upsell", label: "Yangi mahsulotlarni mehmonlarga tavsiya qilishi", max: 5 },
  { id: "serving", label: "Taom va ichimliklarni belgilangan tartibda olib borishi", max: 5 },
  { id: "area", label: "Biriktirilgan hududining tozaligi va tartibi", max: 5 },
  { id: "family", label: "Oilaviy mehmonlar uchun stol va bolalar sharoitini moslashtirishi", max: 5 },
  { id: "tasks", label: "Rahbar/admin topshiriqlarini o'z vaqtida bajarishi", max: 5 },
];

export const MAX_EVALUATION_SCORE = 5;

export function emptyScores() {
  return Object.fromEntries(EVALUATION_CRITERIA.map((item) => [item.id, 0]));
}

export function normalizeScores(scores = {}) {
  return Object.fromEntries(EVALUATION_CRITERIA.map((item) => {
    const value = Number(scores[item.id]);
    return [item.id, Number.isFinite(value) ? Math.max(0, Math.min(item.max, value)) : 0];
  }));
}

export function evaluationTotal(scores) {
  return Object.values(normalizeScores(scores)).reduce((sum, value) => sum + value, 0) / EVALUATION_CRITERIA.length;
}

export function employeeEvaluationStats(state, employeeId, month) {
  const records = (state.evaluations || []).filter(
    (record) => record.employeeId === employeeId && monthKey(record.date) === month
  );
  const total = records.reduce((sum, record) => sum + evaluationTotal(record.scores), 0);
  return {
    records,
    total,
    count: records.length,
    average: records.length ? total / records.length : 0,
  };
}

// Preserve the relative value of historical weighted criteria, once only.
export function migrateEvaluations(records = []) {
  const oldMax = [15, 15, 15, 10, 10, 5, 8, 5, 5, 5, 2, 5];
  return records.map(record => {
    if (record.scaleVersion === 2) return record;
    const scores = Object.fromEntries(EVALUATION_CRITERIA.map((criterion, index) =>
      [criterion.id, Math.round(Math.max(0, Math.min(oldMax[index], Number(record.scores?.[criterion.id]) || 0)) / oldMax[index] * 50) / 10]));
    return { ...record, legacyScores: record.scores, scores, total: evaluationTotal(scores), scaleVersion: 2 };
  });
}

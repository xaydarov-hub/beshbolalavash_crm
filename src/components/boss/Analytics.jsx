import ResponsiveTable from "../ResponsiveTable.jsx";
import React from "react";
import { fmt, todayISO, monthKey, addDays } from "../../lib/utils.js";
import { computeAllReports } from "../../lib/salary.js";

export default function Analytics({ state }) {
  const today = todayISO();
  const thisMonth = monthKey(today);
  const lastMonth = monthKey(addDays(today, -30));

  const thisReports = computeAllReports(state, thisMonth, "all");
  const lastReports = computeAllReports(state, lastMonth, "all");

  const totalHoursThis = thisReports.reduce((s, r) => s + r.totalHours, 0);
  const totalHoursLast = lastReports.reduce((s, r) => s + r.totalHours, 0) || 1;
  const hoursChangePct = Math.round(((totalHoursThis - totalHoursLast) / totalHoursLast) * 100);

  const salaryThis = thisReports.reduce((s, r) => s + r.total, 0);
  const salaryLast = lastReports.reduce((s, r) => s + r.total, 0) || 1;
  const salaryChangePct = (((salaryThis - salaryLast) / salaryLast) * 100).toFixed(1);

  const lateFlags = thisReports.filter((r) => r.lateDays >= 3);
  const topWorked = [...thisReports].sort((a, b) => b.totalHours - a.totalHours)[0];
  const mostLate = [...thisReports].sort((a, b) => b.lateDays - a.lateDays)[0];

  const insights = [
    { icon: hoursChangePct >= 0 ? "📈" : "📉", text: `Bu oy xodimlarning umumiy ish vaqti o'tgan oyga nisbatan ${Math.abs(hoursChangePct)}% ${hoursChangePct >= 0 ? "oshdi" : "kamaydi"}.` },
    { icon: "⚠️", text: `${lateFlags.length} ta xodim 3 martadan ko'p kechikdi.` },
    { icon: salaryChangePct >= 0 ? "💰" : "💸", text: `O'tgan oyga nisbatan maosh xarajati ${Math.abs(salaryChangePct)}% ${salaryChangePct >= 0 ? "oshgan" : "kamaygan"}.` },
    topWorked ? { icon: "🏆", text: `Eng ko'p ishlagan: ${topWorked.emp.name} — ${Math.round(topWorked.totalHours)} soat.` } : null,
    mostLate && mostLate.lateDays > 0 ? { icon: "⚠️", text: `Eng ko'p kechikkan: ${mostLate.emp.name} — ${mostLate.lateDays} marta.` } : null,
  ].filter(Boolean);

  const scored = thisReports.filter(r => r.evaluation.count).map(r => ({ emp: r.emp, score: r.evaluation.average.toFixed(1) })).sort((a,b) => b.score - a.score);

  const medals = ["🥇", "🥈", "🥉"];

  return (
    <div>
      <h3 className="section-title">📊 Avtomatik tahlil</h3>
      <div className="insight-list section-gap">
        {insights.map((i, idx) => (
          <div key={idx} className="insight-item">{i.icon} {i.text}</div>
        ))}
      </div>

      <h3 className="section-title">🏆 Xodimlar reytingi (bu oy)</h3>
      <ResponsiveTable>
        {scored.map((s, idx) => (
          <div key={s.emp.id} className="rank-item">
            <div className="rank-medal">{medals[idx] || idx + 1}</div>
            <div style={{ flex: 1 }}>{s.emp.name} <span className="muted" style={{ fontSize: 12 }}>· {s.emp.position}</span></div>
            <div style={{ fontWeight: 700 }}>{s.score} / 5 ball</div>
          </div>
        ))}
      </ResponsiveTable>
    </div>
  );
}

import React, { useState } from "react";
import { fmt, todayISO, monthKey } from "../lib/utils.js";
import { evaluationTotal } from "../lib/evaluation.js";
import { salaryMoney } from '../lib/salaryEntries.js';
export default function EmployeeHistory({ state, employeeId }) {
  const [month, setMonth] = useState(monthKey(todayISO()));
  const events = [
    ...(state.salaryEntries || []).filter(entry => !entry.isDeleted).map(entry => ({ ...entry, kind: 'Maosh yozuvi', text: `${salaryMoney(entry.rawAmount)} so‘m × ${entry.rate}% = ${salaryMoney(entry.calculatedAmount)} so‘m · ${entry.isSettled ? '15 kunlik hisob yakunlangan' : 'Ochiq hisob'} · ${entry.note || ''}`, actor: entry.by })),
    ...(state.dailySales || []).map(r => ({ ...r, kind: "Savdo", text: `${fmt(r.amount)} so‘m × ${r.rate}% = ${fmt(r.amount * r.rate / 100)} so‘m. ${r.note || ""}`, actor: r.by })),
    ...(state.attendance || []).map(r => ({ ...r, kind: "Davomat", text: `${r.status} · ${r.checkIn || "—"} · ${r.checkOut || "—"}` })),
    ...(state.adjustments || []).map(r => ({ ...r, kind: r.type === "bonus" ? "Bonus" : "Jarima", text: `${fmt(r.amount)} so‘m · ${r.comment || ""}`, actor: r.by })),
    ...(state.evaluations || []).map(r => ({ ...r, kind: "Baho", text: `${evaluationTotal(r.scores).toFixed(1)} / 5 · ${r.comment || ""}`, actor: r.assessedBy })),
    ...(state.transfers || []).map(r => ({ ...r, date: r.date || r.effectiveDate || r.transferredAt?.slice(0,10) || r.createdAt?.slice(0,10), kind: "Filial o‘zgarishi", text: `${state.branches.find(b => b.id === r.fromBranchId)?.name || "—"} · ${state.branches.find(b => b.id === r.toBranchId)?.name || "—"}`, actor: r.by })),
    ...(state.leaveRequests || []).map(r => ({ ...r, date: r.from, kind: "Ta‘til", text: `${r.from} · ${r.to} · ${r.status} · ${r.reason}` })),
    ...(state.payrollHistory || []).flatMap(r => (r.employees || []).map(e => ({ ...e, id: `${r.id}:${e.employeeId}`, date: `${r.month}-01`, kind: "Saqlangan maosh", text: `${r.month}: ${fmt(e.total)} so‘m` }))),
  ].filter(r => r.employeeId === employeeId && (!month || r.date?.startsWith(month))).sort((a,b) => (b.date || "").localeCompare(a.date || ""));
  return <section className="section-gap"><h3 className="section-title">Xodim tarixi</h3>
    <label className="field">Davr<input type="month" className="input" value={month} onChange={e => setMonth(e.target.value)} /></label>
    <button className="btn btn-sm" onClick={() => setMonth("")}>Barcha tarix</button>
    <div className="history-list">{events.map((r, i) => <article className="card card-pad" key={`${r.kind}:${r.id}:${i}`}><div className="history-heading"><b>{r.kind}</b><time>{r.date || "Sana ko‘rsatilmagan"}</time></div><p>{r.text}</p>{r.actor && <small className="muted">{r.actor}</small>}{r.revisions?.length > 0 && <details><summary>O‘zgartirishlar ({r.revisions.length})</summary>{r.revisions.map((v,i) => <p key={i}>{v.updatedAt} · {v.by}: {fmt(v.amount)} so‘m, {v.rate}%</p>)}</details>}</article>)}</div>
    {!events.length && <div className="empty">Bu davr uchun yozuv yo‘q.</div>}
  </section>;
}

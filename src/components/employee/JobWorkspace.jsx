import React from "react";
import { getJobRole, jobLabel } from "../../lib/roles.js";
import { todayISO, fmt, fmtHours } from "../../lib/utils.js";

const WORKSPACES = {
  waiter: { title: "Xizmat va shaxsiy savdo", text: "Bugungi smenangiz, sizga yozilgan savdo va xizmat baholaringiz.", focus: "sales", action: "Savdo va foizim", quality: "Xizmat bahosi" },
  cashier: { title: "Kassirning ish hisoboti", text: "Sizga biriktirilgan savdo natijalari, ish vaqti va shaxsiy maosh hisobingiz.", focus: "sales", action: "Savdo hisobim", quality: "Ish sifati bahosi" },
  cook: { title: "Oshpazning smena hisoboti", text: "Oshxonadagi ish vaqtingiz, xizmat sifati baholari va hisoblangan ish haqingiz.", focus: "points", action: "Sifat baholarim", quality: "Oshxona xizmati bahosi" },
  baker: { title: "Nonvoyning smena hisoboti", text: "Smena davomati, ishlagan soatlaringiz va kunlik sifat baholaringiz.", focus: "attendance", action: "Smenalarim", quality: "Ish sifati bahosi" },
  delivery: { title: "Yetkazib beruvchining ish hisoboti", text: "Sizga yozilgan savdo, ish vaqti va xizmat sifati baholarini kuzating.", focus: "sales", action: "Savdo va ish haqim", quality: "Yetkazib berish xizmati bahosi" },
  cleaner: { title: "Tozalovchining smena hisoboti", text: "Davomatingiz, ish sifati bo‘yicha baholar va shaxsiy ish haqi hisobingiz.", focus: "points", action: "Ish sifati baholarim", quality: "Tozalik xizmati bahosi" },
  security: { title: "Qorovulning navbatchilik hisoboti", text: "Navbatchilik kunlaringiz, kelish-ketish vaqti va hisoblangan ish haqingiz.", focus: "attendance", action: "Navbatchilik tarixim", quality: "Ish sifati bahosi" },
  other: { title: "Shaxsiy ish hisoboti", text: "Davomat, maosh, baholar va ta’til so‘rovlaringiz bir joyda.", focus: "attendance", action: "Davomatim", quality: "Ish sifati bahosi" },
};
const STATUS = { keldi: "Ishda", kelmadi: "Kelmagan", tatil: "Ta’tilda", kasal: "Kasallik" };

export default function JobWorkspace({ state, session, report, hasSales, onNavigate }) {
  const workspace = WORKSPACES[getJobRole(session)] || WORKSPACES.other;
  const today = todayISO();
  const attendance = state.attendance.find(record => record.employeeId === session.id && record.date === today);
  const sale = (state.dailySales || []).find(record => record.employeeId === session.id && record.date === today);
  const approvedLeave = state.leaveRequests.filter(record => record.employeeId === session.id && record.status === "tasdiqlandi" && record.to >= today).sort((a, b) => a.from.localeCompare(b.from))[0];
  const focus = workspace.focus === "sales" && !hasSales ? "attendance" : workspace.focus;
  return <section className="card card-pad section-gap" aria-label={`${jobLabel(session)} ish maydoni`}>
    <h3 className="section-title">{workspace.title}</h3>
    <p className="hint">{workspace.text}</p>
    <div className="grid grid-3 section-gap">
      <div className="stat-card"><div className="label">Bugungi holat · {today}</div><div className="value">{STATUS[attendance?.status] || "Belgilanmagan"}</div><p className="hint">Smena: {session.workStart || "—"} – {session.workEnd || "—"}{attendance?.checkIn ? ` · Keldi: ${attendance.checkIn}` : ""}{attendance?.checkOut ? ` · Ketdi: ${attendance.checkOut}` : ""}</p></div>
      {hasSales ? <div className="stat-card"><div className="label">Bugungi shaxsiy savdo</div><div className="value">{fmt(sale?.amount || 0)}</div><p className="hint">{sale ? `Hisoblangan ish haqi: ${fmt(Math.round(sale.amount * sale.rate / 100))} so‘m` : "Bu sana uchun savdo hali saqlanmagan."}</p></div> : <div className="stat-card"><div className="label">Hisobot oyida ishlangan vaqt</div><div className="value">{fmtHours(report.totalHours)}</div><p className="hint">{report.worked} ta ish kuni</p></div>}
      <div className="stat-card"><div className="label">{workspace.quality}</div><div className="value">{report.evaluation.count ? `${report.evaluation.average.toFixed(1)} / 5` : "Hali baholanmagan"}</div><p className="hint">Hisobot oyida {report.evaluation.count} kun baholangan</p></div>
    </div>
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      <button className="btn btn-primary" onClick={() => onNavigate(focus)}>{focus !== workspace.focus ? "Davomatim" : workspace.action}</button>
      <button className="btn" onClick={() => onNavigate("leaves")}>Ta’til yoki kasallik so‘rovi</button>
      <button className="btn" onClick={() => onNavigate("profile")}>Mening profilim</button>
    </div>
    {approvedLeave && <p className="hint">Tasdiqlangan dam olish: {approvedLeave.from} – {approvedLeave.to}</p>}
  </section>;
}

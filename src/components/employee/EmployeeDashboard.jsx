import ResponsiveTable from "../ResponsiveTable.jsx";
import SalesPanel from "../SalesPanel.jsx";
import EmployeeHistory from "../EmployeeHistory.jsx";
import React, { useState } from "react";
import { fmt, todayISO, monthKey, fmtHours } from "../../lib/utils.js";
import { computeEmployeeReport, SALARY_TYPES } from "../../lib/salary.js";
import { uid } from "../../lib/utils.js";

export default function EmployeeDashboard({ state, persist, session, saveSale }) {
  const [tab, setTab] = useState("dashboard");
  const [month, setMonth] = useState(monthKey(todayISO()));
  const r = computeEmployeeReport(state, session.id, month);
  const branch = state.branches.find((b) => b.id === session.branchId);

  const myLeaves = state.leaveRequests.filter((l) => l.employeeId === session.id);

  return (
    <div>
      <div className="tabs">
        <button className={`tab-btn ${tab === "sales" ? "active" : ""}`} onClick={() => setTab("sales")}>Kunlik savdo</button>
        <button className={`tab-btn ${tab === "history" ? "active" : ""}`} onClick={() => setTab("history")}>Xodim tarixi</button>
        <button className={`tab-btn ${tab === "dashboard" ? "active" : ""}`} onClick={() => setTab("dashboard")}>🏠 Bosh sahifa</button>
        <button className={`tab-btn ${tab === "attendance" ? "active" : ""}`} onClick={() => setTab("attendance")}>🕐 Davomat tarixi</button>
        <button className={`tab-btn ${tab === "leaves" ? "active" : ""}`} onClick={() => setTab("leaves")}>🏖 Ta'til so'rash</button>
        <button className={`tab-btn ${tab === "points" ? "active" : ""}`} onClick={() => setTab("points")}>⭐ Ballarim</button>
        <button className={`tab-btn ${tab === "profile" ? "active" : ""}`} onClick={() => setTab("profile")}>👤 Profil</button>
      </div>
      {tab === "sales" && <SalesPanel state={state} session={session} saveSale={saveSale} />}

      {tab === "history" && <EmployeeHistory state={state} employeeId={session.id} />}
      <label className="field">Hisobot oyi<input type="month" className="input" value={month} onChange={e => setMonth(e.target.value)} /></label>
      {tab === "dashboard" && (
        <div>
          <p style={{ fontSize: 15, marginBottom: 18 }}>Salom, {session.name} 👋</p>
          <div className="grid grid-4 section-gap">
            <div className="stat-card"><div className="label">⏱ Ishlagan kun</div><div className="value">{r.worked}</div></div>
            <div className="stat-card"><div className="label">🏖 Dam olgan kun</div><div className="value">{r.absentDays + r.leaveDays}</div></div>
            <div className="stat-card"><div className="label">⏳ Ishlagan vaqt</div><div className="value">{fmtHours(r.totalHours)}</div></div>
            <div className="stat-card"><div className="label">💰 Bu oy maosh</div><div className="value accent">{fmt(r.total)} so'm</div></div>
          </div>
          <div className="grid grid-3 section-gap">
            <div className="stat-card"><div className="label">💼 Asosiy ({SALARY_TYPES.find(t=>t.id===session.salaryType)?.label})</div><div className="value">{fmt(r.base)}</div></div>
            <div className="stat-card"><div className="label">➕ Bonus</div><div className="value green">+{fmt(r.bonuses)}</div></div>
            <div className="stat-card"><div className="label">➖ Jarima</div><div className="value red">-{fmt(r.fines)}</div></div>
          </div>

          <h3 className="section-title">📝 Jarima va bonuslar tarixi</h3>
          <ResponsiveTable>
            {r.adjRecords.length === 0 && <div className="empty">Bu oyda yozuv yo'q.</div>}
            {[...r.adjRecords].reverse().map((a) => (
              <div key={a.id} className="trow" style={{ gridTemplateColumns: "1fr 2fr auto" }}>
                <span className="muted">{a.date}</span>
                <span className="muted">{a.comment}</span>
                <span style={{ color: a.type === "jarima" ? "var(--sauce)" : "var(--herb)", fontWeight: 600 }}>
                  {a.type === "jarima" ? "-" : "+"}{fmt(a.amount)}
                </span>
              </div>
            ))}
          </ResponsiveTable>
        </div>
      )}

      {tab === "attendance" && (
        <ResponsiveTable>
          <div className="trow thead" style={{ gridTemplateColumns: "0.8fr 1fr 1fr" }}>
            <div>Sana</div><div>Holati</div><div>Vaqt</div>
          </div>
          {[...r.attRecords].reverse().map((a) => (
            <div key={a.id} className="trow" style={{ gridTemplateColumns: "0.8fr 1fr 1fr" }}>
              <div>{a.date}</div>
              <div>
                <span className={`badge ${a.status === "keldi" ? "badge-green" : a.status === "kelmadi" ? "badge-red" : "badge-blue"}`}>
                  {a.status === "keldi" ? "Keldi" : a.status === "kelmadi" ? "Kelmadi" : a.status === "tatil" ? "Ta'til" : "Kasal"}
                </span>
                {a.late && <span className="badge badge-yellow" style={{ marginLeft: 6 }}>Kechikdi</span>}
              </div>
              <div className="muted">{a.status === "keldi" ? `${a.checkIn || "—"} – ${a.checkOut || "—"}` : "—"}</div>
            </div>
          ))}
          {r.attRecords.length === 0 && <div className="empty">Ma'lumot yo'q.</div>}
        </ResponsiveTable>
      )}

      {tab === "leaves" && <LeaveRequestForm state={state} persist={persist} session={session} myLeaves={myLeaves} />}

      {tab === "points" && (
        <div>
          <div className="grid grid-3 section-gap">
            <div className="stat-card"><div className="label">Bu oy jami ball</div><div className="value accent">{r.evaluation.total}</div></div>
            <div className="stat-card"><div className="label">Baholangan kunlar</div><div className="value">{r.evaluation.count}</div></div>
            <div className="stat-card"><div className="label">O'rtacha baho</div><div className="value green">{r.evaluation.count ? r.evaluation.average.toFixed(1) : "—"} / 5</div></div>
          </div>
          <ResponsiveTable>
            <div className="trow thead" style={{ gridTemplateColumns: "0.8fr 0.6fr 2fr 1fr" }}>
              <div>Sana</div><div>Ball</div><div>Izoh</div><div>Baholagan</div>
            </div>
            {r.evaluation.records.length === 0 && <div className="empty">Bu oy uchun hali baho qo'yilmagan.</div>}
            {[...r.evaluation.records].reverse().map((record) => (
              <div key={record.id} className="trow" style={{ gridTemplateColumns: "0.8fr 0.6fr 2fr 1fr" }}>
                <div>{record.date}</div><div><b>{(record.total ?? 0).toFixed(1)}</b> / 5</div><div className="muted">{record.comment || "—"}</div><div className="muted">{record.assessedBy}</div>
              </div>
            ))}
          </ResponsiveTable>
        </div>
      )}

      {tab === "profile" && (
        <div className="card card-pad" style={{ maxWidth: 480 }}>
          <div className="grid grid-2">
            <div><div className="muted" style={{ fontSize: 12 }}>📞 Telefon</div><div>{session.phone}</div></div>
            <div><div className="muted" style={{ fontSize: 12 }}>🏢 Filial</div><div>{branch?.name}</div></div>
            <div><div className="muted" style={{ fontSize: 12 }}>💼 Lavozim</div><div>{session.position}</div></div>
            <div><div className="muted" style={{ fontSize: 12 }}>📅 Ishga kirgan</div><div>{session.hireDate}</div></div>
          </div>
        </div>
      )}
    </div>
  );
}

function LeaveRequestForm({ persist, session, myLeaves }) {
  const [from, setFrom] = useState(todayISO());
  const [to, setTo] = useState(todayISO());
  const [type, setType] = useState("tatil");
  const [reason, setReason] = useState("");

  const submit = () => {
    if (!reason.trim()) { alert("Sababni yozing."); return; }
    if (to < from) { alert("Tugash sanasi boshlanish sanasidan oldin bo'lmasligi kerak."); return; }
    persist((s) => ({
      ...s,
      leaveRequests: [...s.leaveRequests, { id: uid(), employeeId: session.id, from, to, type, reason: reason.trim(), status: "kutilmoqda", requestedAt: todayISO() }],
    }));
    setReason("");
  };

  return (
    <div>
      <div className="card card-pad section-gap" style={{ maxWidth: 480 }}>
        <h3 className="section-title">Yangi so'rov</h3>
        <div className="grid grid-2">
          <label className="field"><div className="label">Boshlanish sanasi</div>
            <input type="date" className="input" value={from} onChange={(e) => setFrom(e.target.value)} /></label>
          <label className="field"><div className="label">Tugash sanasi</div>
            <input type="date" className="input" value={to} onChange={(e) => setTo(e.target.value)} /></label>
        </div>
        <label className="field"><div className="label">Turi</div>
          <select className="input" value={type} onChange={(e) => setType(e.target.value)}>
            <option value="tatil">Ta'til</option>
            <option value="kasal">Kasallik</option>
          </select></label>
        <label className="field"><div className="label">Sababi</div>
          <input className="input" value={reason} onChange={(e) => setReason(e.target.value)} /></label>
        <button className="btn btn-primary" onClick={submit}>Yuborish</button>
      </div>

      <h3 className="section-title">Mening so'rovlarim</h3>
      <ResponsiveTable>
        {myLeaves.length === 0 && <div className="empty">Hali so'rov yo'q.</div>}
        {[...myLeaves].reverse().map((l) => (
          <div key={l.id} className="trow" style={{ gridTemplateColumns: "0.7fr 1fr 1.4fr 1fr" }}>
            <span className={`badge ${l.type === "kasal" ? "badge-yellow" : "badge-blue"}`}>{l.type === "kasal" ? "Kasal" : "Ta'til"}</span>
            <span className="muted" style={{ fontSize: 12.5 }}>{l.from} — {l.to}</span>
            <span className="muted">{l.reason}</span>
            <span className={`badge ${l.status === "tasdiqlandi" ? "badge-green" : l.status === "radetildi" ? "badge-red" : "badge-gray"}`}>
              {l.status === "tasdiqlandi" ? "Tasdiqlandi" : l.status === "radetildi" ? "Rad etildi" : "Kutilmoqda"}
            </span>
          </div>
        ))}
      </ResponsiveTable>
    </div>
  );
}

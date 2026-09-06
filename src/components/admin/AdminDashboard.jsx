import React, { useState } from "react";
import { todayISO, fmtHours, hoursBetween, uid } from "../../lib/utils.js";
import { logAction } from "../../lib/db.js";
import EvaluationPanel from "../EvaluationPanel.jsx";
import EmployeeTransfer from "../EmployeeTransfer.jsx";

export default function AdminDashboard({ state, persist, session }) {
  const [tab, setTab] = useState("attendance");
  const [date, setDate] = useState(todayISO());
  const [showAbsentOnly, setShowAbsentOnly] = useState(false);
  const employees = state.users.filter((u) => u.role === "employee" && u.branchId === session.branchId);
  const branch = state.branches.find((b) => b.id === session.branchId);

  const getRec = (empId) => state.attendance.find((a) => a.employeeId === empId && a.date === date);

  let rows = employees.map((e) => ({ emp: e, rec: getRec(e.id) }));
  if (showAbsentOnly) rows = rows.filter((r) => !r.rec || r.rec.status !== "keldi");

  const summary = employees.reduce((acc, e) => {
    const st = getRec(e.id)?.status || "kelmadi";
    acc[st] = (acc[st] || 0) + 1;
    return acc;
  }, {});

  const updateStatus = (emp, patch) => {
    persist((s) => {
      const existing = s.attendance.find((a) => a.employeeId === emp.id && a.date === date);
      const normalizedPatch = patch.status && patch.status !== "keldi"
        ? { ...patch, checkIn: "", checkOut: "", late: false }
        : patch.checkIn !== undefined
          ? { ...patch, late: patch.checkIn > "08:00" }
          : patch;
      let attendance;
      if (existing) {
        attendance = s.attendance.map((a) => (a === existing ? { ...a, ...normalizedPatch } : a));
      } else {
        attendance = [...s.attendance, { id: uid(), employeeId: emp.id, date, status: "keldi", checkIn: "", checkOut: "", late: false, ...normalizedPatch }];
      }
      const next = { ...s, attendance };
      const label = normalizedPatch.status === "kelmadi" ? "kelmagan" : normalizedPatch.status === "tatil" ? "ta'tilda" : normalizedPatch.status === "kasal" ? "kasal" : normalizedPatch.checkIn !== undefined ? `${normalizedPatch.checkIn} da kelgan` : normalizedPatch.checkOut !== undefined ? `${normalizedPatch.checkOut} da ketgan` : "kelgan";
      return logAction(next, session.name, `${emp.name}ni ${date} kuni "${label}" deb belgiladi.`);
    });
  };

  const scopedEmployees = (employee) => employee.branchId === session.branchId;

  return (
    <div>
      <div className="tabs">
        <button className={`tab-btn ${tab === "attendance" ? "active" : ""}`} onClick={() => setTab("attendance")}>🕐 Davomat</button>
        <button className={`tab-btn ${tab === "evaluations" ? "active" : ""}`} onClick={() => setTab("evaluations")}>⭐ Ball baholash</button>
        <button className={`tab-btn ${tab === "transfer" ? "active" : ""}`} onClick={() => setTab("transfer")}>↔️ Xodim ko'chirish</button>
      </div>
      {tab === "evaluations" && <EvaluationPanel state={state} persist={persist} session={session} employeeScope={scopedEmployees} />}
      {tab === "transfer" && <EmployeeTransfer state={state} persist={persist} session={session} employeeScope={scopedEmployees} />}
      {tab === "attendance" && <>
      <h3 className="section-title">{branch?.name} — davomat</h3>
      <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
        <input type="date" className="input" style={{ width: 170 }} value={date} onChange={(e) => setDate(e.target.value)} />
        <button className={`btn btn-sm ${showAbsentOnly ? "btn-red" : ""}`} onClick={() => setShowAbsentOnly((v) => !v)}>
          🔴 Bugun kim kelmadi?
        </button>
        <span className="muted" style={{ fontSize: 12.5 }}>
          🟢 {summary.keldi || 0} · 🔴 {summary.kelmadi || 0} · 🟡 {summary.tatil || 0} · 🟣 {summary.kasal || 0}
        </span>
      </div>

      <div className="table-wrap">
        <div className="trow thead" style={{ gridTemplateColumns: "1.3fr 1fr 1fr 1fr 1fr" }}>
          <div>Xodim</div><div>Holati</div><div>Keldi</div><div>Ketdi</div><div>Ish vaqti</div>
        </div>
        {rows.map(({ emp, rec }) => {
          const r = rec || { status: "keldi", checkIn: "", checkOut: "" };
          const hrs = hoursBetween(r.checkIn, r.checkOut);
          return (
            <div key={emp.id} className="trow" style={{ gridTemplateColumns: "1.3fr 1fr 1fr 1fr 1fr" }}>
              <div>{emp.name} <span className="muted" style={{ fontSize: 11.5 }}>· {emp.position}</span></div>
              <select className="input" style={{ padding: "5px 8px" }} value={r.status}
                onChange={(e) => updateStatus(emp, { status: e.target.value })}>
                <option value="keldi">Keldi</option>
                <option value="kelmadi">Kelmadi</option>
                <option value="tatil">Ta'til</option>
                <option value="kasal">Kasal</option>
              </select>
              <input type="time" className="input" style={{ padding: "5px 8px" }} disabled={r.status !== "keldi"}
                value={r.checkIn} onChange={(e) => updateStatus(emp, { checkIn: e.target.value })} />
              <input type="time" className="input" style={{ padding: "5px 8px" }} disabled={r.status !== "keldi"}
                value={r.checkOut} onChange={(e) => updateStatus(emp, { checkOut: e.target.value })} />
              <div className="muted" style={{ fontSize: 12.5 }}>{r.status === "keldi" && r.checkIn && r.checkOut ? fmtHours(hrs) : "—"}</div>
            </div>
          );
        })}
        {rows.length === 0 && <div className="empty">Bu filialda xodim yo'q.</div>}
      </div>
      </>}
    </div>
  );
}

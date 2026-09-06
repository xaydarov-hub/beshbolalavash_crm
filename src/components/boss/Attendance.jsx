import React, { useState } from "react";
import { todayISO, fmtHours, hoursBetween } from "../../lib/utils.js";
import { logAction } from "../../lib/db.js";

const STATUS_LABEL = { keldi: "Keldi", kelmadi: "Kelmadi", tatil: "Ta'til", kasal: "Kasal" };
const STATUS_BADGE = { keldi: "badge-green", kelmadi: "badge-red", tatil: "badge-blue", kasal: "badge-yellow" };

export default function Attendance({ state, persist, session }) {
  const [date, setDate] = useState(todayISO());
  const [branchId, setBranchId] = useState("all");
  const [showAbsentOnly, setShowAbsentOnly] = useState(false);

  const employees = state.users
    .filter((u) => u.role === "employee" || u.role === "admin")
    .filter((u) => branchId === "all" || u.branchId === branchId);

  const getRec = (empId) => state.attendance.find((a) => a.employeeId === empId && a.date === date);

  let rows = employees.map((e) => ({ emp: e, rec: getRec(e.id) }));
  if (showAbsentOnly) rows = rows.filter((r) => !r.rec || r.rec.status !== "keldi");

  const summary = employees.reduce((acc, e) => {
    const rec = getRec(e.id);
    const st = rec?.status || "kelmadi";
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
        attendance = [...s.attendance, { id: crypto.randomUUID?.() || String(Math.random()), employeeId: emp.id, date, status: "keldi", checkIn: "", checkOut: "", late: false, ...normalizedPatch }];
      }
      const label = normalizedPatch.status === "kelmadi" ? "kelmagan" : normalizedPatch.status === "tatil" ? "ta'tilda" : normalizedPatch.status === "kasal" ? "kasal" : normalizedPatch.checkIn !== undefined ? `${normalizedPatch.checkIn} da kelgan` : normalizedPatch.checkOut !== undefined ? `${normalizedPatch.checkOut} da ketgan` : "kelgan";
      return logAction({ ...s, attendance }, session.name, `${emp.name}ni ${date} kuni "${label}" deb belgiladi.`);
    });
  };

  return (
    <div>
      <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
        <input type="date" className="input" style={{ width: 170 }} value={date} onChange={(e) => setDate(e.target.value)} />
        <select className="input" style={{ width: 220 }} value={branchId} onChange={(e) => setBranchId(e.target.value)}>
          <option value="all">Barcha filiallar</option>
          {state.branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
        <button className={`btn btn-sm ${showAbsentOnly ? "btn-red" : ""}`} onClick={() => setShowAbsentOnly((v) => !v)}>
          🔴 Bugun kim kelmadi?
        </button>
        <span className="muted" style={{ fontSize: 12.5 }}>
          🟢 {summary.keldi || 0} · 🔴 {summary.kelmadi || 0} · 🟡 {summary.tatil || 0} · 🟣 {summary.kasal || 0}
        </span>
      </div>

      <div className="table-wrap">
        <div className="trow thead" style={{ gridTemplateColumns: "1.3fr 1fr 1fr 1fr 1fr 0.8fr" }}>
          <div>Xodim</div><div>Holati</div><div>Keldi</div><div>Ketdi</div><div>Ish vaqti</div><div>Kechikish</div>
        </div>
        {rows.map(({ emp, rec }) => {
          const r = rec || { status: "keldi", checkIn: "", checkOut: "", late: false };
          const hrs = hoursBetween(r.checkIn, r.checkOut);
          return (
            <div key={emp.id} className="trow" style={{ gridTemplateColumns: "1.3fr 1fr 1fr 1fr 1fr 0.8fr" }}>
              <div>{emp.name}</div>
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
              <div>
                {r.status === "keldi" && (
                  <span className={`badge ${r.late ? "badge-yellow" : "badge-green"}`}>{r.late ? "Kechikdi" : "Vaqtida"}</span>
                )}
              </div>
            </div>
          );
        })}
        {rows.length === 0 && <div className="empty">Ma'lumot yo'q.</div>}
      </div>
    </div>
  );
}

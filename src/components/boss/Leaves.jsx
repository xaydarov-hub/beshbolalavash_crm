import React from "react";
import { logAction } from "../../lib/db.js";
import { addDays, uid } from "../../lib/utils.js";

export default function Leaves({ state, persist, session }) {
  const requests = [...state.leaveRequests].sort((a, b) => (a.status === "kutilmoqda" ? -1 : 1));

  const decide = (req, status) => {
    const emp = state.users.find((u) => u.id === req.employeeId);
    persist((s) => {
      let attendance = s.attendance;
      if (status === "tasdiqlandi") {
        const dates = [];
        for (let day = req.from; day <= req.to; day = addDays(day, 1)) dates.push(day);
        const byDate = new Map(s.attendance.map((item) => [`${item.employeeId}:${item.date}`, item]));
        dates.forEach((date) => {
          const key = `${req.employeeId}:${date}`;
          const existing = byDate.get(key);
          // A verified workday is never silently replaced by an approved leave.
          if (existing?.status === "keldi") return;
          byDate.set(key, { id: existing?.id || uid(), employeeId: req.employeeId, date, status: req.type, checkIn: "", checkOut: "", late: false });
        });
        attendance = Array.from(byDate.values());
      }
      return logAction(
      { ...s, attendance, leaveRequests: s.leaveRequests.map((r) => (r.id === req.id ? { ...r, status } : r)) },
      session.name,
      `${emp?.name} so'ragan ta'til/dam olishni ${status === "tasdiqlandi" ? "tasdiqladi" : "rad etdi"} (${req.from} — ${req.to}).`
      );
    });
  };

  return (
    <div className="table-wrap">
      <div className="trow thead" style={{ gridTemplateColumns: "1.1fr 0.7fr 1fr 1.4fr 1fr" }}>
        <div>Xodim</div><div>Turi</div><div>Sana</div><div>Sabab</div><div>Holati</div>
      </div>
      {requests.length === 0 && <div className="empty">So'rovlar yo'q.</div>}
      {requests.map((r) => {
        const emp = state.users.find((u) => u.id === r.employeeId);
        return (
          <div key={r.id} className="trow" style={{ gridTemplateColumns: "1.1fr 0.7fr 1fr 1.4fr 1fr" }}>
            <div>{emp?.name}</div>
            <div><span className={`badge ${r.type === "kasal" ? "badge-yellow" : "badge-blue"}`}>{r.type === "kasal" ? "Kasal" : "Ta'til"}</span></div>
            <div className="muted" style={{ fontSize: 12.5 }}>{r.from} — {r.to}</div>
            <div className="muted">{r.reason}</div>
            <div>
              {r.status === "kutilmoqda" ? (
                <div style={{ display: "flex", gap: 6 }}>
                  <button className="btn btn-sm btn-green" onClick={() => decide(r, "tasdiqlandi")}>✓ Tasdiqlash</button>
                  <button className="btn btn-sm btn-red" onClick={() => decide(r, "radetildi")}>✕ Rad etish</button>
                </div>
              ) : (
                <span className={`badge ${r.status === "tasdiqlandi" ? "badge-green" : "badge-red"}`}>
                  {r.status === "tasdiqlandi" ? "Tasdiqlandi" : "Rad etildi"}
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

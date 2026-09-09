import ResponsiveTable from "../ResponsiveTable.jsx";
import React from "react";

export default function AuditLog({ state }) {
  return (
    <div>
      <p className="hint" style={{ marginBottom: 14 }}>
        🛡 Tizimdagi barcha muhim harakatlar shu yerda saqlanadi — kim, qachon, nima qilgani. Hech kim yashirincha ma'lumot o'zgartira olmaydi.
      </p>
      <ResponsiveTable>
        {state.auditLog.length === 0 && <div className="empty">Yozuv yo'q.</div>}
        {state.auditLog.map((a) => (
          <div key={a.id} className="trow" style={{ gridTemplateColumns: "1fr 1fr 2.5fr" }}>
            <div className="muted" style={{ fontSize: 12.5 }}>{a.at}</div>
            <div style={{ fontWeight: 600 }}>{a.actor}</div>
            <div className="muted">{a.action}</div>
          </div>
        ))}
      </ResponsiveTable>
    </div>
  );
}

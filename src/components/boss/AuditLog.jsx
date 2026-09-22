import ResponsiveTable from "../ResponsiveTable.jsx";
import React from "react";

// Entries may be ISO instants (current format) or older locale-formatted strings; render both
// consistently in Tashkent time, falling back to the raw value if it doesn't parse at all.
function formatAt(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value || "—";
  return date.toLocaleString("uz-UZ", { timeZone: "Asia/Tashkent" });
}

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
            <div className="muted" style={{ fontSize: 12.5 }}>{formatAt(a.at)}</div>
            <div style={{ fontWeight: 600 }}>{a.actor}</div>
            <div className="muted">{a.action}</div>
          </div>
        ))}
      </ResponsiveTable>
    </div>
  );
}

import React from "react";
import { getRoleLabel } from '../lib/roles.js';

export default function Shell({ session, notifCount, onLogout, onPassword, onRefresh, refreshDisabled, children }) {
  return (
    <div className="app-shell">
      <div className="topbar">
        <div className="brand">🥙 Besh Bola Lavash</div>
        <div className="who">
          {onRefresh && <button className="btn btn-icon" type="button" title="Ma’lumotlarni yangilash" aria-label="Ma’lumotlarni yangilash" disabled={refreshDisabled} onClick={onRefresh}>🔄</button>}
          {notifCount > 0 && (
            <span><span className="notif-dot" /> {notifCount} bildirishnoma</span>
          )}
          <span className="who-session">{getRoleLabel(session)} · <b style={{ color: "var(--crust)" }}>{session.name}</b></span>
          {onPassword && <button className="btn btn-sm" onClick={onPassword}>Parolni almashtirish</button>}
          <button className="btn btn-sm" onClick={onLogout}>Chiqish</button>
        </div>
      </div>
      <div className="container">{children}</div>
    </div>
  );
}

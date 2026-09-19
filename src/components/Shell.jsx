import React from "react";
import { getRoleLabel } from '../lib/roles.js';
import NotificationBell from './NotificationBell.jsx';

export default function Shell({ session, notifications, persist, onLogout, onPassword, onRefresh, refreshDisabled, children }) {
  return (
    <div className="app-shell">
      <div className="topbar">
        <div className="brand">🥙 Besh Bola Lavash</div>
        <div className="who">
          {onRefresh && <button className="btn btn-icon" type="button" title="Ma’lumotlarni yangilash" aria-label="Ma’lumotlarni yangilash" disabled={refreshDisabled} onClick={onRefresh}>🔄</button>}
          {notifications && <NotificationBell notifications={notifications} persist={persist} />}
          <span className="who-session">{getRoleLabel(session)} · <b style={{ color: "var(--crust)" }}>{session.name}</b></span>
          {onPassword && <button className="btn btn-sm" onClick={onPassword}>Parolni almashtirish</button>}
          <button className="btn btn-sm" onClick={onLogout}>Chiqish</button>
        </div>
      </div>
      <div className="container">{children}</div>
    </div>
  );
}

import React from "react";

const ROLE_LABEL = { boss: "👑 Boshliq", admin: "👨‍💼 Admin", employee: "👷 Xodim" };

export default function Shell({ session, notifCount, onLogout, children }) {
  return (
    <div className="app-shell">
      <div className="topbar">
        <div className="brand">🥙 Besh Bola Lavash</div>
        <div className="who">
          {notifCount > 0 && (
            <span><span className="notif-dot" /> {notifCount} bildirishnoma</span>
          )}
          <span>{ROLE_LABEL[session.role]} · <b style={{ color: "var(--crust)" }}>{session.name}</b></span>
          <button className="btn btn-sm" onClick={onLogout}>Chiqish</button>
        </div>
      </div>
      <div className="container">{children}</div>
    </div>
  );
}

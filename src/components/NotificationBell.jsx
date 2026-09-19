import React, { useState } from "react";

export default function NotificationBell({ notifications, persist }) {
  const [open, setOpen] = useState(false);
  const unread = notifications.filter(n => !n.read);

  const markAllRead = async () => {
    const ids = new Set(unread.map(n => n.id));
    await persist(current => ({
      ...current,
      notifications: (current.notifications || []).map(n => ids.has(n.id) ? { ...n, read: true } : n),
    }));
  };

  if (!notifications.length) return null;

  return (
    <span style={{ position: "relative" }}>
      <button type="button" className="btn btn-sm" onClick={() => setOpen(value => !value)} aria-expanded={open} aria-label="Bildirishnomalar">
        {unread.length > 0 && <span className="notif-dot" />} {unread.length > 0 ? `${unread.length} bildirishnoma` : "Bildirishnomalar"}
      </button>
      {open && <div className="card card-pad" role="region" aria-label="Bildirishnomalar ro‘yxati" style={{ position: "absolute", right: 0, top: "calc(100% + 6px)", width: 300, maxHeight: 360, overflowY: "auto", zIndex: 20 }}>
        {unread.length > 0 && <button type="button" className="btn btn-sm" style={{ marginBottom: 10 }} onClick={markAllRead}>Hammasini o‘qilgan deb belgilash</button>}
        {[...notifications].reverse().slice(0, 30).map(n => (
          <p key={n.id} style={{ fontSize: 13, fontWeight: n.read ? 400 : 600, color: n.read ? "var(--muted)" : "var(--crust)", marginBottom: 8 }}>{n.text}</p>
        ))}
      </div>}
    </span>
  );
}

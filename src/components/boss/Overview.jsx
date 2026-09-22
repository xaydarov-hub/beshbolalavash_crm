import ResponsiveTable from "../ResponsiveTable.jsx";
import React, { useState } from "react";
import { fmt, todayISO, monthKey } from "../../lib/utils.js";
import { computeAllReports } from "../../lib/salary.js";
import { request } from "../../lib/api.js";

export default function Overview({ state }) {
  const [backupBusy, setBackupBusy] = useState(false);
  const [backupMessage, setBackupMessage] = useState("");
  const downloadBackup = async () => {
    setBackupBusy(true); setBackupMessage("");
    try {
      const data = await request("/api/backup");
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `bbl-crm-zaxira-${todayISO()}.json`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
      setBackupMessage("Zaxira fayli yuklab olindi.");
    } catch (error) {
      setBackupMessage(error.message);
    } finally {
      setBackupBusy(false);
    }
  };
  const month = monthKey(todayISO());
  const reports = computeAllReports(state, month, "all");
  const today = todayISO();

  const employees = state.users.filter((u) => u.role === "employee" && u.active !== false);
  const activeIds = new Set(employees.map(u => u.id));
  const todayAtt = state.attendance.filter((a) => a.date === today && activeIds.has(a.employeeId));
  const working = todayAtt.filter((a) => a.status === "keldi").length;
  const absent = todayAtt.filter((a) => a.status === "kelmadi").length;
  const late = todayAtt.filter((a) => a.status === "keldi" && a.late).length;
  const onLeave = todayAtt.filter((a) => a.status === "tatil" || a.status === "kasal").length;

  const totalSalary = reports.reduce((s, r) => s + r.total, 0);
  const totalBonus = reports.reduce((s, r) => s + r.bonuses, 0);
  const totalFine = reports.reduce((s, r) => s + r.fines, 0);
  const totalAdvance = reports.reduce((s, r) => s + r.advances, 0);
  const pendingAdvances = (state.advances || []).filter((a) => a.status === "kutilmoqda").length;

  const notifs = state.notifications.filter((n) => n.forRole === "boss");

  return (
    <div>
      <div className="grid grid-4 section-gap">
        <div className="stat-card">
          <div className="label">👥 Jami xodim</div>
          <div className="value">{employees.length}</div>
        </div>
        <div className="stat-card">
          <div className="label">🟢 Bugun ishda</div>
          <div className="value green">{working}</div>
        </div>
        <div className="stat-card">
          <div className="label">🔴 Kelmagan</div>
          <div className="value red">{absent}</div>
        </div>
        <div className="stat-card">
          <div className="label">🟡 Kechikkan</div>
          <div className="value" style={{ color: "#8a6d16" }}>{late}</div>
        </div>
      </div>

      <div className="grid grid-4 section-gap">
        <div className="stat-card">
          <div className="label">💰 Bu oy maosh (jami)</div>
          <div className="value accent">{fmt(totalSalary)} so'm</div>
        </div>
        <div className="stat-card">
          <div className="label">➕ Bonuslar</div>
          <div className="value green">+{fmt(totalBonus)} so'm</div>
        </div>
        <div className="stat-card">
          <div className="label">➖ Jarimalar</div>
          <div className="value red">-{fmt(totalFine)} so'm</div>
        </div>
        <div className="stat-card">
          <div className="label">💸 Avanslar{pendingAdvances > 0 ? ` (${pendingAdvances} kutilmoqda)` : ""}</div>
          <div className="value red">-{fmt(totalAdvance)} so'm</div>
        </div>
      </div>

      <div className="grid grid-2 section-gap">
        <div>
          <h3 className="section-title">🏢 Filiallar</h3>
          <ResponsiveTable>
            {state.branches.map((b) => {
              const count = employees.filter((e) => e.branchId === b.id).length;
              return (
                <div key={b.id} className="trow" style={{ gridTemplateColumns: "1fr auto" }}>
                  <span>{b.name}</span>
                  <span className="muted">{count} xodim</span>
                </div>
              );
            })}
          </ResponsiveTable>
        </div>
        <div>
          <h3 className="section-title">🔔 Bildirishnomalar</h3>
          <div className="insight-list">
            {notifs.length === 0 && <div className="empty">Yangi bildirishnoma yo'q.</div>}
            {notifs.map((n) => (
              <div key={n.id} className="insight-item">🔔 {n.text}</div>
            ))}
            {onLeave > 0 && <div className="insight-item">🏖 Bugun {onLeave} kishi dam olish/ta'tilda.</div>}
          </div>
        </div>
      </div>

      <div className="card card-pad section-gap">
        <h3 className="section-title">💾 Zaxira nusxa</h3>
        <p className="hint">Barcha xodimlar, davomat, maosh va boshqa ma'lumotlarni bitta faylga yuklab oling. Faylda maxfiy ma'lumot (parollarning shifrlangan nusxasi) bor — uni faqat o'zingizda, xavfsiz joyda saqlang.</p>
        <button type="button" className="btn btn-primary" disabled={backupBusy} onClick={downloadBackup}>{backupBusy ? "Tayyorlanmoqda..." : "Zaxira nusxa olish"}</button>
        {backupMessage && <p role="status" className="hint">{backupMessage}</p>}
      </div>
    </div>
  );
}

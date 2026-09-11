import React, { useMemo, useState } from "react";
import { fmt, todayISO, uid } from "../../lib/utils.js";

export default function SalaryEntryPanel({ state, persist, session }) {
  const branchEmployees = useMemo(
    () => (state.users || []).filter((user) => user.role === "employee" && user.active !== false && user.branchId === session.branchId && user.salaryType === "foiz"),
    [state.users, session.branchId]
  );

  const [employeeId, setEmployeeId] = useState(branchEmployees[0]?.id || "");
  const [rawAmount, setRawAmount] = useState("");
  const [note, setNote] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  const employee = branchEmployees.find((item) => item.id === employeeId) || branchEmployees[0] || null;
  const rate = Number(employee?.rate || 0);
  const parsedRaw = Number(String(rawAmount).replace(/\s+/g, "")) || 0;
  const calculated = Number.isFinite(parsedRaw) ? Math.round(parsedRaw * rate / 100) : 0;

  const entries = (state.salaryEntries || []).filter((entry) => entry.branchId === session.branchId);
  const unsettledTotal = entries.filter((entry) => !entry.isSettled).reduce((sum, entry) => sum + (Number(entry.calculatedAmount) || 0), 0);
  const settledTotal = entries.filter((entry) => entry.isSettled).reduce((sum, entry) => sum + (Number(entry.calculatedAmount) || 0), 0);

  const saveEntry = async () => {
    if (!employee) {
      setStatus("Foizli xodim topilmadi.");
      return;
    }
    const value = Number(String(rawAmount).replace(/\s+/g, ""));
    if (!Number.isFinite(value) || value < 0 || value > 1e12) {
      setStatus("Hisoblanmagan summa 0 dan 1 000 000 000 000 so‘mgacha bo‘lishi kerak.");
      return;
    }
    setBusy(true);
    setStatus("");
    try {
      await persist((current) => {
        const employeeRecord = current.users.find((user) => user.id === employee.id && user.role === "employee" && user.branchId === session.branchId && user.salaryType === "foiz");
        if (!employeeRecord) throw new Error("Xodim topilmadi yoki foiz turi o‘zgargan.");
        const entry = {
          id: uid(),
          employeeId: employee.id,
          branchId: session.branchId,
          employeeName: employee.name,
          rawAmount: value,
          calculatedAmount: Math.round(value * Number(employeeRecord.rate || 0) / 100),
          rate: Number(employeeRecord.rate || 0),
          note: note.trim(),
          by: session.name,
          createdAt: new Date().toISOString(),
          date: todayISO(),
          isSettled: false,
        };
        return {
          ...current,
          salaryEntries: [entry, ...(current.salaryEntries || [])],
          auditLog: [{ id: uid(), actor: session.name, actorId: session.id, employeeId: employee.id, at: new Date().toISOString(), action: `${employee.name}: ${fmt(value)} so‘m hisoblanmagan summa kiritildi; hisoblangan summa ${fmt(entry.calculatedAmount)} so‘m.` }, ...(current.auditLog || [])],
        };
      });
      setRawAmount("");
      setNote("");
      setStatus("Maosh yozuvi saqlandi.");
    } catch (error) {
      setStatus(error.message || "Maosh yozuvi saqlanmadi.");
    } finally {
      setBusy(false);
    }
  };

  const settle15DayCycle = async () => {
    const branchEntries = entries.filter((entry) => !entry.isSettled);
    if (!branchEntries.length) {
      setStatus("Yakunlash uchun hisoblangan yozuvlar yo‘q.");
      return;
    }
    setBusy(true);
    setStatus("");
    try {
      await persist((current) => {
        const unsettled = (current.salaryEntries || []).filter((entry) => entry.branchId === session.branchId && !entry.isSettled);
        const total = unsettled.reduce((sum, entry) => sum + (Number(entry.calculatedAmount) || 0), 0);
        return {
          ...current,
          salaryEntries: (current.salaryEntries || []).map((entry) => unsettled.some((item) => item.id === entry.id)
            ? { ...entry, isSettled: true, settledAt: new Date().toISOString(), settlementPeriod: "15-day" }
            : entry),
          auditLog: [{ id: uid(), actor: session.name, actorId: session.id, at: new Date().toISOString(), action: `${session.branchId} filialidagi 15 kunlik hisob yakunlandi. Umumiy hisoblangan summa: ${fmt(total)} so‘m.` }, ...(current.auditLog || [])],
        };
      });
      setStatus("15 kunlik hisob avtomatik yakunlandi.");
    } catch (error) {
      setStatus(error.message || "Hisob yakunlanmadi.");
    } finally {
      setBusy(false);
    }
  };

  if (!branchEmployees.length) {
    return <div className="empty">Foizli xodimlar yo‘q. Avval xodimga foizli maosh turini va stavkasini belgilang.</div>;
  }

  return (
    <div className="card card-pad">
      <h3 className="section-title">Maosh kiritish</h3>
      <div className="grid grid-2 section-gap">
        <label className="field">Xodim
          <select className="input" value={employeeId} onChange={(event) => setEmployeeId(event.target.value)}>
            {branchEmployees.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </label>
        <div className="field">
          <span className="muted">Foiz stavkasi</span>
          <div className="value" style={{ marginTop: 8 }}>{employee ? `${employee.rate}%` : "—"}</div>
        </div>
        <label className="field">Hisoblanmagan summa
          <input className="input" type="number" min="0" step="1000" value={rawAmount} onChange={(event) => setRawAmount(event.target.value)} placeholder="100000" />
        </label>
        <label className="field">Hisoblangan summa
          <input className="input" type="text" value={rawAmount ? fmt(calculated) : "0"} readOnly />
        </label>
      </div>
      <label className="field">Izoh
        <textarea className="input" value={note} onChange={(event) => setNote(event.target.value)} rows={3} placeholder="Hisobga izoh qo‘shing" />
      </label>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 10 }}>
        <button className="btn btn-primary" type="button" disabled={busy} onClick={saveEntry}>{busy ? "Saqlanmoqda..." : "Maosh yozuvini saqlash"}</button>
        <button className="btn" type="button" disabled={busy} onClick={settle15DayCycle}>15 kunlik hisobni yakunlash</button>
      </div>
      {status && <p role="status" style={{ marginTop: 12 }}>{status}</p>}

      <div className="grid grid-2" style={{ marginTop: 18 }}>
        <div className="stat-card">
          <div className="label">Ochiq hisoblangan summa</div>
          <div className="value accent">{fmt(unsettledTotal)} so‘m</div>
        </div>
        <div className="stat-card">
          <div className="label">Yakunlangan summa</div>
          <div className="value">{fmt(settledTotal)} so‘m</div>
        </div>
      </div>

      <div style={{ marginTop: 16 }}>
        <h4 className="section-title">Bu filialdagi maosh yozuvlari</h4>
        {entries.length === 0 ? <div className="empty">Hali yozuvlar yo‘q.</div> : (
          <div className="grid grid-2">
            {entries.map((entry) => (
              <div key={entry.id} className="card card-pad" style={{ minHeight: 110 }}>
                <div><b>{entry.employeeName || "Xodim"}</b></div>
                <div className="muted">{entry.date} · {new Date(entry.createdAt).toLocaleTimeString("uz-UZ", { hour: "2-digit", minute: "2-digit" })}</div>
                <p>Hisoblanmagan: <b>{fmt(entry.rawAmount)} so‘m</b></p>
                <p>Hisoblangan: <b>{fmt(entry.calculatedAmount)} so‘m</b></p>
                <p className="hint">{entry.isSettled ? `Yakunlangan: ${new Date(entry.settledAt).toLocaleString("uz-UZ").slice(0, 19)}` : "Jarayonda"}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

import React, { useState } from "react";
import { todayISO, fmt, monthKey } from "../lib/utils.js";
import { computeEmployeeReport } from "../lib/salary.js";

export default function SalesPanel({ state, session, saveSale }) {
  const [date, setDate] = useState(todayISO());
  const [search, setSearch] = useState("");
  const employees = state.users.filter(u => u.role === "employee" && (u.salaryType === "foiz" || (state.dailySales || []).some(r => r.employeeId === u.id)) && (session.role === "boss" || (session.role === "employee" ? u.id === session.id : u.branchId === session.branchId)) && u.name.toLowerCase().includes(search.toLowerCase()));
  return <div>
    <h3 className="section-title">Kunlik savdo va ish haqi</h3>
    <p className="hint">Sana va xodimni tanlang. Shu kundagi jami savdoni kiriting. Qayta saqlash oldingi summani yangilaydi. Ish haqi avtomatik hisoblanadi.</p>
    <div className="grid grid-2 section-gap">
      <label className="field">Sana<input className="input" type="date" value={date} max={todayISO()} onChange={e => setDate(e.target.value)} /></label>
      <label className="field">Xodimni qidirish<input className="input" type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Ism-familiya" /></label>
    </div>
    <div className="grid grid-2">{employees.map(emp => <SaleCard key={`${emp.id}:${date}`} emp={emp} date={date} state={state} editable={session.role !== "employee"} saveSale={saveSale} />)}</div>
    {!employees.length && <div className="empty">Foizli xodim topilmadi. Xodim profilida maosh turini «Foizli» deb belgilang.</div>}
  </div>;
}
function SaleCard({ emp, date, state, editable, saveSale }) {
  const record = (state.dailySales || []).find(r => r.employeeId === emp.id && r.date === date);
  const [amount, setAmount] = useState(String(record?.amount ?? ""));
  const [version, setVersion] = useState(record?.updatedAt ?? null);
  const [note, setNote] = useState(record?.note || "");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const rate = record?.rate ?? emp.rate;
  const report = computeEmployeeReport(state, emp.id, monthKey(date));
  async function submit(e) {
    e.preventDefault();
    const value = Number(amount.replace(/\s/g, ""));
    if (!amount.trim() || !Number.isSafeInteger(value) || value < 0 || value > 1e12) { setStatus("Savdoni butun, musbat summa yoki 0 sifatida kiriting."); return; }
    setBusy(true); setStatus("");
    try { const savedState = await saveSale({ employeeId: emp.id, date, amount: Number(amount.replace(/\s/g, "")), note, expectedUpdatedAt: version }); setVersion(savedState?.dailySales?.find(r => r.employeeId === emp.id && r.date === date)?.updatedAt ?? version); setStatus("Serverga saqlandi."); }
    catch (error) { setStatus(error.message); }
    finally { setBusy(false); }
  }
  return <form className="card card-pad" onSubmit={submit}>
    <h3 className="section-title">{emp.name}</h3>
    <p className="muted">{emp.position} · {rate}%</p>
    {editable ? <>
      <label className="field">{date} uchun jami savdo (so‘m)<input required className="input" inputMode="decimal" value={amount} onChange={e => setAmount(e.target.value)} placeholder="10 000 000" /></label>
      <label className="field">Izoh / mahsulotlar<textarea className="input" maxLength={500} value={note} onChange={e => setNote(e.target.value)} /></label>
      <p>Kunlik ish haqi: <b>{fmt(Number(amount.replace(/\s/g, "")) * rate / 100)} so‘m</b></p>
      <button className="btn btn-primary" disabled={busy || !date}>{busy ? "Saqlanmoqda..." : record ? "Savdoni yangilash" : "Savdoni saqlash"}</button>
      <p role="status">{status}</p>
    </> : <><p>Kunlik savdo: <b>{fmt(record?.amount)} so‘m</b></p><p>Kunlik ish haqi: <b>{fmt((record?.amount || 0) * rate / 100)} so‘m</b></p></>}
    <p className="hint">Saqlangan: {fmt(record?.amount)} so‘m savdo · {fmt((record?.amount || 0) * rate / 100)} so‘m ish haqi</p>
    <p>Oylik jami savdo: <b>{fmt(report.sales)} so‘m</b><br/>Oylik jami maosh: <b>{fmt(report.total)} so‘m</b></p>
    {report.legacySales > 0 && <p className="hint">Shundan {fmt(report.legacySales)} so‘m eski oylik savdo. Ushbu summa kunlik yozuvlarga qo‘shimcha hisoblanadi; uni qayta kiritmang.</p>}
  </form>;
}

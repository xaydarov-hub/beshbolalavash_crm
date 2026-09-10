import { useSaveAction } from "../../lib/useSaveAction.js";
import ResponsiveTable from "../ResponsiveTable.jsx";
import React, { useState } from "react";
import { uid, fmt, todayISO } from "../../lib/utils.js";
import { logAction } from "../../lib/db.js";

export default function Adjustments({ state, persist, session }) {
  const action = useSaveAction();
  const employees = state.users.filter((u) => u.role === "employee" && u.active !== false);
  const [empId, setEmpId] = useState(employees[0]?.id || "");
  const [type, setType] = useState("bonus");
  const [amount, setAmount] = useState("");
  const [comment, setComment] = useState("");

  const add = async () => {
    const numericAmount = Number(amount);
    if (!empId || !Number.isFinite(numericAmount) || numericAmount <= 0 || !comment.trim()) {
      alert("Musbat summa va sababi (izoh) kiritilishi shart."); return;
    }
    const emp = employees.find((e) => e.id === empId);
    if (!emp) { action.setMessage("Xodimni tanlang."); return; }
    const ok = await action.run(() => persist((s) => logAction(
      {
        ...s,
        adjustments: [...s.adjustments, { id: uid(), employeeId: empId, type, amount: numericAmount, comment: comment.trim(), date: todayISO(), by: session.name }],
      },
      session.name,
      `${emp.name}ga ${type === "jarima" ? "-" : "+"}${fmt(amount)} so'm ${type === "jarima" ? "jarima qo'ydi" : "bonus berdi"}. Sabab: ${comment.trim()}.`
    )));
    if (ok) { setAmount(""); setComment(""); }
  };

  const list = [...state.adjustments].reverse();

  return (
    <div>
      <div className="card card-pad section-gap" style={{ maxWidth: 520 }}>
        <h3 className="section-title">Jarima yoki bonus qo'shish</h3>
        <label className="field"><div className="label">Xodim</div>
          <select className="input" value={empId} onChange={(e) => setEmpId(e.target.value)}>
            <option value="">Xodimni tanlang</option>
            {employees.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
          </select></label>
        <label className="field"><div className="label">Turi</div>
          <select className="input" value={type} onChange={(e) => setType(e.target.value)}>
            <option value="bonus">➕ Bonus</option>
            <option value="jarima">➖ Jarima</option>
          </select></label>
        <label className="field"><div className="label">Summasi (so'm)</div>
          <input type="number" min="1" step="1" className="input" value={amount} onChange={(e) => setAmount(e.target.value)} /></label>
        <label className="field"><div className="label">Sababi / izoh — majburiy</div>
          <input className="input" value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Masalan: kech qolgani uchun" /></label>
        <button className="btn btn-primary" disabled={action.busy} onClick={add}>Qo'shish</button>
      </div>

      {action.message && <p role="status">{action.message}</p>}
      <h3 className="section-title">Barcha jarima va bonuslar</h3>
      <ResponsiveTable>
        <div className="trow thead" style={{ gridTemplateColumns: "0.8fr 1.1fr 0.7fr 1.8fr 0.7fr" }}>
          <div>Sana</div><div>Xodim</div><div>Turi</div><div>Sabab</div><div>Summa</div>
        </div>
        {list.length === 0 && <div className="empty">Hali yozuv yo'q.</div>}
        {list.map((a) => (
          <div key={a.id} className="trow" style={{ gridTemplateColumns: "0.8fr 1.1fr 0.7fr 1.8fr 0.7fr" }}>
            <div className="muted">{a.date}</div>
            <div>{state.users.find((u) => u.id === a.employeeId)?.name || "—"}</div>
            <div><span className={a.type === "jarima" ? "badge badge-red" : "badge badge-green"}>{a.type === "jarima" ? "Jarima" : "Bonus"}</span></div>
            <div className="muted">{a.comment} <span style={{ opacity: 0.6 }}>— {a.by}</span></div>
            <div>{a.type === "jarima" ? "-" : "+"}{fmt(a.amount)}</div>
          </div>
        ))}
      </ResponsiveTable>
    </div>
  );
}

import React, { useEffect, useState } from 'react';
import ResponsiveTable from '../ResponsiveTable.jsx';
import { uid, fmt, todayISO } from '../../lib/utils.js';
import { logAction } from '../../lib/db.js';
import { useSaveAction } from '../../lib/useSaveAction.js';
import { managesEmployee, sameRecord, validDate } from '../workflowSupport.js';

export default function Adjustments({ state, persist, session }) {
  const action = useSaveAction();
  const employees = state.users.filter(user => user.active !== false && managesEmployee(session, user));
  const visibleIds = new Set(state.users.filter(user => managesEmployee(session, user)).map(user => user.id));
  const [empId, setEmpId] = useState(employees[0]?.id || '');
  const [type, setType] = useState('bonus');
  const [amount, setAmount] = useState('');
  const [comment, setComment] = useState('');
  const [date, setDate] = useState(todayISO());
  const [editing, setEditing] = useState(null);
  useEffect(() => { if (!editing && !employees.some(employee => employee.id === empId)) setEmpId(employees[0]?.id || ''); }, [state.users, empId, editing]);
  const reset = () => { setEditing(null); setAmount(''); setComment(''); setDate(todayISO()); };
  const add = async event => {
    event.preventDefault();
    const numericAmount = Number(amount.replace(/\s/g, ''));
    if (!empId || !Number.isSafeInteger(numericAmount) || numericAmount <= 0 || numericAmount > 1e12 || !comment.trim()) { action.setMessage('Xodim, musbat butun summa va sabab kiritilishi shart.'); return; }
    if (!validDate(date) || date > todayISO()) { action.setMessage('Bugungi yoki oldingi sanani tanlang.'); return; }
    const ok = await action.run(() => persist(current => {
      const employee = current.users.find(user => user.id === empId);
      if (!managesEmployee(session, employee)) throw new Error('Xodimni tanlang yoki ro‘yxatni yangilang.');
      const existing = (current.adjustments || []).find(item => item.id === editing?.id);
      if (editing && !sameRecord(existing, editing)) throw new Error('Yozuv boshqa qurilmada o‘zgargan. Uni qayta oching.');
      const record = { ...existing, id: existing?.id || uid(), employeeId: empId, type, amount: numericAmount, comment: comment.trim(), date, by: session.name };
      return logAction({ ...current, adjustments: [...(current.adjustments || []).filter(item => item.id !== record.id), record] }, session.name, `${employee.name}: ${type === 'jarima' ? 'jarima' : 'bonus'} ${fmt(numericAmount)} so‘m ${editing ? 'yangilandi' : 'qo‘shildi'}. Sabab: ${comment.trim()}.`);
    }));
    if (ok) reset();
  };
  const remove = async record => {
    if (!confirm('Bu jarima yoki bonus bekor qilinsinmi? Oylik qayta hisoblanadi.')) return;
    const ok = await action.run(() => persist(current => {
      const existing = (current.adjustments || []).find(item => item.id === record.id);
      if (!sameRecord(existing, record)) throw new Error('Yozuv boshqa qurilmada o‘zgargan. Ro‘yxatni yangilang.');
      if (!managesEmployee(session, current.users.find(user => user.id === existing.employeeId))) throw new Error('Bu xodimni boshqarishga ruxsat yo‘q.');
      return logAction({ ...current, adjustments: current.adjustments.filter(item => item.id !== record.id) }, session.name, `${state.users.find(user => user.id === record.employeeId)?.name}: ${fmt(record.amount)} so‘m ${record.type === 'jarima' ? 'jarima' : 'bonus'} bekor qilindi. Sabab: ${record.comment}`);
    }), 'Yozuv bekor qilindi.');
    if (ok && editing?.id === record.id) reset();
  };
  const list = [...(state.adjustments || [])].filter(item => visibleIds.has(item.employeeId)).sort((a, b) => b.date.localeCompare(a.date));
  return <div>
    <form className="card card-pad section-gap" style={{ maxWidth: 520 }} onSubmit={add}>
      <h3 className="section-title">{editing ? 'Jarima yoki bonusni tahrirlash' : "Jarima yoki bonus qo'shish"}</h3>
      <label className="field">Xodim<select className="input" disabled={action.busy || Boolean(editing)} value={empId} onChange={event => setEmpId(event.target.value)}>
        <option value="">Xodimni tanlang</option>
        {(editing ? state.users.filter(user => managesEmployee(session, user)) : employees).map(employee => <option key={employee.id} value={employee.id}>{employee.name}</option>)}
      </select></label>
      <label className="field">Sana<input type="date" className="input" required max={todayISO()} disabled={action.busy} value={date} onChange={event => setDate(event.target.value)} /></label>
      <label className="field">Turi<select className="input" disabled={action.busy} value={type} onChange={event => setType(event.target.value)}><option value="bonus">Bonus</option><option value="jarima">Jarima</option></select></label>
      <label className="field">Summasi (so'm)<input className="input" inputMode="numeric" required disabled={action.busy} value={amount} onChange={event => setAmount(event.target.value)} /></label>
      <label className="field">Sababi / izoh — majburiy<input className="input" required maxLength={2000} disabled={action.busy} value={comment} onChange={event => setComment(event.target.value)} placeholder="Masalan: kech qolgani uchun" /></label>
      <button className="btn btn-primary" disabled={action.busy || !empId}>{action.busy ? 'Saqlanmoqda...' : editing ? 'O‘zgarishni saqlash' : "Qo'shish"}</button>
      {editing && <button className="btn" type="button" disabled={action.busy} onClick={reset}>Tahrirni bekor qilish</button>}
    </form>
    {action.message && <p role="status">{action.message}</p>}
    <h3 className="section-title">Jarima va bonuslar tarixi</h3>
    <ResponsiveTable>
      <div className="trow thead" style={{ gridTemplateColumns: '0.8fr 1.1fr 0.7fr 1.5fr 0.7fr 1fr' }}><div>Sana</div><div>Xodim</div><div>Turi</div><div>Sabab</div><div>Summa</div><div>Amallar</div></div>
      {!list.length && <div className="empty">Hali yozuv yo'q.</div>}
      {list.map(record => <div key={record.id} className="trow" style={{ gridTemplateColumns: '0.8fr 1.1fr 0.7fr 1.5fr 0.7fr 1fr' }}>
        <div className="muted">{record.date}</div><div>{state.users.find(user => user.id === record.employeeId)?.name || '—'}</div>
        <div><span className={`badge ${record.type === 'jarima' ? 'badge-red' : 'badge-green'}`}>{record.type === 'jarima' ? 'Jarima' : 'Bonus'}</span></div>
        <div className="muted">{record.comment} — {record.by}</div><div>{record.type === 'jarima' ? '-' : '+'}{fmt(record.amount)}</div>
        <div><button className="btn btn-sm" disabled={action.busy} onClick={() => { setEditing(record); setEmpId(record.employeeId); setType(record.type); setAmount(String(record.amount)); setComment(record.comment); setDate(record.date); action.setMessage(''); }}>Tahrirlash</button><button className="btn btn-sm btn-red" disabled={action.busy} onClick={() => remove(record)}>Bekor qilish</button></div>
      </div>)}
    </ResponsiveTable>
  </div>;
}

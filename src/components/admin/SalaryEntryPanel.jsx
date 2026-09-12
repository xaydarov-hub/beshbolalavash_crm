import React, { useEffect, useRef, useState } from 'react';
import { uid } from '../../lib/utils.js';
import { useSaveAction } from '../../lib/useSaveAction.js';
import { calculateCommission, loadSalaryEntriesForBranch, restoreAllowed, salaryMoney as money } from '../../lib/salaryEntries.js';
export { calculateCommission, loadSalaryEntriesForBranch } from '../../lib/salaryEntries.js';

const time = value => value ? new Date(value).toLocaleString('uz-UZ', { timeZone: 'Asia/Tashkent' }) : '—';

export default function SalaryEntryPanel({ state, salaryAction, session }) {
  const readOnly = session.role === 'employee';
  const [selectedBranch, setSelectedBranch] = useState(readOnly ? 'all' : state.branches[0]?.id || '');
  const branchId = session.role === 'admin' ? session.branchId : selectedBranch;
  const [employeeId, setEmployeeId] = useState('');
  const [rawAmount, setRawAmount] = useState('');
  const [calculatedAmount, setCalculatedAmount] = useState(0);
  const [note, setNote] = useState('');
  const [view, setView] = useState('active');
  const [filter, setFilter] = useState('all');
  const [settlementPreview, setSettlementPreview] = useState(null);
  const [now, setNow] = useState(Date.now());
  const draft = useRef(null);
  const action = useSaveAction();
  const available = state.salaryEntryApiVersion === 1;
  const employees = state.users.filter(user => user.role === 'employee' && user.active !== false && user.branchId === branchId && user.salaryType === 'foiz');
  const employee = employees.find(user => user.id === employeeId);
  const rate = Number(employee?.rate || 0);
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 15000);
    return () => clearInterval(interval);
  }, []);
  useEffect(() => {
    try { setCalculatedAmount(calculateCommission(rawAmount, rate)); }
    catch { setCalculatedAmount(0); }
  }, [rawAmount, rate]);

  const visible = (state.salaryEntries || []).filter(entry => !readOnly || entry.employeeId === session.id);
  const entries = branchId === 'all' ? visible.filter(entry => !entry.isDeleted) : loadSalaryEntriesForBranch(visible, branchId);
  const deleted = (branchId === 'all' ? visible.filter(entry => entry.isDeleted) : loadSalaryEntriesForBranch(visible, branchId, { deleted: true })).filter(entry => restoreAllowed(entry, now));
  const unsettled = entries.filter(entry => !entry.isSettled);
  const total = rows => rows.reduce((sum, entry) => sum + entry.calculatedAmount, 0);
  const settlements = (state.salarySettlements || []).filter(row => branchId === 'all' || row.branchId === branchId);
  const displayed = (view === 'trash' ? deleted : entries.filter(entry => filter === 'all' || (filter === 'settled' ? entry.isSettled : !entry.isSettled))).slice().sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));

  function handleRawAmountChange(value) {
    setRawAmount(value);
    try { setCalculatedAmount(calculateCommission(Number(value), rate)); } catch { setCalculatedAmount(0); }
    action.setMessage('');
  }
  async function saveSalaryEntry(event) {
    event.preventDefault();
    if (!employee) { action.setMessage('Foizli xodimni tanlang.'); return; }
    if (!rawAmount.trim() || !Number.isFinite(Number(rawAmount)) || Number(rawAmount) < 0 || Number(rawAmount) > 1e12) { action.setMessage('Hisoblanmagan summani to‘g‘ri kiriting.'); return; }
    const input = { employeeId: employee.id, rawAmount: Number(rawAmount), expectedRate: rate, note: note.trim() };
    const signature = JSON.stringify(input);
    if (draft.current?.signature !== signature) draft.current = { signature, id: uid() };
    const ok = await action.run(() => salaryAction('/api/salary-entries', { ...input, id: draft.current.id }), 'Maosh yozuvi serverga saqlandi.');
    if (ok) { setRawAmount(''); setNote(''); draft.current = null; }
  }
  async function settle15DayCycle() {
    const ok = await action.run(() => salaryAction('/api/salary-settlements', { id: settlementPreview.id, branchId: settlementPreview.branchId, entryIds: settlementPreview.entryIds }), '15 kunlik hisob serverda yakunlandi.');
    if (ok) setSettlementPreview(null);
  }
  async function moveToTrash(entry) {
    await action.run(() => salaryAction(`/api/salary-entries/${encodeURIComponent(entry.id)}/trash`, { expectedUpdatedAt: entry.updatedAt || entry.createdAt }), 'Yozuv korzinkaga o‘tkazildi. 30 kun ichida qaytarish mumkin.');
  }
  async function restoreDeletedEntry(entry) {
    if (!restoreAllowed(entry)) { action.setMessage('30 kunlik tiklash muddati tugagan.'); setNow(Date.now()); return; }
    await action.run(() => salaryAction(`/api/salary-entries/${encodeURIComponent(entry.id)}/restore`, { expectedDeletedAt: entry.deletedAt }), 'Yozuv korzinkadan qaytarildi.');
  }
  const restoreFromTrashIfStillValid = restoreDeletedEntry;

  return <section aria-label="Maosh yozuvlari">
    <h3 className="section-title">{readOnly ? 'Mening maosh yozuvlarim' : 'Maosh kiritish va 15 kunlik hisob'}</h3>
    {!available && <p role="alert">Bu bo‘lim uchun backend yangilanishi kerak. Hozircha saqlash va yakunlash mavjud emas.</p>}
    {session.role !== 'admin' && <label className="field">Maosh filiali<select className="input" disabled={action.busy} value={branchId} onChange={event => { setSelectedBranch(event.target.value); setEmployeeId(''); setSettlementPreview(null); }}>{readOnly ? <option value="all">Barcha filiallar</option> : <option value="">Filialni tanlang</option>}{state.branches.map(branch => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</select></label>}
    {session.role === 'admin' && <p className="hint">Filial: {state.branches.find(branch => branch.id === branchId)?.name || 'Biriktirilmagan'}</p>}
    {!readOnly && <form className="card card-pad section-gap" onSubmit={saveSalaryEntry}>
      <fieldset disabled={action.busy || !available || !salaryAction} style={{ border: 0, padding: 0, margin: 0 }}>
        <div className="grid grid-2">
          <label className="field">Xodim<select required className="input" value={employee?.id || ''} onChange={event => { setEmployeeId(event.target.value); action.setMessage(''); }}><option value="">Xodimni tanlang</option>{employees.map(user => <option key={user.id} value={user.id}>{user.name} · {user.rate}%</option>)}</select></label>
          <div className="field">Foiz stavkasi<strong>{employee ? `${rate}%` : 'Xodimni tanlang'}</strong></div>
          <label className="field">Hisoblanmagan summa<input required className="input" type="number" min="0" max="1000000000000" step="any" inputMode="decimal" value={rawAmount} onChange={event => handleRawAmountChange(event.target.value)} placeholder="100000" /></label>
          <label className="field">Hisoblangan summa<input className="input" readOnly value={money(calculatedAmount)} /></label>
        </div>
        <label className="field">Izoh<textarea className="input" maxLength={2000} rows={2} value={note} onChange={event => setNote(event.target.value)} /></label>
        <p className="hint">Formula: summa × foiz ÷ 100. Sana va vaqt Toshkent vaqti bo‘yicha avtomatik saqlanadi. «Kunlik savdo»ga kiritilgan aynan shu summani qayta kiritmang.</p>
        <button className="btn btn-primary" type="submit" disabled={!employee}>{action.busy ? 'Saqlanmoqda...' : 'Maosh yozuvini saqlash'}</button>
        {!employees.length && <p className="hint">Filialda faol foizli xodim yo‘q. Xodimga foizli maosh turi va stavkasini belgilang. Oldingi hisoblar quyida saqlanadi.</p>}
      </fieldset>
    </form>}
    {action.message && <p role="status">{action.message}</p>}
    <div className="grid grid-3 section-gap">
      <div className="stat-card"><div className="label">Ochiq hisob</div><div className="value accent">{money(total(unsettled))} so‘m</div><small>{unsettled.length} yozuv</small></div>
      <div className="stat-card"><div className="label">Yakunlangan hisob</div><div className="value">{money(total(entries.filter(entry => entry.isSettled)))} so‘m</div></div>
      <div className="stat-card"><div className="label">Korzinka</div><div className="value">{deleted.length} yozuv</div><small>Joriy maosh hisobiga kirmaydi</small></div>
    </div>
    {!readOnly && <>
      <button className="btn btn-primary section-gap" disabled={action.busy || !available || !salaryAction || !unsettled.length || !branchId || Boolean(settlementPreview)} onClick={() => setSettlementPreview({ id: uid(), branchId, entryIds: unsettled.map(entry => entry.id), total: total(unsettled) })}>15 kunlik hisobni yakunlash</button>
      {settlementPreview && <div className="card card-pad section-gap" role="region" aria-label="Hisobni yakunlash tasdig‘i"><h4>Yakunlanadigan hisob</h4><p>{settlementPreview.entryIds.length} yozuv · {money(settlementPreview.total)} so‘m</p><p className="hint">Filialdagi barcha ochiq yozuvlar yakunlanadi. Korzinkadagi va oldin yakunlangan yozuvlar kirmaydi. Bu hisob holatini belgilaydi; bank orqali pul o‘tkazmaydi.</p><button className="btn btn-primary" disabled={action.busy} onClick={settle15DayCycle}>Yakunlashni tasdiqlash</button><button className="btn" disabled={action.busy} onClick={() => setSettlementPreview(null)}>Bekor qilish</button></div>}
    </>}
    <nav className="tabs" aria-label="Maosh ro‘yxati"><button className={`tab-btn ${view === 'active' ? 'active' : ''}`} onClick={() => setView('active')}>Yozuvlar</button><button className={`tab-btn ${view === 'trash' ? 'active' : ''}`} onClick={() => setView('trash')}>Korzinka ({deleted.length})</button><button className={`tab-btn ${view === 'settlements' ? 'active' : ''}`} onClick={() => setView('settlements')}>15 kunlik yakunlar</button></nav>
    {view === 'active' && <label className="field">Hisob holati<select className="input" value={filter} onChange={event => setFilter(event.target.value)}><option value="all">Barcha yozuvlar</option><option value="open">Ochiq</option><option value="settled">Yakunlangan</option></select></label>}
    {view === 'trash' && <p className="hint">Yozuvlar o‘chirilgan vaqtdan 30 kun saqlanadi. Muddat tugagach server avtomatik o‘chiradi. Tiklanganda oldingi yakunlash holati saqlanadi.</p>}
    {view !== 'settlements' && <div className="grid grid-2">{displayed.map(entry => <article className="card card-pad" key={entry.id} aria-label={`${entry.employeeName} maosh yozuvi`}>
      <h4>{entry.employeeName}</h4><p className="muted">{entry.date} · {time(entry.createdAt)}</p>
      <p>Hisoblanmagan: <b>{money(entry.rawAmount)} so‘m</b></p><p>Stavka: {entry.rate}% · Hisoblangan: <b>{money(entry.calculatedAmount)} so‘m</b></p>
      <p>{entry.isSettled ? `Yakunlangan: ${time(entry.settledAt)}` : 'Ochiq hisob'}</p>{entry.note && <p>{entry.note}</p>}<p className="hint">Kiritgan: {entry.by}</p>
      {entry.restoredAt && <p className="hint">Qaytarilgan: {time(entry.restoredAt)}</p>}
      {entry.isDeleted && <p className="hint">O‘chirilgan: {time(entry.deletedAt)}<br />Tiklash muddati: {time(entry.expiresAt)} · {Math.ceil((Date.parse(entry.expiresAt) - now) / 86400000)} kun qoldi</p>}
      {!readOnly && <button className={`btn ${entry.isDeleted ? 'btn-green' : 'btn-red'}`} disabled={action.busy || !available || !salaryAction} onClick={() => entry.isDeleted ? restoreFromTrashIfStillValid(entry) : moveToTrash(entry)}>{entry.isDeleted ? 'Qaytarish' : 'O‘chirish'}</button>}
    </article>)}</div>}
    {view !== 'settlements' && !displayed.length && <p className="empty">{view === 'trash' ? 'Korzinka bo‘sh.' : 'Tanlangan holatda maosh yozuvi yo‘q.'}</p>}
    {view === 'settlements' && <div>{settlements.map(row => <details className="card card-pad section-gap" key={row.id}><summary>{time(row.settledAt)} · {money(row.total)} so‘m · {row.entryIds.length} yozuv</summary><p>Yakunlagan: {row.by} · Davr: 15 kun</p>{row.employees.map(employee => <p key={employee.employeeId}>{employee.employeeName}: {money(employee.total)} so‘m ({employee.count} yozuv)</p>)}<p className="hint">Yakunlash paytidagi jamlanma saqlanadi. Keyingi korzinka amallari joriy hisobga ta’sir qiladi.</p></details>)}{!settlements.length && <p className="empty">Hali 15 kunlik hisob yakunlanmagan.</p>}</div>}
  </section>;
}

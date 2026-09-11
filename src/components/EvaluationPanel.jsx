import React, { useEffect, useMemo, useState } from 'react';
import { EVALUATION_CRITERIA, MAX_EVALUATION_SCORE, emptyScores, evaluationTotal, normalizeScores } from '../lib/evaluation.js';
import { todayISO, uid } from '../lib/utils.js';
import { logAction } from '../lib/db.js';
import { useSaveAction } from '../lib/useSaveAction.js';
import { managesEmployee, sameRecord, validDate } from './workflowSupport.js';

export default function EvaluationPanel({ state, persist, session, employeeScope }) {
  const employees = useMemo(() => state.users.filter(user => user.active !== false && managesEmployee(session, user) && (!employeeScope || employeeScope(user))), [state.users, session, employeeScope]);
  const [date, setDate] = useState(todayISO());
  const [employeeId, setEmployeeId] = useState('');
  useEffect(() => {
    if (!employees.some(employee => employee.id === employeeId)) setEmployeeId(employees[0]?.id || '');
  }, [employees, employeeId]);
  const selected = employees.find(employee => employee.id === employeeId);
  if (!employees.length) return <div className="empty">Baholash uchun xodim yo'q.</div>;
  return <div className="card card-pad section-gap">
    <h3 className="section-title">Kunlik xizmat sifati bahosi</h3>
    <p className="hint">Bir xodimga bir kunda bitta baho saqlanadi. Saqlangan bahoni shu sana orqali yangilashingiz mumkin.</p>
    <div className="grid grid-2">
      <label className="field">Sana<input type="date" className="input" value={date} max={todayISO()} onChange={event => setDate(event.target.value)} /></label>
      <label className="field">Xodim<select className="input" value={employeeId} onChange={event => setEmployeeId(event.target.value)}>
        {employees.map(employee => <option key={employee.id} value={employee.id}>{employee.name} — {employee.position}</option>)}
      </select></label>
    </div>
    {selected && <EvaluationForm key={`${selected.id}:${date}`} state={state} persist={persist} session={session} employee={selected} date={date} />}
  </div>;
}

function EvaluationForm({ state, persist, session, employee, date }) {
  const record = (state.evaluations || []).find(item => item.employeeId === employee.id && item.date === date);
  const [scores, setScores] = useState(record ? normalizeScores(record.scores) : emptyScores());
  const [comment, setComment] = useState(record?.comment || '');
  const [baseline, setBaseline] = useState(record);
  const [dirty, setDirty] = useState(false);
  const action = useSaveAction();
  const loadSaved = () => {
    setScores(record ? normalizeScores(record.scores) : emptyScores());
    setComment(record?.comment || ''); setBaseline(record); setDirty(false); action.setMessage('');
  };
  useEffect(() => {
    if (!dirty && !action.busy && !sameRecord(record, baseline)) {
      setScores(record ? normalizeScores(record.scores) : emptyScores());
      setComment(record?.comment || ''); setBaseline(record);
    }
  }, [record, dirty, action.busy, baseline]);
  const save = async event => {
    event.preventDefault();
    if (!validDate(date) || date > todayISO()) { action.setMessage('Bugungi yoki oldingi sanani tanlang.'); return; }
    const ok = await action.run(() => persist(current => {
      const currentEmployee = current.users.find(user => user.id === employee.id);
      if (!managesEmployee(session, currentEmployee) || currentEmployee.active === false) throw new Error('Xodim filial yoki holatini o‘zgartirgan. Ro‘yxatni yangilang.');
      const existing = (current.evaluations || []).find(item => item.employeeId === employee.id && item.date === date);
      if (!sameRecord(existing, baseline)) throw new Error('Baho boshqa qurilmada yangilangan. Saqlangan bahoni olib qayta kiriting.');
      const cleanScores = normalizeScores(scores);
      const next = { ...existing, id: existing?.id || uid(), employeeId: employee.id, date, scores: cleanScores, scaleVersion: 2, total: evaluationTotal(cleanScores), comment: comment.trim(), assessedBy: session.name, updatedAt: new Date().toISOString() };
      return logAction({ ...current, evaluations: [...(current.evaluations || []).filter(item => item.id !== next.id), next] }, session.name, `${employee.name}ni ${date} uchun ${next.total}/${MAX_EVALUATION_SCORE} ball bilan baholadi.`);
    }));
    if (ok) setDirty(false);
  };
  return <form onSubmit={save}>
    <div className="score-total">{evaluationTotal(scores).toFixed(1)}<small> / {MAX_EVALUATION_SCORE} ball</small></div>
    <p className="hint">Har mezon 0–5 ball. Umumiy baho mezonlarning o‘rtachasi.</p>
    <div className="criteria-list">{EVALUATION_CRITERIA.map((criterion, index) => <div className="criterion" key={criterion.id}>
      <div className="criterion-label"><b>{index + 1}.</b> {criterion.label} <span>{criterion.max} ball</span></div>
      <div className="score-buttons" role="group" aria-label={`${criterion.label} uchun ball`}>
        {Array.from({ length: criterion.max + 1 }, (_, score) => <button type="button" disabled={action.busy} aria-pressed={scores[criterion.id] === score} key={score} className={`score-btn ${scores[criterion.id] === score ? 'active' : ''}`} onClick={() => { setScores({ ...scores, [criterion.id]: score }); setDirty(true); action.setMessage(''); }}>{score}</button>)}
      </div>
    </div>)}</div>
    <label className="field" style={{ marginTop: 14 }}>Izoh (ixtiyoriy)<textarea className="input" rows="3" maxLength={2000} disabled={action.busy} value={comment} onChange={event => { setComment(event.target.value); setDirty(true); action.setMessage(''); }} /></label>
    {dirty && !sameRecord(record, baseline) && <p role="status">Baho boshqa qurilmada yangilandi. <button type="button" className="btn" disabled={action.busy} onClick={loadSaved}>Saqlangan bahoni olish</button></p>}
    <button className="btn btn-primary" disabled={action.busy || !date}>{action.busy ? 'Saqlanmoqda...' : 'Ballarni saqlash'}</button>
    {action.message && <p role="status">{action.message}</p>}
  </form>;
}

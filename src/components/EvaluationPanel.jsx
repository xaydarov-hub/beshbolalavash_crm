import React, { useEffect, useMemo, useState } from "react";
import { EVALUATION_CRITERIA, MAX_EVALUATION_SCORE, emptyScores, evaluationTotal, normalizeScores } from "../lib/evaluation.js";
import { todayISO, uid } from "../lib/utils.js";
import { logAction } from "../lib/db.js";

export default function EvaluationPanel({ state, persist, session, employeeScope }) {
  const employees = useMemo(
    () => state.users.filter((user) => user.role === "employee" && (!employeeScope || employeeScope(user))),
    [state.users, employeeScope]
  );
  const [date, setDate] = useState(todayISO());
  const [employeeId, setEmployeeId] = useState("");
  const [scores, setScores] = useState(emptyScores());
  const [comment, setComment] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!employees.some((employee) => employee.id === employeeId)) {
      setEmployeeId(employees[0]?.id || "");
    }
  }, [employees, employeeId]);

  useEffect(() => {
    const record = (state.evaluations || []).find(
      (item) => item.employeeId === employeeId && item.date === date
    );
    setScores(record ? normalizeScores(record.scores) : emptyScores());
    setComment(record?.comment || "");
    setSaved(false);
  }, [state.evaluations, employeeId, date]);

  const total = evaluationTotal(scores);
  const selected = employees.find((employee) => employee.id === employeeId);

  const save = () => {
    if (!selected) return;
    const cleanScores = normalizeScores(scores);
    const existing = (state.evaluations || []).find(
      (item) => item.employeeId === employeeId && item.date === date
    );
    persist((current) => {
      const record = {
        id: existing?.id || uid(),
        employeeId,
        date,
        scores: cleanScores,
        total: evaluationTotal(cleanScores),
        comment: comment.trim(),
        assessedBy: session.name,
        updatedAt: new Date().toISOString(),
      };
      const evaluations = existing
        ? (current.evaluations || []).map((item) => item.id === existing.id ? record : item)
        : [...(current.evaluations || []), record];
      return logAction(
        { ...current, evaluations },
        session.name,
        `${selected.name}ni ${date} uchun ${record.total}/${MAX_EVALUATION_SCORE} ball bilan baholadi.`
      );
    });
    setSaved(true);
  };

  if (!employees.length) return <div className="empty">Baholash uchun xodim yo'q.</div>;

  return (
    <div>
      <div className="card card-pad section-gap">
        <div className="evaluation-head">
          <div>
            <h3 className="section-title">Kunlik xizmat sifati bahosi</h3>
            <div className="hint">Har mezon uchun aniq holatga qarab tugma orqali ball bering. Bir xodimga bir kunda bitta baho saqlanadi.</div>
          </div>
          <div className="score-total">{total}<small> / {MAX_EVALUATION_SCORE} ball</small></div>
        </div>
        <div className="grid grid-2">
          <label className="field"><div className="label">Sana</div>
            <input type="date" className="input" value={date} onChange={(event) => setDate(event.target.value)} />
          </label>
          <label className="field"><div className="label">Xodim</div>
            <select className="input" value={employeeId} onChange={(event) => setEmployeeId(event.target.value)}>
              {employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.name} — {employee.position}</option>)}
            </select>
          </label>
        </div>
        <div className="evaluation-top5">TOP-5: buyurtma, kutib olish, muomala, stol nazorati va stol tozaligi.</div>
        <div className="criteria-list">
          {EVALUATION_CRITERIA.map((criterion, index) => (
            <div className="criterion" key={criterion.id}>
              <div className="criterion-label"><b>{index + 1}.</b> {criterion.label} <span>{criterion.max} ball{criterion.top ? " · TOP-5" : ""}</span></div>
              <div className="score-buttons" aria-label={`${criterion.label} uchun ball`}>
                {Array.from({ length: criterion.max + 1 }, (_, score) => (
                  <button type="button" key={score} className={`score-btn ${scores[criterion.id] === score ? "active" : ""}`}
                    onClick={() => { setScores({ ...scores, [criterion.id]: score }); setSaved(false); }}>
                    {score}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
        <label className="field" style={{ marginTop: 14 }}><div className="label">Izoh (ixtiyoriy, aniq kuzatuvni yozing)</div>
          <textarea className="input" rows="3" value={comment} onChange={(event) => { setComment(event.target.value); setSaved(false); }} />
        </label>
        <button className="btn btn-primary" onClick={save}>Ballarni saqlash</button>
        {saved && <span className="save-ok">Saqlab qo'yildi.</span>}
      </div>
    </div>
  );
}

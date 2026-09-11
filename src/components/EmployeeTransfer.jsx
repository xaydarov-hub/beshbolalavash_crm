import React, { useEffect, useMemo, useState } from 'react';
import { todayISO, uid } from '../lib/utils.js';
import { logAction } from '../lib/db.js';
import { useSaveAction } from '../lib/useSaveAction.js';
import { managesEmployee } from './workflowSupport.js';

export default function EmployeeTransfer({ state, persist, session, employeeScope }) {
  const employees = useMemo(() => state.users.filter(user => user.active !== false && managesEmployee(session, user) && (!employeeScope || employeeScope(user))), [state.users, session, employeeScope]);
  const [employeeId, setEmployeeId] = useState('');
  const [branchId, setBranchId] = useState('');
  const action = useSaveAction();
  useEffect(() => { if (!employees.some(employee => employee.id === employeeId)) setEmployeeId(employees[0]?.id || ''); }, [employees, employeeId]);
  const employee = employees.find(item => item.id === employeeId);
  const branches = state.branches.filter(branch => branch.id !== employee?.branchId);
  useEffect(() => { if (!branches.some(branch => branch.id === branchId)) setBranchId(branches[0]?.id || ''); }, [employeeId, branchId, state.branches, employee?.branchId]);
  const transfer = async event => {
    event.preventDefault();
    if (!employee || !branchId) { action.setMessage('Xodim va yangi filialni tanlang.'); return; }
    const to = branches.find(branch => branch.id === branchId);
    await action.run(() => persist(current => {
      const live = current.users.find(user => user.id === employee.id);
      if (!managesEmployee(session, live) || live.active === false || live.branchId !== employee.branchId) throw new Error('Xodim boshqa filialga ko‘chirilgan yoki arxivlangan. Ro‘yxatni yangilang.');
      const target = current.branches.find(branch => branch.id === branchId);
      if (!target || target.id === live.branchId) throw new Error('Boshqa mavjud filialni tanlang.');
      const from = current.branches.find(branch => branch.id === live.branchId);
      const record = { id: uid(), employeeId: employee.id, fromBranchId: live.branchId, toBranchId: target.id, effectiveDate: todayISO(), by: session.name };
      return logAction({ ...current, users: current.users.map(user => user.id === live.id ? { ...user, branchId: target.id } : user), transfers: [...(current.transfers || []), record] }, session.name, `${live.name}ni ${from?.name || 'noma’lum filial'}dan ${target.name}ga ko‘chirdi.`);
    }), `${employee.name} ${to?.name} filialiga ko‘chirildi.`);
  };
  return <form className="card card-pad" style={{ maxWidth: 560 }} onSubmit={transfer}>
    <h3 className="section-title">Xodimni boshqa filialga ko'chirish</h3>
    {!employees.length ? <p className="empty">Ko'chirish uchun xodim yo'q.</p> : <>
      <label className="field">Xodim<select className="input" disabled={action.busy} value={employeeId} onChange={event => { setEmployeeId(event.target.value); action.setMessage(''); }}>
        {employees.map(item => <option key={item.id} value={item.id}>{item.name} — {state.branches.find(branch => branch.id === item.branchId)?.name}</option>)}
      </select></label>
      <label className="field">Yangi filial<select className="input" disabled={action.busy || !branches.length} value={branchId} onChange={event => { setBranchId(event.target.value); action.setMessage(''); }}>
        {!branches.length && <option value="">Boshqa filial yo‘q</option>}
        {branches.map(branch => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
      </select></label>
      <button className="btn btn-primary" disabled={action.busy || !branchId}>{action.busy ? 'Ko‘chirilmoqda...' : "Ko'chirishni tasdiqlash"}</button>
    </>}
    {action.message && <p role="status">{action.message}</p>}
    <p className="hint">Ko'chirish darhol kuchga kiradi. Xodim yangi filial adminida ko‘rinadi; oldingi savdo, maosh va davomat tarixi saqlanadi.</p>
  </form>;
}

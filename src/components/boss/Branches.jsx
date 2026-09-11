import React, { useState } from 'react';
import ResponsiveTable from '../ResponsiveTable.jsx';
import { uid } from '../../lib/utils.js';
import { logAction } from '../../lib/db.js';
import { useSaveAction } from '../../lib/useSaveAction.js';

export default function Branches({ state, persist, session }) {
  const action = useSaveAction();
  const [name, setName] = useState('');
  const [editing, setEditing] = useState(null);
  const saveBranch = async event => {
    event.preventDefault();
    const cleanName = name.trim().replace(/\s+/g, ' ');
    if (!cleanName) { action.setMessage('Filial nomini kiriting.'); return; }
    const ok = await action.run(() => persist(current => {
      if (current.branches.some(branch => branch.id !== editing?.id && branch.name.trim().toLocaleLowerCase() === cleanName.toLocaleLowerCase())) throw new Error('Bu nomli filial mavjud. Boshqa nom kiriting.');
      if (editing && current.branches.find(branch => branch.id === editing.id)?.name !== editing.name) throw new Error('Filial o‘zgartirilgan. Ro‘yxatdan qayta tanlang.');
      const branches = editing ? current.branches.map(branch => branch.id === editing.id ? { ...branch, name: cleanName } : branch) : [...current.branches, { id: uid(), name: cleanName }];
      return logAction({ ...current, branches }, session.name, editing ? `Filial nomini ${editing.name}dan ${cleanName}ga o‘zgartirdi.` : `Yangi filial qo‘shdi: ${cleanName}.`);
    }));
    if (ok) { setName(''); setEditing(null); }
  };
  const removeBranch = async branch => {
    const blocked = current => current.users.some(user => user.branchId === branch.id) || (current.transfers || []).some(record => record.fromBranchId === branch.id || record.toBranchId === branch.id);
    if (blocked(state)) { action.setMessage('Bu filialga xodim yoki ko‘chirish tarixi bog‘langan. Tarix saqlanishi uchun filialni o‘chirib bo‘lmaydi.'); return; }
    if (!confirm(`${branch.name} filiali o‘chirilsinmi?`)) return;
    await action.run(() => persist(current => {
      if (blocked(current)) throw new Error('Filialga xodim yoki ko‘chirish tarixi bog‘langan.');
      return logAction({ ...current, branches: current.branches.filter(item => item.id !== branch.id) }, session.name, `Filialni o‘chirdi: ${branch.name}.`);
    }), 'Filial o‘chirildi.');
  };
  return <div style={{ maxWidth: 680 }}>
    <form className="branch-create" style={{ display: 'flex', gap: 8, marginBottom: 18, flexWrap: 'wrap' }} onSubmit={saveBranch}>
      <input className="input" aria-label="Filial nomi" placeholder="Yangi filial nomi" required maxLength={200} disabled={action.busy} value={name} onChange={event => setName(event.target.value)} />
      <button className="btn btn-primary" disabled={action.busy}>{action.busy ? 'Saqlanmoqda...' : editing ? 'Nomini saqlash' : 'Filial qo‘shish'}</button>
      {editing && <button type="button" className="btn" disabled={action.busy} onClick={() => { setEditing(null); setName(''); }}>Bekor qilish</button>}
    </form>
    {action.message && <p role="status">{action.message}</p>}
    <ResponsiveTable>
      {!state.branches.length && <div className="empty">Filial yo‘q. Birinchi filialni qo‘shing.</div>}
      {state.branches.map(branch => <div key={branch.id} className="trow" style={{ gridTemplateColumns: '1fr auto auto auto' }}>
        <span>{branch.name}</span><span className="muted">{state.users.filter(user => user.branchId === branch.id && user.active !== false && ['employee', 'admin'].includes(user.role)).length} faol hisob</span>
        <button className="btn btn-sm" disabled={action.busy} aria-label={`${branch.name} nomini tahrirlash`} onClick={() => { setEditing(branch); setName(branch.name); action.setMessage(''); }}>Tahrirlash</button>
        <button className="btn btn-sm btn-red" disabled={action.busy} aria-label={`${branch.name} filialini o‘chirish`} onClick={() => removeBranch(branch)}>O‘chirish</button>
      </div>)}
    </ResponsiveTable>
  </div>;
}

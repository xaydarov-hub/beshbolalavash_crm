import React, { useState } from 'react';
import ResponsiveTable from '../ResponsiveTable.jsx';
import { fmt } from '../../lib/utils.js';
import { logAction } from '../../lib/db.js';
import { useSaveAction } from '../../lib/useSaveAction.js';
import { managesEmployee } from '../workflowSupport.js';

export default function Advances({ state, persist, session }) {
  const action = useSaveAction();
  const [filter, setFilter] = useState('all');
  const ids = new Set(state.users.filter(user => managesEmployee(session, user)).map(user => user.id));
  const requests = [...(state.advances || [])].filter(record => ids.has(record.employeeId) && (filter === 'all' || record.status === filter)).sort((a, b) => Number(b.status === 'kutilmoqda') - Number(a.status === 'kutilmoqda') || (b.requestedAt || '').localeCompare(a.requestedAt || ''));
  const decide = async (request, status) => {
    await action.run(() => persist(current => {
      const live = (current.advances || []).find(record => record.id === request.id);
      if (!live || live.status !== 'kutilmoqda') throw new Error('So‘rov allaqachon ko‘rib chiqilgan. Ro‘yxatni yangilang.');
      const employee = current.users.find(user => user.id === live.employeeId);
      if (!managesEmployee(session, employee)) throw new Error('Bu xodim so‘rovini boshqarishga ruxsat yo‘q.');
      return logAction({ ...current, advances: current.advances.map(record => record.id === live.id ? { ...record, status } : record) }, session.name, `${employee.name}ning ${fmt(live.amount)} so‘mlik avans so‘rovini ${status === 'tasdiqlandi' ? 'tasdiqladi' : 'rad etdi'}.`);
    }), status === 'tasdiqlandi' ? 'Avans tasdiqlandi va shu oyning maoshidan ayiriladi.' : 'So‘rov rad etildi.');
  };
  return <div>
    <label className="field" style={{ maxWidth: 320 }}>So‘rov holati<select className="input" value={filter} onChange={event => setFilter(event.target.value)}><option value="all">Barcha so‘rovlar</option><option value="kutilmoqda">Kutilmoqda</option><option value="tasdiqlandi">Tasdiqlandi</option><option value="radetildi">Rad etildi</option></select></label>
    {action.message && <p role="status">{action.message}</p>}
    <ResponsiveTable>
      <div className="trow thead" style={{ gridTemplateColumns: '1.1fr 0.8fr 1.6fr 1fr' }}><div>Xodim</div><div>Summa</div><div>Sabab</div><div>Holati</div></div>
      {!requests.length && <div className="empty">So'rovlar yo'q.</div>}
      {requests.map(record => <div key={record.id} className="trow" style={{ gridTemplateColumns: '1.1fr 0.8fr 1.6fr 1fr' }}>
        <div>{state.users.find(user => user.id === record.employeeId)?.name}</div>
        <div className="muted">{fmt(record.amount)} so‘m</div>
        <div className="muted">{record.reason}</div>
        <div>{record.status === 'kutilmoqda' ? <div style={{ display: 'flex', gap: 6 }}>
          <button className="btn btn-sm btn-green" disabled={action.busy} onClick={() => decide(record, 'tasdiqlandi')}>Tasdiqlash</button>
          <button className="btn btn-sm btn-red" disabled={action.busy} onClick={() => decide(record, 'radetildi')}>Rad etish</button>
        </div> : <span className={`badge ${record.status === 'tasdiqlandi' ? 'badge-green' : 'badge-red'}`}>{record.status === 'tasdiqlandi' ? 'Tasdiqlandi' : 'Rad etildi'}</span>}</div>
      </div>)}
    </ResponsiveTable>
  </div>;
}

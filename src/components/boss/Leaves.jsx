import React, { useState } from 'react';
import ResponsiveTable from '../ResponsiveTable.jsx';
import { logAction } from '../../lib/db.js';
import { useSaveAction } from '../../lib/useSaveAction.js';
import { managesEmployee } from '../workflowSupport.js';

export default function Leaves({ state, persist, session }) {
  const action = useSaveAction();
  const [filter, setFilter] = useState('all');
  const ids = new Set(state.users.filter(user => managesEmployee(session, user)).map(user => user.id));
  const requests = [...(state.leaveRequests || [])].filter(record => ids.has(record.employeeId) && (filter === 'all' || record.status === filter)).sort((a, b) => Number(b.status === 'kutilmoqda') - Number(a.status === 'kutilmoqda') || b.from.localeCompare(a.from));
  const decide = async (request, status) => {
    await action.run(() => persist(current => {
      const live = (current.leaveRequests || []).find(record => record.id === request.id);
      if (!live || live.status !== 'kutilmoqda') throw new Error('So‘rov allaqachon ko‘rib chiqilgan. Ro‘yxatni yangilang.');
      const employee = current.users.find(user => user.id === live.employeeId);
      if (!managesEmployee(session, employee)) throw new Error('Bu xodim so‘rovini boshqarishga ruxsat yo‘q.');
      // The server writes the approved leave days in the same transaction.
      return logAction({ ...current, leaveRequests: current.leaveRequests.map(record => record.id === live.id ? { ...record, status } : record) }, session.name, `${employee.name}ning ${live.from} — ${live.to} ta’til so‘rovini ${status === 'tasdiqlandi' ? 'tasdiqladi' : 'rad etdi'}.`);
    }), status === 'tasdiqlandi' ? 'Ta’til tasdiqlandi va davomatga yozildi. Ishlagan kunlar saqlandi.' : 'So‘rov rad etildi.');
  };
  return <div>
    <label className="field" style={{ maxWidth: 320 }}>So‘rov holati<select className="input" value={filter} onChange={event => setFilter(event.target.value)}><option value="all">Barcha so‘rovlar</option><option value="kutilmoqda">Kutilmoqda</option><option value="tasdiqlandi">Tasdiqlandi</option><option value="radetildi">Rad etildi</option></select></label>
    {action.message && <p role="status">{action.message}</p>}
    <ResponsiveTable>
      <div className="trow thead" style={{ gridTemplateColumns: '1.1fr 0.7fr 1fr 1.4fr 1fr' }}><div>Xodim</div><div>Turi</div><div>Sana</div><div>Sabab</div><div>Holati</div></div>
      {!requests.length && <div className="empty">So'rovlar yo'q.</div>}
      {requests.map(record => <div key={record.id} className="trow" style={{ gridTemplateColumns: '1.1fr 0.7fr 1fr 1.4fr 1fr' }}>
        <div>{state.users.find(user => user.id === record.employeeId)?.name}</div>
        <div><span className={`badge ${record.type === 'kasal' ? 'badge-yellow' : 'badge-blue'}`}>{record.type === 'kasal' ? 'Kasal' : "Ta'til"}</span></div>
        <div className="muted">{record.from} — {record.to}</div><div className="muted">{record.reason}</div>
        <div>{record.status === 'kutilmoqda' ? <div style={{ display: 'flex', gap: 6 }}>
          <button className="btn btn-sm btn-green" disabled={action.busy} onClick={() => decide(record, 'tasdiqlandi')}>Tasdiqlash</button>
          <button className="btn btn-sm btn-red" disabled={action.busy} onClick={() => decide(record, 'radetildi')}>Rad etish</button>
        </div> : <span className={`badge ${record.status === 'tasdiqlandi' ? 'badge-green' : 'badge-red'}`}>{record.status === 'tasdiqlandi' ? 'Tasdiqlandi' : 'Rad etildi'}</span>}</div>
      </div>)}
    </ResponsiveTable>
  </div>;
}

import React, { useState } from 'react';
import { useSaveAction } from '../lib/useSaveAction.js';

export default function PasswordSettings({ session, onChangePassword, onClose }) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [repeatPassword, setRepeatPassword] = useState('');
  const action = useSaveAction();
  const submit = async event => {
    event.preventDefault();
    if (newPassword.trim().length < 8) { action.setMessage('Yangi parol kamida 8 belgidan iborat bo‘lsin.'); return; }
    if (newPassword !== repeatPassword) { action.setMessage('Yangi parollar mos kelmadi.'); return; }
    const ok = await action.run(() => onChangePassword({ currentPassword, newPassword }), 'Parol yangilandi. Boshqa qurilmalardagi eski sessiyalar yopildi.');
    if (ok) { setCurrentPassword(''); setNewPassword(''); setRepeatPassword(''); }
  };
  return <form className="card card-pad section-gap" onSubmit={submit} aria-label="Parolni almashtirish">
    <h2 className="section-title">Shaxsiy parol</h2>
    {session.firstLogin && <p className="hint">Sizga berilgan boshlang‘ich parolni o‘zingiz biladigan yangi parolga almashtiring.</p>}
    <fieldset disabled={action.busy} style={{ border: 0, padding: 0, margin: 0 }}>
      <div className="grid grid-3">
        <label className="field">Joriy parol<input required type="password" autoComplete="current-password" className="input" value={currentPassword} onChange={event => setCurrentPassword(event.target.value)} /></label>
        <label className="field">Yangi parol<input required minLength={8} maxLength={1024} type="password" autoComplete="new-password" className="input" value={newPassword} onChange={event => setNewPassword(event.target.value)} /></label>
        <label className="field">Yangi parolni takrorlang<input required type="password" autoComplete="new-password" className="input" value={repeatPassword} onChange={event => setRepeatPassword(event.target.value)} /></label>
      </div>
      <button type="submit" className="btn btn-primary">{action.busy ? 'Saqlanmoqda...' : 'Parolni yangilash'}</button>
      <button type="button" className="btn" onClick={onClose}>Yopish</button>
    </fieldset>
    {action.message && <p role="status">{action.message}</p>}
  </form>;
}

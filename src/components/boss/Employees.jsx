import React, { useState } from "react";
import { loginKey } from "../../lib/identity.js";
import { useSaveAction } from "../../lib/useSaveAction.js";
import { uid, todayISO, fmt } from "../../lib/utils.js";
import { SALARY_TYPES } from "../../lib/salary.js";
import { logAction } from "../../lib/db.js";
import EmployeeHistory from "../EmployeeHistory.jsx";
import ResponsiveTable from "../ResponsiveTable.jsx";

const initialForm = () => ({ name: "", phone: "", password: "", branchId: "", role: "employee", position: "Ofitsiant", salaryType: "oylik", rate: "", workStart: "08:00", workEnd: "17:00", hireDate: todayISO() });

export default function Employees({ state, persist, session, deleteUser }) {
  const [search, setSearch] = useState("");
  const [branchFilter, setBranchFilter] = useState("all");
  const [showArchived, setShowArchived] = useState(false);
  const [profileId, setProfileId] = useState("");
  const [notice, setNotice] = useState('');
  const profile = state.users.find(u => u.id === profileId);
  if (profile) return <section>
    <button className="btn" onClick={() => setProfileId("")}>Ro‘yxatga qaytish</button>
    <EmployeeForm key={profile.id} state={state} persist={persist} session={session} employee={profile} deleteUser={deleteUser} onFinished={message => { setProfileId(''); setNotice(message); }} />
    <EmployeeHistory state={state} employeeId={profile.id} />
  </section>;
  const rows = state.users.filter(u => u.role !== "boss" && (showArchived || u.active !== false) && (branchFilter === "all" || u.branchId === branchFilter) && `${u.name} ${u.phone}`.toLowerCase().includes(search.toLowerCase()));
  return <section>
    {notice && <p role="status">{notice}</p>}
    <EmployeeForm state={state} persist={persist} session={session} />
    <div className="grid grid-2">
      <label className="field">Xodimni qidirish<input type="search" className="input" value={search} onChange={e => setSearch(e.target.value)} placeholder="Ism yoki telefon" /></label>
      <label className="field">Filial bo‘yicha ko‘rish<select className="input" value={branchFilter} onChange={e => setBranchFilter(e.target.value)}><option value="all">Barcha filiallar</option>{state.branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}</select></label>
    </div>
    <label><input type="checkbox" checked={showArchived} onChange={e => setShowArchived(e.target.checked)} /> Arxivdagi hisoblarni ham ko‘rsatish</label>
    <p className="hint">{rows.length} ta hisob. Profilni ochib filial, login va parolni tahrirlashingiz mumkin.</p>
    <ResponsiveTable>
      <div className="trow thead" style={{ gridTemplateColumns: "1.3fr 1fr 1fr 1fr 1fr" }}><div>Ism</div><div>Login</div><div>Filial</div><div>Rol / lavozim</div><div>Stavka</div></div>
      {rows.map(u => <div key={u.id} className="trow" style={{ gridTemplateColumns: "1.3fr 1fr 1fr 1fr 1fr" }}>
        <button className="btn" onClick={() => setProfileId(u.id)}>{u.name}{u.active === false ? " (arxiv)" : ""}</button>
        <div>{u.phone}</div><div>{state.branches.find(b => b.id === u.branchId)?.name || "Filial biriktirilmagan"}</div>
        <div>{u.role === "admin" ? "Filial admini" : u.position}</div><div>{u.salaryType === "foiz" ? `${u.rate}%` : fmt(u.rate)}</div>
      </div>)}
      {!rows.length && <div className="empty">Tanlangan filtrda hisob topilmadi.</div>}
    </ResponsiveTable>
  </section>;
}

function EmployeeForm({ state, persist, session, employee, deleteUser, onFinished }) {
  const [form, setForm] = useState(() => employee ? { ...initialForm(), ...employee, password: "", rate: String(employee.rate ?? 0) } : initialForm());
  const [created, setCreated] = useState(null);
  const action = useSaveAction();
  const field = key => ({ value: form[key], onChange: e => { setForm(s => ({ ...s, [key]: e.target.value })); action.setMessage(""); } });
  const admins = state.users.filter(u => u.role === "admin" && u.branchId === form.branchId && u.active !== false);
  async function submit(event) {
    event.preventDefault();
    const password = form.password.trim();
    if (!form.name.trim() || !loginKey(form.phone) || !state.branches.some(b => b.id === form.branchId)) { action.setMessage("Ism, login va mavjud filialni kiriting."); return; }
    if ((!employee || password) && password.length < 4) { action.setMessage("Parol kamida 4 belgidan iborat bo‘lsin."); return; }
    if (!form.rate.trim() || !Number.isFinite(Number(form.rate)) || Number(form.rate) < 0 || (form.salaryType === "foiz" && Number(form.rate) > 100)) { action.setMessage("Maosh stavkasini to‘g‘ri kiriting. Foiz 0–100 oralig‘ida."); return; }
    if (state.users.some(u => u.id !== employee?.id && loginKey(u.phone) === loginKey(form.phone))) { action.setMessage("Bu login allaqachon mavjud. Ro‘yxatdan hisobni oching."); return; }
    const id = employee?.id || uid();
    const values = { name: form.name.trim(), phone: loginKey(form.phone), branchId: form.branchId, role: form.role, position: form.position.trim(), salaryType: form.salaryType, rate: Number(form.rate), workStart: form.workStart, workEnd: form.workEnd, hireDate: form.hireDate, ...(password ? { customPassword: password } : {}) };
    const ok = await action.run(() => persist(current => {
      const existing = current.users.find(u => u.id === id);
      if (employee && JSON.stringify(existing) !== JSON.stringify(employee)) throw new Error("Profil boshqa qurilmada yangilandi. Ro‘yxatga qaytib profilni qayta oching.");
      const user = { ...(existing || { id, active: true, firstLogin: true }), ...values };
      let next = { ...current, users: existing ? current.users.map(u => u.id === id ? user : u) : [...current.users, user] };
      if (existing && existing.branchId !== user.branchId) next.transfers = [...(current.transfers || []), { id: uid(), employeeId: id, fromBranchId: existing.branchId, toBranchId: user.branchId, effectiveDate: todayISO(), by: session.name }];
      return logAction(next, session.name, `${user.name}: ${existing ? "profil yangilandi" : "hisob yaratildi"}.`);
    }), employee ? "Profil serverga saqlandi." : "Yangi hisob serverga saqlandi.");
    if (ok) {
      setCreated({ name: values.name, phone: values.phone, branch: state.branches.find(b => b.id === values.branchId)?.name });
      setForm(employee ? { ...form, password: "" } : { ...initialForm(), branchId: form.branchId });
    }
  }
  async function archive() {
    if (!confirm(employee.active === false ? "Hisob qayta faollashtirilsinmi?" : "Hisob arxivlansinmi? Xodimning barcha tarixi saqlanadi.")) return;
    const ok = await action.run(() => persist(current => logAction({ ...current, users: current.users.map(u => u.id === employee.id ? { ...u, active: employee.active === false, endDate: employee.active === false ? null : todayISO() } : u) }, session.name, `${employee.name}: hisob ${employee.active === false ? "faollashtirildi" : "arxivlandi"}.`)));
    if (ok) onFinished?.(employee.active === false ? 'Hisob faollashtirildi.' : 'Hisob arxivlandi. Faol ro‘yxatdan olib tashlandi; tarix arxivda saqlanadi.');
  }
  async function remove() {
    if (!confirm(`${employee.name} (${employee.phone}) butunlay o‘chirilsinmi? Hisob, davomat, savdo va unga bog‘liq maosh yozuvlari o‘chadi. Tarixni saqlash uchun arxivlashni tanlang.`)) return;
    const ok = await action.run(() => deleteUser(employee));
    if (ok) onFinished?.('Hisob va unga bog‘liq yozuvlar serverdan o‘chirildi.');
  }
  return <form className="card card-pad section-gap" onSubmit={submit}>
    <h3 className="section-title">{employee ? `${employee.name} — profil` : "Yangi xodim / admin qo‘shish"}</h3>
    <fieldset disabled={action.busy} style={{ border: 0, padding: 0, margin: 0 }}>
      <div className="grid grid-2">
        <label className="field">Ism-familiya<input required className="input" {...field("name")} /></label>
        <label className="field">Telefon yoki login<input required autoCapitalize="none" autoCorrect="off" className="input" {...field("phone")} /></label>
        <label className="field">{employee ? "Yangi parol (almashtirish uchun)" : "Boshlang‘ich parol"}<input required={!employee} minLength={4} autoComplete="new-password" type="password" className="input" {...field("password")} /></label>
        <label className="field">Filial<select required className="input" {...field("branchId")}><option value="">Filialni tanlang</option>{state.branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}</select></label>
        <label className="field">Rol<select className="input" {...field("role")}><option value="employee">Xodim</option><option value="admin">Filial admini</option></select></label>
        <label className="field">Lavozim<input required className="input" {...field("position")} /></label>
        <label className="field">Maosh turi<select className="input" {...field("salaryType")}>{SALARY_TYPES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}</select></label>
        <label className="field">{form.salaryType === "foiz" ? "Savdodan foiz (%)" : "Stavka (so‘m)"}<input required min="0" max={form.salaryType === "foiz" ? "100" : "1000000000000"} step="any" type="number" inputMode="decimal" className="input" {...field("rate")} /></label>
        <label className="field">Ish boshlanishi<input required type="time" className="input" {...field("workStart")} /></label>
        <label className="field">Ish tugashi<input required type="time" className="input" {...field("workEnd")} /></label>
        <label className="field">Ishga kirgan sana<input required type="date" className="input" {...field("hireDate")} /></label>
      </div>
      {form.branchId && <p className="hint">{form.role === "admin" ? "Admin shu filialdagi xodimlarni ko‘radi." : admins.length ? `Xodim quyidagi adminlarda ko‘rinadi: ${admins.map(u => u.name).join(", ")}.` : "Bu filialga hali admin biriktirilmagan. Boshliq xodimni ko‘radi; filial adminini ham shu filialga biriktiring."}</p>}
      <button className="btn btn-primary" type="submit">{action.busy ? "Saqlanmoqda..." : employee ? "Profilni saqlash" : "Xodimni qo‘shish"}</button>
      {employee && <button className="btn" type="button" onClick={archive}>{employee.active === false ? "Hisobni faollashtirish" : "Hisobni arxivlash"}</button>}
      {employee && deleteUser && <button className="btn btn-red" type="button" onClick={remove}>Hisobni butunlay o‘chirish</button>}
    </fieldset>
    {action.message && <p role="status">{action.message}</p>}
    {created && <p className="hint">{created.name} · Login: {created.phone} · Filial: {created.branch}</p>}
  </form>;
}

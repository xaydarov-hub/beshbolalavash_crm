import { loginKey } from '../../lib/identity.js';
import ResponsiveTable from "../ResponsiveTable.jsx";
import EmployeeHistory from "../EmployeeHistory.jsx";
import React, { useState } from "react";
import { uid, fmt } from "../../lib/utils.js";
import { SALARY_TYPES } from "../../lib/salary.js";
import { logAction } from "../../lib/db.js";
import { computeEmployeeReport } from "../../lib/salary.js";
import { todayISO, monthKey } from "../../lib/utils.js";

const POSITIONS = ["Ofitsiant", "Kassir", "Oshpaz", "Kuryer (Zim-Zim)", "Tozalovchi", "Filial admini", "Boshqa"];

export default function Employees({ state, persist, session, firebaseMode }) {
  const [form, setForm] = useState({
    name: "", phone: "", year: "", password: "", workStart: "08:00", workEnd: "17:00", branchId: state.branches[0]?.id || "",
    role: "employee", position: POSITIONS[0], salaryType: "oylik", rate: "", email: "", temporaryPassword: "",
  });
  const [search, setSearch] = useState("");
  const [created, setCreated] = useState(null);
  const [profileId, setProfileId] = useState(null);

  const addUser = async () => {
    if (!form.name.trim() || !form.phone.trim() || (!firebaseMode && !form.password.trim())) return;
    if (!Number.isFinite(Number(form.rate)) || Number(form.rate) < 0 || (form.salaryType === "foiz" && Number(form.rate) > 100)) { alert("Stavkani to‘g‘ri kiriting. Foiz 0–100 oralig‘ida bo‘lishi kerak."); return; }
    const phone = loginKey(form.phone);
    if (!state.branches.some(b => b.id === form.branchId)) { alert("Filialni tanlang."); return; }
    if (state.users.some((u) => loginKey(u.phone) === phone)) { alert("Bu raqam bilan foydalanuvchi mavjud."); return; }
    if (firebaseMode) {
      if (!form.email.trim() || form.temporaryPassword.length < 8) { alert("Xodimning emaili va kamida 8 belgili vaqtinchalik parolini kiriting."); return; }
      try {
        const { createFirebaseEmployee } = await import("../../lib/firebaseApi.js");
        const profile = await createFirebaseEmployee({ ...form, phone, temporaryPassword: form.temporaryPassword, hireDate: todayISO() });
        setCreated(profile);
        setForm({ ...form, name: "", phone: "", year: "", email: "", temporaryPassword: "", rate: "" });
      } catch (error) {
        alert(error?.message || "Xodim Firebase’da yaratilmagan. Functions deploy qilinganini tekshiring.");
      }
      return;
    }
    const newUser = {
      id: uid(), role: form.role, name: form.name.trim(), phone, year: form.password.trim(), customPassword: form.password.trim(),
      workStart: form.workStart, workEnd: form.workEnd,
      branchId: form.branchId || null,
      position: form.role === "admin" ? "Filial admini" : form.position,
      salaryType: form.role === "employee" ? form.salaryType : "oylik",
      rate: parseFloat(form.rate) || 0,
      hireDate: todayISO(), firstLogin: true,
    };
    const ok = await persist((s) => logAction(
      { ...s, users: [...s.users, newUser] },
      session.name, `Yangi ${form.role === "admin" ? "admin" : "xodim"} qo'shdi: ${newUser.name}.`
    ));
    if (!ok) return;
    setCreated(newUser);
    setForm({ ...form, name: "", phone: "", year: "", password: "", rate: "" });
  };

  const removeUser = (u) => {
    if (!confirm(`${u.name} o'chirilsinmi?`)) return;
    persist((s) => logAction(
      { ...s, users: s.users.filter((x) => x.id !== u.id) },
      session.name, `${u.name}ni tizimdan o'chirdi.`
    ));
  };

  const profile = profileId ? state.users.find((u) => u.id === profileId) : null;

  return (
    <div>
      {profile ? (
        <EmployeeProfile state={state} persist={persist} session={session} emp={profile} onBack={() => setProfileId(null)} />
      ) : (
        <>
          <div className="card card-pad section-gap">
            <h3 className="section-title">Yangi xodim / admin qo'shish</h3>
            <div className="grid grid-2">
              <label className="field"><div className="label">Ism-familiya</div>
                <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
              <label className="field"><div className="label">Telefon raqami (login)</div>
                <input className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="90XXXXXXX" /></label>
              {!firebaseMode && <label className="field"><div className="label">Boshlang'ich parol</div>
                <input className="input" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="Xodimga beriladigan parol" /></label>}
              {!firebaseMode && <>
                <label className="field"><div className="label">Ish boshlanishi (24 soat)</div>
                  <input className="input" type="time" value={form.workStart} onChange={(e) => setForm({ ...form, workStart: e.target.value })} placeholder="08:00" /></label>
                <label className="field"><div className="label">Ish tugashi (24 soat)</div>
                  <input className="input" type="time" value={form.workEnd} onChange={(e) => setForm({ ...form, workEnd: e.target.value })} placeholder="17:00" /></label>
              </>}
              {firebaseMode && <>
                <label className="field"><div className="label">Xodim emaili (login)</div>
                  <input type="email" className="input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="xodim@email.com" /></label>
                <label className="field"><div className="label">Vaqtinchalik parol (kamida 8 belgi)</div>
                  <input type="password" className="input" value={form.temporaryPassword} onChange={(e) => setForm({ ...form, temporaryPassword: e.target.value })} /></label>
              </>}
              <label className="field"><div className="label">Filial</div>
                <select className="input" value={form.branchId} onChange={(e) => setForm({ ...form, branchId: e.target.value })}>
                  {state.branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select></label>
              <label className="field"><div className="label">Rol</div>
                <select className="input" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                  <option value="employee">Oddiy xodim</option>
                  <option value="admin">Filial admini</option>
                </select></label>
              {form.role === "employee" && (
                <label className="field"><div className="label">Ish kategoriyasi (lavozim)</div>
                  <select className="input" value={form.position} onChange={(e) => setForm({ ...form, position: e.target.value })}>
                    {POSITIONS.map((p) => <option key={p} value={p}>{p}</option>)}
                  </select></label>
              )}
              {form.role === "employee" && (
                <>
                  <label className="field"><div className="label">Maosh turi</div>
                    <select className="input" value={form.salaryType} onChange={(e) => setForm({ ...form, salaryType: e.target.value })}>
                      {SALARY_TYPES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
                    </select></label>
                  <label className="field"><div className="label">
                    {form.salaryType === "oylik" && "Oylik summa (so'm)"}
                    {form.salaryType === "kunlik" && "Kunlik stavka (so'm)"}
                    {form.salaryType === "soatlik" && "Soatlik stavka (so'm)"}
                    {form.salaryType === "foiz" && "Foiz stavkasi (%)"}
                  </div>
                    <input type="number" className="input" value={form.rate} onChange={(e) => setForm({ ...form, rate: e.target.value })} /></label>
                </>
              )}
            </div>
            <button className="btn btn-primary" onClick={addUser}>➕ Qo'shish</button>

            {created && (
              <div className="hint" style={{ marginTop: 14, background: "#EFF4EB", border: "1px solid var(--herb)", borderRadius: 8, padding: "10px 14px", color: "var(--herb)" }}>
                🔑 <b>{created.name}</b> qo'shildi. Login: <b>{firebaseMode ? created.email : created.phone}</b> · Boshlang'ich parol: <b>{firebaseMode ? "siz belgilagan vaqtinchalik parol" : (created.customPassword || created.year)}</b>{firebaseMode ? ". Xodim birinchi kirishda parolini almashtirishi kerak." : " — shu login va parol bilan kiradi."}
              </div>
            )}
          </div>

          <label className="field">Xodimni qidirish<input type="search" className="input" value={search} onChange={e => setSearch(e.target.value)} placeholder="Ism yoki telefon" /></label>
          <ResponsiveTable>
            <div className="trow thead" style={{ gridTemplateColumns: "1.3fr 1fr 1fr 1fr 1fr 0.7fr 40px" }}>
              <div>Ism</div><div>Login</div><div>Filial</div><div>Lavozim</div><div>Maosh turi</div><div>Stavka</div><div></div>
            </div>
            {state.users.filter((u) => u.role !== "boss" && `${u.name} ${u.phone}`.toLowerCase().includes(search.toLowerCase())).map((u) => (
              <div key={u.id} className="trow" style={{ gridTemplateColumns: "1.3fr 1fr 1fr 1fr 1fr 0.7fr 40px", cursor: "pointer" }}
                >
                <button className="btn" onClick={() => setProfileId(u.id)}>{u.name}</button>
                <div className="muted">{u.phone}</div>
                <div className="muted" style={{ fontSize: 12 }}>{state.branches.find((b) => b.id === u.branchId)?.name || "—"}</div>
                <div>{u.position}</div>
                <div className="muted" style={{ fontSize: 12 }}>{SALARY_TYPES.find((t) => t.id === u.salaryType)?.label || "—"}</div>
                <div style={{ color: "var(--sauce)" }}>{u.salaryType === "foiz" ? `${u.rate}%` : fmt(u.rate)}</div>
                <button className="btn-icon" onClick={(e) => { e.stopPropagation(); removeUser(u); }}>🗑</button>
              </div>
            ))}
          </ResponsiveTable>
        </>
      )}
    </div>
  );
}

function EmployeeProfile({ state, emp, onBack, persist, session }) {
  const [branchId, setBranchId] = useState(emp.branchId || '');
  const [salaryType, setSalaryType] = useState(emp.salaryType);
  const [rate, setRate] = useState(String(emp.rate));
  const [passwordDraft, setPasswordDraft] = useState(emp.customPassword || emp.year || "");
  const updateSalary = () => {
    const value = Number(rate);
    if (!rate.trim() || !Number.isFinite(value) || value < 0 || (salaryType === "foiz" && value > 100)) { alert("Stavkani to‘g‘ri kiriting. Foiz 0–100 oralig‘ida."); return; }
    persist(current => logAction({ ...current, users: current.users.map(u => u.id === emp.id ? { ...u, salaryType, rate: value } : u) }, session.name, `${emp.name}: maosh turi ${salaryType}, stavka ${value}.`));
  };
  const updatePassword = () => {
    const nextPassword = passwordDraft.trim();
    if (!session || session.role !== "boss") return;
    if (!nextPassword) { alert("Parolni kiriting."); return; }
    persist(current => logAction({
      ...current,
      users: current.users.map(u => u.id === emp.id ? { ...u, customPassword: nextPassword, year: nextPassword } : u),
    }, session.name, `${emp.name} uchun parol o'zgartirildi.`));
  };
  const month = monthKey(todayISO());
  const r = computeEmployeeReport(state, emp.id, month);
  const branch = state.branches.find((b) => b.id === emp.branchId);
  const attPct = r.worked + r.absentDays + r.leaveDays > 0
    ? Math.round((r.worked / (r.worked + r.absentDays + r.leaveDays)) * 100) : 0;

  return (
    <div>
      <button className="btn btn-sm" style={{ marginBottom: 16 }} onClick={onBack}>← Orqaga</button>
      <div className="card card-pad section-gap">
        <h2 style={{ fontSize: 20, marginBottom: 4 }}>{emp.name}</h2>
        <label className="field">Filial<select className="input" value={branchId} onChange={e => setBranchId(e.target.value)}>{state.branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}</select></label>
        <button className="btn" onClick={() => persist(current => logAction({ ...current, users: current.users.map(u => u.id === emp.id ? { ...u, branchId } : u) }, session.name, `${emp.name}: filial yangilandi.`))}>Filialni saqlash</button>
        <p className="hint">Admin o‘z filialidagi xodimlarni ko‘radi. Admin va xodim filialini bir xil belgilang.</p>
        <div className="grid grid-2">
          <label className="field">Maosh turi<select className="input" value={salaryType} onChange={e => setSalaryType(e.target.value)}>{SALARY_TYPES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}</select></label>
          <label className="field">{salaryType === "foiz" ? "Savdodan foiz (%)" : "Stavka (so‘m)"}<input type="number" inputMode="decimal" className="input" min="0" max={salaryType === "foiz" ? 100 : undefined} step="any" value={rate} onChange={e => setRate(e.target.value)} /></label>
        </div>
        <button className="btn btn-primary" onClick={updateSalary}>Maosh sozlamalarini saqlash</button>
        <p className="hint">Oldin kiritilgan kunlik savdolarning foiz stavkasi saqlanadi. Yangi stavka keyingi yozuvlarga qo‘llanadi.</p>
        <div className="muted" style={{ fontSize: 13, marginBottom: 16 }}>{emp.position} · {branch?.name}</div>

        {session?.role === "boss" && (
          <div className="grid grid-2" style={{ marginTop: 12 }}>
            <label className="field">
              <div className="label">Parol</div>
              <input className="input" type="text" value={passwordDraft} onChange={(e) => setPasswordDraft(e.target.value)} />
            </label>
            <div style={{ display: "flex", alignItems: "end" }}>
              <button className="btn btn-primary" onClick={updatePassword}>Parolni yangilash</button>
            </div>
          </div>
        )}

        <div className="grid grid-4">
          <div><div className="muted" style={{ fontSize: 12 }}>📞 Telefon</div><div>{emp.phone}</div></div>
          <div><div className="muted" style={{ fontSize: 12 }}>📅 Ishga kirgan</div><div>{emp.hireDate}</div></div>
          <div><div className="muted" style={{ fontSize: 12 }}>💼 Maosh turi</div><div>{SALARY_TYPES.find((t) => t.id === emp.salaryType)?.label}</div></div>
          <div><div className="muted" style={{ fontSize: 12 }}>🟢 Davomat %</div><div>{attPct}%</div></div>
        </div>
      </div>
      <div className="grid grid-4 section-gap">
        <div className="stat-card"><div className="label">⏱ Ishlagan kun (bu oy)</div><div className="value">{r.worked}</div></div>
        <div className="stat-card"><div className="label">➕ Jami bonus</div><div className="value green">+{fmt(r.bonuses)}</div></div>
        <div className="stat-card"><div className="label">➖ Jami jarima</div><div className="value red">-{fmt(r.fines)}</div></div>
        <div className="stat-card"><div className="label">💰 Bu oy maosh</div><div className="value accent">{fmt(r.total)}</div></div>
      </div>
      <h3 className="section-title">📝 Izohlar / o'zgarishlar tarixi</h3>
      <EmployeeHistory state={state} employeeId={emp.id} />
      <ResponsiveTable>
        {r.adjRecords.length === 0 && <div className="empty">Yozuv yo'q.</div>}
        {[...r.adjRecords].reverse().map((a) => (
          <div key={a.id} className="trow" style={{ gridTemplateColumns: "1fr 1fr 2fr auto" }}>
            <span className="muted">{a.date}</span>
            <span className={a.type === "jarima" ? "badge badge-red" : "badge badge-green"}>
              {a.type === "jarima" ? "Jarima" : "Bonus"}
            </span>
            <span className="muted">{a.comment}</span>
            <span>{a.type === "jarima" ? "-" : "+"}{fmt(a.amount)}</span>
          </div>
        ))}
      </ResponsiveTable>
    </div>
  );
}

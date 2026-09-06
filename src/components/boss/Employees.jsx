import React, { useState } from "react";
import { uid, fmt } from "../../lib/utils.js";
import { SALARY_TYPES } from "../../lib/salary.js";
import { logAction } from "../../lib/db.js";
import { computeEmployeeReport } from "../../lib/salary.js";
import { todayISO, monthKey } from "../../lib/utils.js";
import { createFirebaseEmployee } from "../../lib/firebaseApi.js";

const POSITIONS = ["Ofitsiant", "Kassir", "Oshpaz", "Kuryer (Zim-Zim)", "Tozalovchi", "Filial admini", "Boshqa"];

export default function Employees({ state, persist, session, firebaseMode }) {
  const [form, setForm] = useState({
    name: "", phone: "", year: "", password: "", branchId: state.branches[0]?.id || "",
    role: "employee", position: POSITIONS[0], salaryType: "oylik", rate: "", email: "", temporaryPassword: "",
  });
  const [created, setCreated] = useState(null);
  const [profileId, setProfileId] = useState(null);

  const addUser = async () => {
    if (!form.name.trim() || !form.phone.trim() || (!firebaseMode && !form.password.trim())) return;
    const phone = form.phone.replace(/\D/g, "");
    if (state.users.some((u) => u.phone.replace(/\D/g, "") === phone)) { alert("Bu raqam bilan foydalanuvchi mavjud."); return; }
    if (firebaseMode) {
      if (!form.email.trim() || form.temporaryPassword.length < 8) { alert("Xodimning emaili va kamida 8 belgili vaqtinchalik parolini kiriting."); return; }
      try {
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
      branchId: form.branchId || null,
      position: form.role === "admin" ? "Filial admini" : form.position,
      salaryType: form.role === "employee" ? form.salaryType : "oylik",
      rate: parseFloat(form.rate) || 0,
      hireDate: todayISO(), firstLogin: true,
    };
    persist((s) => logAction(
      { ...s, users: [...s.users, newUser] },
      session.name, `Yangi ${form.role === "admin" ? "admin" : "xodim"} qo'shdi: ${newUser.name}.`
    ));
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
        <EmployeeProfile state={state} emp={profile} onBack={() => setProfileId(null)} />
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

          <div className="table-wrap">
            <div className="trow thead" style={{ gridTemplateColumns: "1.3fr 1fr 1fr 1fr 1fr 0.7fr 40px" }}>
              <div>Ism</div><div>Login</div><div>Filial</div><div>Lavozim</div><div>Maosh turi</div><div>Stavka</div><div></div>
            </div>
            {state.users.filter((u) => u.role !== "boss").map((u) => (
              <div key={u.id} className="trow" style={{ gridTemplateColumns: "1.3fr 1fr 1fr 1fr 1fr 0.7fr 40px", cursor: "pointer" }}
                onClick={() => setProfileId(u.id)}>
                <div>{u.name}</div>
                <div className="muted">{u.phone}</div>
                <div className="muted" style={{ fontSize: 12 }}>{state.branches.find((b) => b.id === u.branchId)?.name || "—"}</div>
                <div>{u.position}</div>
                <div className="muted" style={{ fontSize: 12 }}>{SALARY_TYPES.find((t) => t.id === u.salaryType)?.label || "—"}</div>
                <div style={{ color: "var(--sauce)" }}>{u.salaryType === "foiz" ? `${u.rate}%` : fmt(u.rate)}</div>
                <button className="btn-icon" onClick={(e) => { e.stopPropagation(); removeUser(u); }}>🗑</button>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function EmployeeProfile({ state, emp, onBack }) {
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
        <div className="muted" style={{ fontSize: 13, marginBottom: 16 }}>{emp.position} · {branch?.name}</div>
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
      <div className="table-wrap">
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
      </div>
    </div>
  );
}

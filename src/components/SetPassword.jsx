import React, { useState } from "react";

export default function SetPassword({ user, onSet }) {
  const [p1, setP1] = useState("");
  const [p2, setP2] = useState("");
  const [error, setError] = useState("");

  const submit = () => {
    if (p1.length < 4) { setError("Parol kamida 4 belgidan iborat bo'lsin."); return; }
    if (p1 !== p2) { setError("Parollar mos kelmadi."); return; }
    onSet(p1);
  };

  return (
    <div className="login-wrap">
      <div className="login-brand">🔐 Xavfsizlik</div>
      <div className="card card-pad">
        <h1 style={{ fontSize: 19, fontWeight: 700, marginBottom: 8 }}>Yangi parol o'rnating</h1>
        <p className="muted" style={{ fontSize: 13, marginBottom: 18 }}>
          Salom, {user.name}. Bu birinchi kirishingiz — xavfsizlik uchun tug'ilgan yil o'rniga shaxsiy parol o'rnating.
        </p>
        <label className="field">
          <div className="label">Yangi parol</div>
          <input className="input" type="password" value={p1} onChange={(e) => setP1(e.target.value)} />
        </label>
        <label className="field">
          <div className="label">Parolni takrorlang</div>
          <input className="input" type="password" value={p2} onChange={(e) => setP2(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()} />
        </label>
        {error && <div style={{ color: "var(--sauce-dark)", fontSize: 13, marginBottom: 10 }}>{error}</div>}
        <button className="btn btn-primary" style={{ width: "100%", justifyContent: "center" }} onClick={submit}>
          Saqlash va davom etish
        </button>
      </div>
    </div>
  );
}

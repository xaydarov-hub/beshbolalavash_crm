import React, { useState } from "react";

export default function Login({ users, onLogin }) {
  const [phone, setPhone] = useState("");
  const [pass, setPass] = useState("");
  const [error, setError] = useState("");

  const [busy, setBusy] = useState(false);
  const submit = async () => {
    if (busy) return;
    setError("");
    const rawValue = phone.trim();
    if (!rawValue || !pass.trim()) { setError("Login va parolni kiriting."); return; }

    setBusy(true);
    try { await onLogin({
      phone: rawValue,
      pass: pass.trim(),
    }); } finally { setBusy(false); }
  };

  return (
    <div className="login-wrap">
      <div className="login-brand">🥙 Besh Bola Lavash — boshqaruv</div>
      <div className="card card-pad">
        <h1 style={{ fontSize: 20, fontWeight: 700, textAlign: "center", marginBottom: 18 }}>
          Tizimga kirish
        </h1>
        <label className="field">
          <div className="label">Login</div>
          <input autoComplete="username" autoCapitalize="none" autoCorrect="off" className="input" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Telefon yoki login" />
        </label>
        <label className="field">
          <div className="label">Parol</div>
          <input autoComplete="current-password" className="input" type="password" value={pass} onChange={(e) => setPass(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()} placeholder="••••" />
        </label>
        {error && <div style={{ color: "var(--sauce-dark)", fontSize: 13, marginBottom: 10 }}>{error}</div>}
        <button className="btn btn-primary" style={{ width: "100%", justifyContent: "center" }} onClick={submit} disabled={busy}>
          {busy ? "Kirilmoqda..." : "Kirish"}
        </button>

      </div>
    </div>
  );
}

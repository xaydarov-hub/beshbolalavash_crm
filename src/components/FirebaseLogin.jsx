import React, { useState } from "react";
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "../lib/firebase.js";

export default function FirebaseLogin({ onFirstBoss }) {
  const [mode, setMode] = useState("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setError("");
    if (!email.trim() || !password) { setError("Email va parolni kiriting."); return; }
    if (mode === "setup" && !name.trim()) { setError("Rahbar ism-familiyasini kiriting."); return; }
    if (mode === "setup" && password.length < 8) { setError("Parol kamida 8 belgidan iborat bo'lsin."); return; }
    setBusy(true);
    try {
      if (mode === "login") {
        await signInWithEmailAndPassword(auth, email.trim(), password);
      } else {
        const credential = await createUserWithEmailAndPassword(auth, email.trim(), password);
        await onFirstBoss({ uid: credential.user.uid, name: name.trim(), email: email.trim() });
      }
    } catch (cause) {
      const message = cause?.code === "auth/invalid-credential" ? "Email yoki parol noto'g'ri." : cause?.code === "auth/email-already-in-use" ? "Bu email bilan hisob allaqachon mavjud." : "Kirishda xatolik yuz berdi. Internet va Firebase sozlamalarini tekshiring.";
      setError(message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login-wrap">
      <div className="login-brand">🥙 Besh Bola Lavash — boshqaruv</div>
      <div className="card card-pad">
        <h1 style={{ fontSize: 20, fontWeight: 700, textAlign: "center", marginBottom: 8 }}>
          {mode === "login" ? "Tizimga kirish" : "Birinchi rahbar hisobini yaratish"}
        </h1>
        {mode === "setup" && <p className="hint" style={{ marginTop: 0, marginBottom: 14 }}>Bu faqat tizimda hali rahbar bo'lmasa ishlatiladi.</p>}
        {mode === "setup" && <label className="field"><div className="label">Rahbar F.I.Sh.</div>
          <input className="input" value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" />
        </label>}
        <label className="field"><div className="label">Korporativ email</div>
          <input type="email" className="input" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" placeholder="rahbar@company.uz" />
        </label>
        <label className="field"><div className="label">Parol</div>
          <input type="password" className="input" value={password} onChange={(event) => setPassword(event.target.value)} onKeyDown={(event) => event.key === "Enter" && submit()} autoComplete={mode === "login" ? "current-password" : "new-password"} />
        </label>
        {error && <div style={{ color: "var(--sauce-dark)", fontSize: 13, marginBottom: 10 }}>{error}</div>}
        <button className="btn btn-primary" disabled={busy} style={{ width: "100%", justifyContent: "center" }} onClick={submit}>{busy ? "Kutilmoqda..." : mode === "login" ? "Kirish" : "Rahbar hisobini yaratish"}</button>
        <button className="btn btn-sm" style={{ marginTop: 12, width: "100%", justifyContent: "center" }} onClick={() => { setMode(mode === "login" ? "setup" : "login"); setError(""); }}>
          {mode === "login" ? "Birinchi marta sozlash" : "Menda hisob bor"}
        </button>
      </div>
    </div>
  );
}

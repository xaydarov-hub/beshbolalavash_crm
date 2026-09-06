import React, { useState } from "react";
import { updatePassword } from "firebase/auth";
import { doc, updateDoc } from "firebase/firestore";
import { auth, firestore, ORGANIZATION_ID } from "../lib/firebase.js";

export default function FirebaseSetPassword({ profile, onDone }) {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");

  const submit = async () => {
    if (password.length < 8) { setError("Parol kamida 8 belgidan iborat bo'lsin."); return; }
    if (password !== confirmPassword) { setError("Parollar mos kelmadi."); return; }
    try {
      await updatePassword(auth.currentUser, password);
      await updateDoc(doc(firestore, "organizations", ORGANIZATION_ID, "users", profile.id), { mustChangePassword: false });
      onDone();
    } catch (cause) {
      setError(cause?.code === "auth/requires-recent-login" ? "Xavfsizlik uchun qayta kirib, parolni almashtiring." : "Parolni saqlab bo'lmadi.");
    }
  };

  return <div className="login-wrap"><div className="login-brand">🔐 Xavfsizlik</div><div className="card card-pad">
    <h1 style={{ fontSize: 19, marginBottom: 8 }}>Yangi parol o'rnating</h1>
    <p className="hint">Salom, {profile.name}. Vaqtinchalik parolni almashtiring.</p>
    <label className="field"><div className="label">Yangi parol</div><input type="password" className="input" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" /></label>
    <label className="field"><div className="label">Parolni takrorlang</div><input type="password" className="input" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} onKeyDown={(event) => event.key === "Enter" && submit()} autoComplete="new-password" /></label>
    {error && <div style={{ color: "var(--sauce-dark)", fontSize: 13, marginBottom: 10 }}>{error}</div>}
    <button className="btn btn-primary" style={{ width: "100%", justifyContent: "center" }} onClick={submit}>Saqlash va davom etish</button>
  </div></div>;
}

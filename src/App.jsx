import { request } from "./lib/api.js";
import { stateChanges } from "./lib/changes.js";
import React, { useEffect, useState, useRef } from "react";
import { sendTelegramMessage } from "./lib/telegram.js";
import Login from "./components/Login.jsx";
import Shell from "./components/Shell.jsx";
import BossDashboard from "./components/boss/BossDashboard.jsx";
import AdminDashboard from "./components/admin/AdminDashboard.jsx";
import EmployeeDashboard from "./components/employee/EmployeeDashboard.jsx";

export default function App() {
  const stateRef = useRef(null);
  const queue = useRef(Promise.resolve());
  const [saving, setSaving] = useState(false);
  const [state, setState] = useState(null);
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const acceptState = (next) => {
    stateRef.current = next;
    setState(next);
  };
  const fetchState = async () => {
    setLoading(true); setError("");
    try {
      const data = await request("/api/state", { timeout: 45000 });
      acceptState(data.state); setSession(data.user);
    } catch (error) {
      if (error.status === 401) localStorage.removeItem("bbl-crm-token");
      setError(error.message);
    } finally { setLoading(false); }
  };
  useEffect(() => {
    if (localStorage.getItem("bbl-crm-token")) fetchState();
    else setLoading(false);
  }, []);

  useEffect(() => {
    if (!session || saving) return;
    let active = true, inFlight = false;
    const refresh = async () => {
      if (inFlight || document.hidden) return;
      inFlight = true;
      try {
        const revision = stateRef.current?.revision || 0;
        const data = await request("/api/state", { headers: { "If-None-Match": `"${session.id}:${revision}"` } });
        if (active && data?.state && (data.state.revision || 0) > (stateRef.current?.revision || 0)) acceptState(data.state);
      } catch (error) {
        if (active && error.status === 401) { localStorage.removeItem("bbl-crm-token"); setSession(null); setError("Sessiya tugadi. Qayta kiring."); }
      } finally { inFlight = false; }
    };
    const timer = setInterval(refresh, 30000 + Math.floor(Math.random() * 5000));
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => { active = false; clearInterval(timer); window.removeEventListener("focus", refresh); document.removeEventListener("visibilitychange", refresh); };
  }, [session?.id, saving]);

  const persist = (updater) => {
    const operation = queue.current.then(async () => {
      setSaving(true); setError("");
      try {
        const previous = stateRef.current;
        const next = typeof updater === "function" ? updater(previous) : updater;
        const changes = stateChanges(previous, next);
        if (!changes.length) return true;
        const data = await request("/api/state", { method: "PATCH", body: { changes } });
        acceptState(data.state);
        return true;
      } catch (error) { setError(error.message); return false; }
      finally { setSaving(false); }
    });
    queue.current = operation.catch(() => {});
    return operation;
  };
  const saveSale = (input) => {
    const operation = queue.current.then(async () => {
      setSaving(true);
      try {
        const data = await request("/api/sales", { method: "POST", body: input });
        acceptState(data.state);
        return data.state;
      } finally { setSaving(false); }
    });
    queue.current = operation.catch(() => {});
    return operation;
  };

  const handleLogin = async (form) => {
    try {
      setError("");
      const payload = {
        phone: form?.phone || form?.login || form?.username || "",
        pass: form?.pass ?? form?.password ?? "",
      };

      const data = await request("/api/login", { method: "POST", body: payload, timeout: 45000 });
      localStorage.setItem("bbl-crm-token", data.token);
      setSession(data.user);
      stateRef.current = data.state || null;
      setState(stateRef.current);
      sendTelegramMessage(`✅ CRM tizimga kirdi: ${data.user.name} (${data.user.phone})`);
    } catch (err) {
      setError(err.message || "Login xatosi");
    }
  };

  const handleLogout = async () => {
    localStorage.removeItem("bbl-crm-token");
    setSession(null);
    sendTelegramMessage(`🚪 CRM tizimdan chiqildi: ${session?.name || "foydalanuvchi"}`);
  };

  const handleReset = async () => {
    if (!confirm("Barcha ma’lumotlar serverdan tozalab, yangi boshlang'ich holatga qaytariladi. Davom etilsinmi?")) return;
    const token = localStorage.getItem("bbl-crm-token");
    try {
      const data = await request("/api/reset", { method: "POST" });
      setState(data.state);
      setSession(null);
      localStorage.removeItem("bbl-crm-token");
    } catch (err) {
      setError(err.message || "Reset xatosi");
    }
  };

  if (loading) return <div className="login-wrap"><div className="hint">Server va ma'lumotlar yuklanmoqda...</div></div>;
  if (!session) {
    return (
      <>
        <Login users={state?.users || [{ role: "boss", phone: "beshbola.hr", year: "1122334411" }]} onLogin={handleLogin} />
        {error && <div className="firebase-error" role="alert">{error} {localStorage.getItem("bbl-crm-token") && <button className="btn" onClick={fetchState}>Qayta yuklash</button>}</div>}
        {state && (
          <div style={{ textAlign: "center", marginTop: -20 }}>
            <button className="btn btn-sm" onClick={handleReset} style={{ opacity: 0.7 }}>↻ Boshlang'ich ma'lumotlarni tiklash</button>
          </div>
        )}
      </>
    );
  }

  if (!state) return <div className="login-wrap"><div className="hint">Ma'lumotlar yuklanmoqda...</div></div>;
  const liveSession = state.users.find((user) => user.id === session.id) || session;
  const notifCount = state.notifications.filter((notification) => notification.forRole === liveSession.role && !notification.read).length;

  return (
    <>
      {error && <div className="firebase-error" role="alert">{error} {localStorage.getItem("bbl-crm-token") && <button className="btn" onClick={fetchState}>Qayta yuklash</button>}</div>}
      {saving && <div className="save-banner" role="status">Serverga saqlanmoqda...</div>}
      <Shell session={liveSession} notifCount={notifCount} onLogout={handleLogout}>
        {liveSession.role === "boss" && <BossDashboard state={state} persist={persist} saveSale={saveSale} session={liveSession} firebaseMode={false} />}
        {liveSession.role === "admin" && <AdminDashboard state={state} persist={persist} saveSale={saveSale} session={liveSession} />}
        {liveSession.role === "employee" && <EmployeeDashboard state={state} persist={persist} saveSale={saveSale} session={liveSession} />}
      </Shell>
    </>
  );
}

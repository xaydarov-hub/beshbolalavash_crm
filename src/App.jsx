import { request, requireCurrentApi } from "./lib/api.js";
import { stateChanges } from "./lib/changes.js";
import React, { useEffect, useState, useRef } from "react";
import { sendTelegramMessage } from "./lib/telegram.js";
import Login from "./components/Login.jsx";
import Shell from "./components/Shell.jsx";
import BossDashboard from "./components/boss/BossDashboard.jsx";
import AdminDashboard from "./components/admin/AdminDashboard.jsx";
import EmployeeDashboard from "./components/employee/EmployeeDashboard.jsx";
import PasswordSettings from './components/PasswordSettings.jsx';
import { dashboardPath } from './lib/roles.js';

export default function App() {
  const stateRef = useRef(null);
  const queue = useRef(Promise.resolve());
  const generation = useRef(0);
  const writes = useRef(0);
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState("");
  const [saving, setSaving] = useState(false);
  const [state, setState] = useState(null);
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [offline, setOffline] = useState(navigator.onLine === false);
  useEffect(() => {
    const update = () => setOffline(navigator.onLine === false);
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => { window.removeEventListener('online', update); window.removeEventListener('offline', update); };
  }, []);

  const clearSession = () => {
    generation.current += 1;
    localStorage.removeItem('bbl-crm-token');
    stateRef.current = null;
    setState(null);
    setSession(null);
    setPasswordOpen(false);
    setError('');
    setSyncError('');
    window.history.replaceState(null, '', '/login');
  };
  useEffect(() => {
    const expired = () => { clearSession(); setError('Sessiya tugadi. Qayta kiring.'); };
    window.addEventListener('crm:session-expired', expired);
    return () => window.removeEventListener('crm:session-expired', expired);
  }, []);

  const acceptState = (next) => {
    const previous = stateRef.current;
    if (previous && previous.databaseId === next.databaseId && Number.isInteger(next.revision) && next.revision < previous.revision) return;
    const shared = { ...next };
    for (const key of Object.keys(shared)) {
      if (previous?.[key] && typeof shared[key] === 'object' && JSON.stringify(previous[key]) === JSON.stringify(shared[key])) shared[key] = previous[key];
    }
    stateRef.current = shared;
    setState(shared);
  };
  const fetchState = async () => {
    if (writes.current) return;
    const epoch = generation.current;
    if (!stateRef.current) setLoading(true); setError(""); setSyncing(true);
    try {
      const data = await request("/api/state", { timeout: 45000 });
      if (epoch !== generation.current || writes.current) return;
      if (data?.state) acceptState(data.state);
      setSyncError("");
      if (data?.user) setSession(data.user);
    } catch (error) {
      if (epoch !== generation.current) return;
      setError(error.message);
    } finally { setLoading(false); setSyncing(false); }
  };
  useEffect(() => {
    if (localStorage.getItem("bbl-crm-token")) fetchState();
    else setLoading(false);
  }, []);

  useEffect(() => {
    if (!session || saving) return;
    let active = true, inFlight = false;
    const refresh = async () => {
      if (inFlight || writes.current || document.hidden || navigator.onLine === false) return;
      inFlight = true;
      try {
        const revision = stateRef.current?.revision || 0;
        const epoch = generation.current;
        const data = await request("/api/state", { headers: { "If-None-Match": `"${session.id}:${stateRef.current?.databaseId || ""}:${revision}"` } });
        if (active && epoch === generation.current && !writes.current) {
          if (data?.state) acceptState(data.state);
          if (data?.user) setSession(data.user);
          setSyncError("");
        }
      } catch (error) {
        if (active && error.status !== 401) setSyncError(error.message);
      } finally { inFlight = false; }
    };
    const timer = setInterval(refresh, 8000 + Math.floor(Math.random() * 2000));
    window.addEventListener("online", refresh);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => { active = false; clearInterval(timer); window.removeEventListener("online", refresh); window.removeEventListener("focus", refresh); document.removeEventListener("visibilitychange", refresh); };
  }, [session?.id, saving]);

  const persist = (updater) => {
    const epoch = generation.current;
    const operation = queue.current.then(async () => {
      if (epoch !== generation.current) return false;
      writes.current += 1;
      setSaving(true); setError("");
      try {
        const previous = stateRef.current;
        requireCurrentApi(previous);
        const next = typeof updater === "function" ? updater(previous) : updater;
        const changes = stateChanges(previous, next);
        if (!changes.length) return true;
        const data = await request("/api/state", { method: "PATCH", body: { changes } });
        if (epoch !== generation.current) return false;
        acceptState(data.state);
        return true;
      } catch (error) { if (epoch === generation.current) setError(error.message); return false; }
      finally { writes.current -= 1; setSaving(false); }
    });
    queue.current = operation.catch(() => {});
    return operation;
  };
  const saveSale = (input) => {
    const epoch = generation.current;
    const operation = queue.current.then(async () => {
      if (epoch !== generation.current) throw new Error("Sessiya yangilangan. Qayta urinib ko‘ring.");
      writes.current += 1; setSaving(true);
      try {
        requireCurrentApi(stateRef.current);
        const data = await request("/api/sales", { method: "POST", body: input });
        if (epoch !== generation.current) throw new Error("Sessiya yangilangan.");
        acceptState(data.state);
        return data.state;
      } finally { writes.current -= 1; setSaving(false); }
    });
    queue.current = operation.catch(() => {});
    return operation;
  };

  const handleLogin = async (form) => {
    const epoch = generation.current;
    try {
      setError("");
      const payload = {
        phone: form?.phone || form?.login || form?.username || "",
        pass: form?.pass ?? form?.password ?? "",
      };

      const data = await request("/api/login", { method: "POST", body: payload, timeout: 45000 });
      if (epoch !== generation.current) return;
      generation.current += 1;
      localStorage.setItem("bbl-crm-token", data.token);
      setSession(data.user);
      stateRef.current = data.state || null;
      setState(stateRef.current);
      setPasswordOpen(false);
      sendTelegramMessage(`✅ CRM tizimga kirdi: ${data.user.name} (${data.user.phone})`);
    } catch (err) {
      setError(err.message || "Login xatosi");
    }
  };

  const changePassword = input => {
    const epoch = generation.current;
    const operation = queue.current.then(async () => {
      if (epoch !== generation.current) return false;
      writes.current += 1; setSaving(true); setError('');
      try {
        const data = await request('/api/password', { method: 'POST', body: input });
        if (epoch !== generation.current) return false;
        localStorage.setItem('bbl-crm-token', data.token);
        acceptState(data.state);
        setSession(data.user);
        return true;
      } finally { writes.current -= 1; setSaving(false); }
    });
    queue.current = operation.catch(() => {});
    return operation;
  };

  const deleteUser = (employee) => {
    const epoch = generation.current;
    const operation = queue.current.then(async () => {
      if (epoch !== generation.current) return false;
      writes.current += 1; setSaving(true); setError('');
      try {
        const data = await request(`/api/users/${encodeURIComponent(employee.id)}`, { method: 'DELETE', body: { expectedUser: employee } });
        if (epoch !== generation.current) return false;
        acceptState(data.state);
        return true;
      } catch (error) { if (epoch === generation.current) setError(error.message); throw error; }
      finally { writes.current -= 1; setSaving(false); }
    });
    queue.current = operation.catch(() => {});
    return operation;
  };

  const handleLogout = async () => {
    clearSession();
    sendTelegramMessage(`🚪 CRM tizimdan chiqildi: ${session?.name || "foydalanuvchi"}`);
  };

  const liveSession = session && state?.users.find(user => user.id === session.id);
  const accountPath = liveSession && liveSession.active !== false && ['boss', 'admin', 'employee'].includes(liveSession.role) ? dashboardPath(liveSession) : null;
  useEffect(() => {
    if (!accountPath) return;
    // The server account determines the page. Editing the URL never changes access.
    const restore = () => {
      if (window.location.pathname !== accountPath) window.history.replaceState(null, '', accountPath);
    };
    restore();
    window.addEventListener('popstate', restore);
    return () => window.removeEventListener('popstate', restore);
  }, [accountPath]);

  if (loading) return <div className="login-wrap"><div className="hint">Server va ma'lumotlar yuklanmoqda...</div></div>;
  if (!session) {
    return (
      <>
        <Login onLogin={handleLogin} />
        {error && <div className="firebase-error" role="alert">{error} {localStorage.getItem("bbl-crm-token") && <button className="btn" onClick={fetchState}>Qayta yuklash</button>}</div>}
      </>
    );
  }

  if (!state) return <div className="login-wrap"><div className="hint">Ma'lumotlar yuklanmoqda...</div></div>;
  if (!accountPath) return <div className="login-wrap"><p role="alert">Hisob topilmadi yoki kirish roli noto‘g‘ri. Qayta kiring.</p><button className="btn" onClick={clearSession}>Kirish sahifasi</button></div>;
  const notifCount = (state.notifications || []).filter(notification => (notification.employeeId ? notification.employeeId === liveSession.id : notification.forRole === liveSession.role) && !notification.read).length;

  return (
    <>
      {(!Number.isInteger(state.revision) || !Array.isArray(state.dailySales)) && <div className="firebase-error" role="status">Server yangilanishi kutilmoqda. Ma’lumotlarni ko‘rishingiz mumkin; saqlash hozircha mavjud emas.</div>}
      {error && <div className="firebase-error" role="alert">{error} {localStorage.getItem("bbl-crm-token") && <button className="btn" onClick={fetchState}>Qayta yuklash</button>}</div>}
      {saving && <div className="save-banner" role="status">Serverga saqlanmoqda...</div>}
      {offline && <div className="firebase-error" role="status">Internet aloqasi uzilgan. Aloqa tiklanganda ma’lumotlar avtomatik yangilanadi. Saqlanmagan amallarni qayta yuboring.</div>}
      <button className="btn" disabled={offline || saving || syncing} onClick={fetchState}>Ma’lumotlarni yangilash</button>
      {syncError && <div className="hint" role="status">{syncError} Avtomatik qayta tekshiriladi.</div>}
      <Shell session={liveSession} notifCount={notifCount} onLogout={handleLogout} onPassword={() => setPasswordOpen(value => !value)}>
        {passwordOpen && <PasswordSettings key={liveSession.id} session={liveSession} onChangePassword={changePassword} onClose={() => setPasswordOpen(false)} />}
        {liveSession.firstLogin && !passwordOpen && <p className="hint">Boshlang‘ich paroldan foydalanyapsiz. <button className="btn btn-sm" onClick={() => setPasswordOpen(true)}>Shaxsiy parol o‘rnating</button></p>}
        {liveSession.role === "boss" && <BossDashboard key={accountPath + liveSession.id} state={state} persist={persist} saveSale={saveSale} deleteUser={deleteUser} session={liveSession} firebaseMode={false} />}
        {liveSession.role === "admin" && <AdminDashboard key={accountPath + liveSession.id + liveSession.branchId} state={state} persist={persist} saveSale={saveSale} session={liveSession} />}
        {liveSession.role === "employee" && <EmployeeDashboard key={accountPath + liveSession.id} state={state} persist={persist} saveSale={saveSale} session={liveSession} />}
      </Shell>
    </>
  );
}

import React, { useEffect, useState } from "react";
import { sendTelegramMessage } from "./lib/telegram.js";
import Login from "./components/Login.jsx";
import Shell from "./components/Shell.jsx";
import BossDashboard from "./components/boss/BossDashboard.jsx";
import AdminDashboard from "./components/admin/AdminDashboard.jsx";
import EmployeeDashboard from "./components/employee/EmployeeDashboard.jsx";

const API_URL = (import.meta.env.VITE_API_URL || (import.meta.env.PROD ? "" : "http://localhost:4000")).replace(/\/$/, "");
const apiUrl = (path) => `${API_URL}${path}`;

export default function App() {
  const [state, setState] = useState(null);
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchState = async (token) => {
    try {
      const response = await fetch(apiUrl("/api/state"), {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!response.ok) {
        throw new Error("State unavailable");
      }
      const data = await response.json();
      setState(data.state || data);
      if (data.user) setSession(data.user);
      setLoading(false);
    } catch {
      setError("Backend mavjud emas. Iltimos, serverni ishga tushiring: npm run server");
      setLoading(false);
    }
  };

  useEffect(() => {
    const token = localStorage.getItem("bbl-crm-token");
    if (token) {
      fetchState(token);
    } else {
      setLoading(false);
    }
  }, []);

  const persist = (updater) => {
    setState((previous) => {
      const next = typeof updater === "function" ? updater(previous) : updater;
      const token = localStorage.getItem("bbl-crm-token");
      if (token) {
        fetch(apiUrl("/api/state"), {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ state: next }),
        }).catch(() => {
          setError("Ma'lumotlar serverga saqlanmadi. Server ishlayotganini tekshiring.");
        });
      }
      return next;
    });
  };

  const handleLogin = async (form) => {
    try {
      setError("");
      const payload = {
        phone: form?.phone || form?.login || form?.username || "",
        pass: form?.pass ?? form?.password ?? "",
      };

      const response = await fetch(apiUrl("/api/login"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || "Login failed");
      }
      localStorage.setItem("bbl-crm-token", data.token);
      setSession(data.user);
      setState(data.state || null);
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
      const response = await fetch(apiUrl("/api/reset"), {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!response.ok) throw new Error("Reset failed");
      const data = await response.json();
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
        {error && <div className="firebase-error">{error}</div>}
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
      {error && <div className="firebase-error">{error}</div>}
      <Shell session={liveSession} notifCount={notifCount} onLogout={handleLogout}>
        {liveSession.role === "boss" && <BossDashboard state={state} persist={persist} session={liveSession} firebaseMode={false} />}
        {liveSession.role === "admin" && <AdminDashboard state={state} persist={persist} session={liveSession} />}
        {liveSession.role === "employee" && <EmployeeDashboard state={state} persist={persist} session={liveSession} />}
      </Shell>
    </>
  );
}

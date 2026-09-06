import React, { useState } from "react";
import Overview from "./Overview.jsx";
import Employees from "./Employees.jsx";
import Branches from "./Branches.jsx";
import Attendance from "./Attendance.jsx";
import Adjustments from "./Adjustments.jsx";
import Leaves from "./Leaves.jsx";
import Analytics from "./Analytics.jsx";
import AuditLog from "./AuditLog.jsx";
import Reports from "./Reports.jsx";
import EvaluationPanel from "../EvaluationPanel.jsx";
import EmployeeTransfer from "../EmployeeTransfer.jsx";

const TABS = [
  { id: "overview", label: "Bosh sahifa", icon: "🏠" },
  { id: "attendance", label: "Davomat", icon: "🕐" },
  { id: "employees", label: "Xodimlar", icon: "👥" },
  { id: "branches", label: "Filiallar", icon: "🏢" },
  { id: "adjustments", label: "Jarima / Bonus", icon: "💵" },
  { id: "evaluations", label: "Ball baholash", icon: "⭐" },
  { id: "transfer", label: "Ko'chirish", icon: "↔️" },
  { id: "leaves", label: "Ta'til so'rovlari", icon: "🏖" },
  { id: "analytics", label: "Analitika", icon: "📊" },
  { id: "reports", label: "Hisobotlar", icon: "📄" },
  { id: "audit", label: "Audit log", icon: "🛡" },
];

export default function BossDashboard({ state, persist, session, firebaseMode }) {
  const [tab, setTab] = useState("overview");
  const pendingLeaves = state.leaveRequests.filter((r) => r.status === "kutilmoqda").length;

  return (
    <div>
      <div className="tabs">
        {TABS.map((t) => (
          <button key={t.id} className={`tab-btn ${tab === t.id ? "active" : ""}`} onClick={() => setTab(t.id)}>
            {t.icon} {t.label}
            {t.id === "leaves" && pendingLeaves > 0 && (
              <span className="badge badge-yellow" style={{ marginLeft: 2 }}>{pendingLeaves}</span>
            )}
          </button>
        ))}
      </div>
      {tab === "overview" && <Overview state={state} />}
      {tab === "attendance" && <Attendance state={state} persist={persist} session={session} />}
      {tab === "employees" && <Employees state={state} persist={persist} session={session} firebaseMode={firebaseMode} />}
      {tab === "branches" && <Branches state={state} persist={persist} session={session} />}
      {tab === "adjustments" && <Adjustments state={state} persist={persist} session={session} />}
      {tab === "evaluations" && <EvaluationPanel state={state} persist={persist} session={session} />}
      {tab === "transfer" && <EmployeeTransfer state={state} persist={persist} session={session} />}
      {tab === "leaves" && <Leaves state={state} persist={persist} session={session} />}
      {tab === "analytics" && <Analytics state={state} />}
      {tab === "reports" && <Reports state={state} persist={persist} />}
      {tab === "audit" && <AuditLog state={state} />}
    </div>
  );
}

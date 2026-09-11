import React, { useState } from "react";
import SalesPanel from "../SalesPanel.jsx";
import EmployeeHistory from "../EmployeeHistory.jsx";
import EvaluationPanel from "../EvaluationPanel.jsx";
import EmployeeTransfer from "../EmployeeTransfer.jsx";
import { EmployeeForm } from "../boss/Employees.jsx";
import Attendance from "../boss/Attendance.jsx";
import Adjustments from "../boss/Adjustments.jsx";
import Leaves from "../boss/Leaves.jsx";
import Reports from "../boss/Reports.jsx";
import { jobLabel } from "../../lib/roles.js";

const TABS = [
  { id: "employees", label: "Xodimlar" },
  { id: "attendance", label: "Davomat" },
  { id: "sales", label: "Kunlik savdo" },
  { id: "evaluations", label: "Ball baholash" },
  { id: "adjustments", label: "Jarima / Bonus" },
  { id: "leaves", label: "Ta'til so'rovlari" },
  { id: "history", label: "Xodim tarixi" },
  { id: "transfer", label: "Xodim ko'chirish" },
  { id: "reports", label: "Filial hisoboti" },
];

export default function AdminDashboard({ state, persist, session, saveSale }) {
  const [historyId, setHistoryId] = useState("");
  const [tab, setTab] = useState("attendance");
  const [search, setSearch] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [adding, setAdding] = useState(false);
  const [notice, setNotice] = useState("");
  const branchEmployees = state.users.filter(u => u.role === "employee" && u.branchId === session.branchId);
  const employees = branchEmployees.filter(u => u.active !== false);
  const listedEmployees = branchEmployees.filter(u => (showArchived || u.active !== false) && `${u.name} ${u.phone} ${u.position}`.toLowerCase().includes(search.toLowerCase()));
  const selectedEmployee = branchEmployees.find(u => u.id === historyId);
  const branch = state.branches.find(b => b.id === session.branchId);
  const pendingLeaves = state.leaveRequests.filter(request => request.status === "kutilmoqda" && employees.some(employee => employee.id === request.employeeId)).length;
  const employeeScope = employee => employee.role === "employee" && employee.branchId === session.branchId;
  const finished = message => { setHistoryId(""); setAdding(false); setNotice(message); setTab("employees"); };

  return <div>
    <h2 className="section-title">Filial admini — {branch?.name || "Filial biriktirilmagan"}</h2>
    <p className="hint">{employees.length} ta faol xodim · {session.name}</p>
    {!branch ? <p role="alert">Boshliq profilingizga mavjud filial biriktirishi kerak. Filial tanlangach xodimlar va boshqaruv bo‘limlari ochiladi.</p> : <>
      <nav className="tabs" aria-label="Filial boshqaruvi">
        {TABS.map(item => <button key={item.id} type="button" aria-current={tab === item.id ? "page" : undefined} className={`tab-btn ${tab === item.id ? "active" : ""}`} onClick={() => { setTab(item.id); setNotice(""); }}>
          {item.label}{item.id === "leaves" && pendingLeaves > 0 ? ` (${pendingLeaves})` : ""}
        </button>)}
      </nav>
      {notice && <p role="status">{notice}</p>}
      {tab === "employees" && <section>
        <div className="section-gap"><button type="button" className="btn btn-primary" onClick={() => setAdding(value => !value)}>{adding ? "Formani yopish" : "Yangi xodim qo‘shish"}</button></div>
        {adding && <EmployeeForm state={state} persist={persist} session={session} onSaved={employee => finished(`${employee.name} filialga qo‘shildi.`)} />}
        <label className="field">Xodimni qidirish<input className="input" type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Ism, login yoki lavozim" /></label>
        <label><input type="checkbox" checked={showArchived} onChange={e => setShowArchived(e.target.checked)} /> Arxivdagi xodimlar</label>
        <p className="hint">Filial: {branch.name} · {listedEmployees.length} ta xodim topildi</p>
        <div className="grid grid-2">{listedEmployees.map(employee => <article key={employee.id} className="card card-pad">
          <h3>{employee.name}{employee.active === false ? " (arxiv)" : ""}</h3>
          <p>{jobLabel(employee)} · {employee.phone}</p>
          <p>Ish vaqti: {employee.workStart || "08:00"} – {employee.workEnd || "17:00"}</p>
          <button className="btn" onClick={() => { setHistoryId(employee.id); setTab("history"); }}>Profil va tarix</button>
        </article>)}</div>
        {!listedEmployees.length && <p className="empty">{search.trim() ? "Qidiruvga mos xodim topilmadi." : "Bu filialda tanlangan holatdagi xodim yo‘q. Yangi xodim qo‘shing yoki boshliqdan shu filialga biriktirishni so‘rang."}</p>}
      </section>}
      {tab === "history" && <section>
        <label className="field">Xodim<select className="input" value={selectedEmployee?.id || ""} onChange={e => setHistoryId(e.target.value)}><option value="">Xodimni tanlang</option>{branchEmployees.map(employee => <option key={employee.id} value={employee.id}>{employee.name}{employee.active === false ? " (arxiv)" : ""}</option>)}</select></label>
        {selectedEmployee && <>
          <EmployeeForm key={selectedEmployee.id} state={state} persist={persist} session={session} employee={selectedEmployee} onFinished={finished} />
          <EmployeeHistory state={state} employeeId={selectedEmployee.id} />
        </>}
        {!branchEmployees.length && <p className="empty">Bu filialga xodim biriktirilmagan.</p>}
      </section>}
      {tab === "attendance" && <Attendance state={state} persist={persist} session={session} />}
      {tab === "sales" && <SalesPanel state={state} session={session} saveSale={saveSale} />}
      {tab === "evaluations" && <EvaluationPanel state={state} persist={persist} session={session} employeeScope={employeeScope} />}
      {tab === "transfer" && <EmployeeTransfer state={state} persist={persist} session={session} employeeScope={employeeScope} />}
      {tab === "adjustments" && <Adjustments state={state} persist={persist} session={session} />}
      {tab === "leaves" && <Leaves state={state} persist={persist} session={session} />}
      {tab === "reports" && <Reports state={state} persist={persist} session={session} />}
    </>}
  </div>;
}

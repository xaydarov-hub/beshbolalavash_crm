import React, { useEffect, useMemo, useState } from "react";
import { todayISO, uid } from "../lib/utils.js";
import { logAction } from "../lib/db.js";

export default function EmployeeTransfer({ state, persist, session, employeeScope }) {
  const employees = useMemo(
    () => state.users.filter((user) => user.role === "employee" && (!employeeScope || employeeScope(user))),
    [state.users, employeeScope]
  );
  const [employeeId, setEmployeeId] = useState("");
  const [branchId, setBranchId] = useState("");
  const effectiveDate = todayISO();
  const [notice, setNotice] = useState("");

  useEffect(() => {
    if (!employees.some((employee) => employee.id === employeeId)) setEmployeeId(employees[0]?.id || "");
  }, [employees, employeeId]);

  const employee = employees.find((item) => item.id === employeeId);
  const availableBranches = state.branches.filter((branch) => branch.id !== employee?.branchId);

  useEffect(() => {
    if (!availableBranches.some((branch) => branch.id === branchId)) setBranchId(availableBranches[0]?.id || "");
  }, [employeeId, branchId, availableBranches]);

  const transfer = () => {
    if (!employee || !branchId) return;
    const from = state.branches.find((branch) => branch.id === employee.branchId);
    const to = state.branches.find((branch) => branch.id === branchId);
    persist((current) => {
      const transferRecord = { id: uid(), employeeId: employee.id, fromBranchId: employee.branchId, toBranchId: branchId, effectiveDate, by: session.name };
      return logAction(
        {
          ...current,
          users: current.users.map((user) => user.id === employee.id ? { ...user, branchId } : user),
          transfers: [...(current.transfers || []), transferRecord],
        },
        session.name,
        `${employee.name}ni ${from?.name || "noma'lum filial"}dan ${to?.name || "noma'lum filial"}ga ${effectiveDate}dan ko'chirdi.`
      );
    });
    setNotice(`${employee.name} ${to?.name} filialiga ko'chirildi.`);
  };

  if (!employees.length) return <div className="empty">Ko'chirish uchun xodim yo'q.</div>;

  return (
    <div className="card card-pad" style={{ maxWidth: 560 }}>
      <h3 className="section-title">Xodimni boshqa filialga ko'chirish</h3>
      <label className="field"><div className="label">Xodim</div>
        <select className="input" value={employeeId} onChange={(event) => { setEmployeeId(event.target.value); setNotice(""); }}>
          {employees.map((item) => <option key={item.id} value={item.id}>{item.name} — {state.branches.find((branch) => branch.id === item.branchId)?.name}</option>)}
        </select>
      </label>
      <label className="field"><div className="label">Yangi filial</div>
        <select className="input" value={branchId} onChange={(event) => setBranchId(event.target.value)}>
          {availableBranches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
        </select>
      </label>
      <button className="btn btn-primary" onClick={transfer} disabled={!branchId}>Ko'chirishni tasdiqlash</button>
      {notice && <div className="save-ok">{notice}</div>}
      <p className="hint">Ko'chirish darhol kuchga kiradi va bugungi sana bilan audit jurnalida saqlanadi. Admin faqat o'z filialidagi xodimlarni ko'chira oladi.</p>
    </div>
  );
}

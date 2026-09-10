import { useSaveAction } from "../../lib/useSaveAction.js";
import ResponsiveTable from "../ResponsiveTable.jsx";
import React, { useState } from "react";
import { uid } from "../../lib/utils.js";
import { logAction } from "../../lib/db.js";

export default function Branches({ state, persist, session }) {
  const action = useSaveAction();
  const [name, setName] = useState("");

  const addBranch = async () => {
    if (!name.trim()) return;
    const ok = await action.run(() => persist((s) => logAction(
      { ...s, branches: [...s.branches, { id: uid(), name: name.trim() }] },
      session.name, `Yangi filial qo'shdi: ${name.trim()}.`
    )));
    if (ok) setName("");
  };

  const removeBranch = (b) => {
    if (state.users.some((u) => u.branchId === b.id)) {
      alert("Bu filialda xodimlar bor — avval ularni boshqa filialga ko'chiring.");
      return;
    }
    persist((s) => logAction(
      { ...s, branches: s.branches.filter((x) => x.id !== b.id) },
      session.name, `Filialni o'chirdi: ${b.name}.`
    ));
  };

  return (
    <div style={{ maxWidth: 480 }}>
      <div className="branch-create" style={{ display: "flex", gap: 8, marginBottom: 18 }}>
        <input className="input" placeholder="Yangi filial nomi" value={name} onChange={(e) => setName(e.target.value)} />
        <button className="btn btn-primary" disabled={action.busy} onClick={addBranch}>➕</button>
      </div>
      {action.message && <p role="status">{action.message}</p>}
      <ResponsiveTable>
        {state.branches.map((b) => {
          const count = state.users.filter((u) => u.branchId === b.id && u.role === "employee").length;
          return (
            <div key={b.id} className="trow" style={{ gridTemplateColumns: "1fr auto auto" }}>
              <span>🏢 {b.name}</span>
              <span className="muted">{count} xodim</span>
              <button className="btn-icon" onClick={() => removeBranch(b)}>🗑</button>
            </div>
          );
        })}
      </ResponsiveTable>
    </div>
  );
}

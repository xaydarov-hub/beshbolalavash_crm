import ResponsiveTable from "../ResponsiveTable.jsx";
import React, { useState } from "react";
import { fmt, todayISO, monthKey, uid } from "../../lib/utils.js";
import { logAction } from "../../lib/db.js";
import { computeAllReports } from "../../lib/salary.js";

function csvCell(value) {
  let text = String(value ?? "");
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

function downloadReportPng({ month, reports, branches, total }) {
  const width = 1700;
  const rowHeight = 48;
  const height = Math.max(460, 245 + (reports.length + 2) * rowHeight);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  context.fillStyle = "#FFFDF9";
  context.fillRect(0, 0, width, height);
  context.fillStyle = "#2B1B14";
  context.font = "700 32px Segoe UI, Arial, sans-serif";
  context.fillText("Besh Bola Lavash — oylik va davomat hisoboti", 55, 62);
  context.fillStyle = "#8A7860";
  context.font = "18px Segoe UI, Arial, sans-serif";
  context.fillText(`Hisobot oyi: ${month}     Yaratilgan: ${todayISO()}`, 55, 96);

  const columns = [
    [55, 285, "Xodim"], [340, 200, "Filial"], [540, 150, "Lavozim"], [690, 72, "Kun"],
    [762, 80, "Soat"], [842, 135, "Savdo"], [977, 130, "Bonus"], [1107, 130, "Jarima"],
    [1237, 115, "Ball (o'rt.)"], [1352, 270, "Jami maosh"],
  ];
  let y = 135;
  context.fillStyle = "#FBF3E4";
  context.fillRect(40, y, width - 80, rowHeight);
  context.fillStyle = "#8A7860";
  context.font = "700 15px Segoe UI, Arial, sans-serif";
  columns.forEach(([x, , label]) => context.fillText(label, x, y + 30));
  y += rowHeight;
  context.font = "16px Segoe UI, Arial, sans-serif";
  reports.forEach((report, index) => {
    if (index % 2) { context.fillStyle = "#FBF3E4"; context.fillRect(40, y, width - 80, rowHeight); }
    const branch = branches.find((item) => item.id === report.emp.branchId)?.name || "—";
    const average = report.evaluation.count ? report.evaluation.average.toFixed(1) : "—";
    const cells = [report.emp.name, branch, report.emp.position, report.worked, Math.round(report.totalHours), fmt(report.sales), fmt(report.bonuses), fmt(report.fines), average, `${fmt(report.total)} so'm`];
    context.fillStyle = "#2B1B14";
    cells.forEach((value, cellIndex) => {
      const [x, maxWidth] = columns[cellIndex];
      let text = String(value);
      while (context.measureText(text).width > maxWidth - 8 && text.length > 1) text = `${text.slice(0, -2)}…`;
      context.fillText(text, x, y + 30);
    });
    context.fillStyle = "#E3D5BC";
    context.fillRect(40, y + rowHeight - 1, width - 80, 1);
    y += rowHeight;
  });
  context.fillStyle = "#FBF3E4";
  context.fillRect(40, y, width - 80, rowHeight + 10);
  context.fillStyle = "#2B1B14";
  context.font = "700 19px Segoe UI, Arial, sans-serif";
  context.fillText("JAMI MAOSH:", 1220, y + 32);
  context.fillText(`${fmt(total)} so'm`, 1405, y + 32);
  context.fillStyle = "#8A7860";
  context.font = "14px Segoe UI, Arial, sans-serif";
  context.fillText("Maosh = asosiy hisob + bonus − jarima. Ballar xizmat sifati ko'rsatkichi, maoshga avtomatik qo'shilmaydi.", 55, height - 28);
  canvas.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `bbl-hisobot-${month}.png`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }, "image/png");
}

export default function Reports({ state, persist }) {
  const [month, setMonth] = useState(monthKey(todayISO()));
  const [branchId, setBranchId] = useState("all");
  const reports = computeAllReports(state, month, branchId);

  const exportCSV = () => {
    const header = ["Xodim", "Filial", "Lavozim", "Ishlagan kun", "Soat", "Savdo", "Bonus", "Jarima", "Ball jami", "Ball o'rtacha", "Jami maosh"];
    const lines = reports.map((report) => [
      report.emp.name,
      state.branches.find((branch) => branch.id === report.emp.branchId)?.name || "",
      report.emp.position,
      report.worked,
      Math.round(report.totalHours),
      Math.round(report.sales),
      Math.round(report.bonuses),
      Math.round(report.fines),
      report.evaluation.total,
      report.evaluation.count ? report.evaluation.average.toFixed(1) : "",
      Math.round(report.total),
    ]);
    const csv = [header, ...lines].map((row) => row.map(csvCell).join(";")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `maosh-hisoboti-${month}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  };

  const grand = reports.reduce((sum, report) => sum + report.total, 0);
  const closePayroll = () => {
    if (!reports.length) return;
    const alreadyClosed = (state.payrollHistory || []).some((record) => record.month === month && record.branchId === branchId);
    if (alreadyClosed && !confirm(`${month} oylik hisoboti allaqachon saqlangan. Yangi versiya bilan almashtirilsinmi?`)) return;
    const snapshot = {
      id: uid(), month, branchId, createdAt: new Date().toISOString(), total: grand,
      employees: reports.map((report) => ({ employeeId: report.emp.id, name: report.emp.name, worked: report.worked, hours: report.totalHours, sales: report.sales, saleRecords: report.saleRecords, base: report.base, bonuses: report.bonuses, fines: report.fines, total: report.total })),
    };
    persist((current) => logAction(
      { ...current, payrollHistory: [...(current.payrollHistory || []).filter((record) => !(record.month === month && record.branchId === branchId)), snapshot] },
      "Boshliq", `${month} oylik hisoboti saqlandi. Jami: ${fmt(grand)} so'm.`
    ));
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 14, flexWrap: "wrap", gap: 10 }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input type="month" className="input" style={{ width: 155 }} value={month} onChange={(event) => setMonth(event.target.value)} />
          <select className="input" style={{ width: 220 }} value={branchId} onChange={(event) => setBranchId(event.target.value)}>
            <option value="all">Barcha filiallar</option>
            {state.branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
          </select>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button className="btn btn-green" onClick={exportCSV}>⬇ CSV yuklab olish</button>
          <button className="btn btn-primary" onClick={() => downloadReportPng({ month, reports, branches: state.branches, total: grand })}>🖼 PNG hisobot</button>
          <button className="btn btn-primary" onClick={closePayroll}>✅ Oylikni saqlash</button>
        </div>
      </div>

      <ResponsiveTable>
        <div className="trow thead" style={{ gridTemplateColumns: "1.15fr 0.85fr 0.45fr 0.5fr 0.8fr 0.65fr 0.65fr 0.65fr 0.8fr" }}>
          <div>Xodim</div><div>Filial</div><div>Kun</div><div>Soat</div><div>Savdo</div><div>Bonus</div><div>Jarima</div><div>Ball</div><div>Jami</div>
        </div>
        {reports.map((report) => (
          <div key={report.emp.id} className="trow" style={{ gridTemplateColumns: "1.15fr 0.85fr 0.45fr 0.5fr 0.8fr 0.65fr 0.65fr 0.65fr 0.8fr" }}>
            <div>{report.emp.name}</div>
            <div className="muted" style={{ fontSize: 12 }}>{state.branches.find((branch) => branch.id === report.emp.branchId)?.name}</div>
            <div>{report.worked}</div><div>{Math.round(report.totalHours)}</div>
            <div>{fmt(report.sales)}</div>
            <div style={{ color: "var(--herb)" }}>{report.bonuses ? "+" + fmt(report.bonuses) : "—"}</div>
            <div style={{ color: "var(--sauce)" }}>{report.fines ? "-" + fmt(report.fines) : "—"}</div>
            <div>{report.evaluation.count ? `${report.evaluation.average.toFixed(0)} avg.` : "—"}</div>
            <div style={{ fontWeight: 700 }}>{fmt(report.total)}</div>
          </div>
        ))}
        {reports.length > 0 && <div className="tfoot"><span className="muted">Jami maosh:</span><b>{fmt(grand)} so'm</b></div>}
        {!reports.length && <div className="empty">Tanlangan davr uchun xodim topilmadi.</div>}
      </ResponsiveTable>
      <h3 className="section-title" style={{ marginTop: 26 }}>Saqlangan oyliklar tarixi</h3>
      <ResponsiveTable>
        {(state.payrollHistory || []).length === 0 && <div className="empty">Hali saqlangan oylik yo'q.</div>}
        {[...(state.payrollHistory || [])].reverse().map((record) => (
          <div key={record.id} className="trow" style={{ gridTemplateColumns: "1fr 1fr 1fr 1fr" }}>
            <span><b>{record.month}</b></span>
            <span className="muted">{record.employees?.length || 0} xodim</span>
            <span className="muted">{record.createdAt?.slice(0, 10)}</span>
            <span style={{ color: "var(--sauce)", fontWeight: 700 }}>{fmt(record.total)} so'm</span>
          </div>
        ))}
      </ResponsiveTable>
      <div className="hint">Hisob: asosiy maosh + bonus − jarima. Savdoni «Kunlik savdo» bo‘limida kiriting; ball xizmat sifati ko'rsatkichi bo'lib, maoshga avtomatik qo'shilmaydi.</div>
    </div>
  );
}

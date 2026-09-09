import { describe, it, expect } from 'vitest';
import { applySale } from '../../server/sales.js';
import { computeEmployeeReport } from './salary.js';
import { migrateEvaluations, evaluationTotal, EVALUATION_CRITERIA } from './evaluation.js';
const emp = { id: 'e', name: 'Jabborov Abdulloh', role: 'employee', branchId: 'b', salaryType: 'foiz', rate: 7 };
const admin = { id: 'a', name: 'Admin', role: 'admin', branchId: 'b' };
const initial = () => ({ users: [emp], attendance: [], adjustments: [], evaluations: [], sales: {}, dailySales: [], auditLog: [] });
const sale = { employeeId: 'e', date: '2026-01-05', amount: 10000000 };
describe('Daily commission payroll', () => {
  it('credits 700,000 for 10,000,000 sales at 7 percent', () => {
    const state = applySale(initial(), admin, sale);
    const report = computeEmployeeReport(state, 'e', '2026-01');
    expect(report.base).toBe(700000); expect(report.total).toBe(700000); expect(report.sales).toBe(10000000);
  });
  it('replaces a daily total and keeps its revisions without double counting', () => {
    let state = applySale(initial(), admin, sale);
    state = applySale(state, admin, { ...sale, amount: 20000000, expectedUpdatedAt: state.dailySales[0].updatedAt });
    expect(state.dailySales).toHaveLength(1); expect(state.dailySales[0].revisions[0].amount).toBe(10000000);
    expect(computeEmployeeReport(state, 'e', '2026-01').base).toBe(1400000);
  });
  it('retains historical rate when employee rate changes and includes legacy sales', () => {
    const state = applySale(initial(), admin, sale);
    state.users = [{ ...emp, rate: 10 }]; state.sales['e:2026-01'] = 1000;
    expect(computeEmployeeReport(state, 'e', '2026-01').base).toBe(700100);
    expect(computeEmployeeReport(state, 'e', '2026-02').base).toBe(0);
  });
  it('rejects foreign branch, employee writes, stale edits and invalid amounts/dates', () => {
    expect(() => applySale(initial(), { ...admin, branchId: 'other' }, sale)).toThrow();
    expect(() => applySale(initial(), emp, sale)).toThrow();
    for (const amount of [-1, NaN, Infinity, '100', 0.5, 1e13]) expect(() => applySale(initial(), admin, { ...sale, amount })).toThrow();
    for (const date of ['', '2026-02-30', '2099-01-01']) expect(() => applySale(initial(), admin, { ...sale, date })).toThrow();
    expect(() => applySale(applySale(initial(), admin, sale), admin, sale)).toThrow(/boshqa qurilmada/);
  });
  it('combines commission, bonuses and fines exactly once', () => {
    const state = applySale(initial(), admin, sale);
    state.adjustments = [{ employeeId: 'e', date: sale.date, type: 'bonus', amount: 50000 }, { employeeId: 'e', date: sale.date, type: 'jarima', amount: 10000 }];
    expect(computeEmployeeReport(state, 'e', '2026-01').total).toBe(740000);
  });
});
describe('Five-point evaluation', () => {
  it('uses five points for all criteria and the overall average', () => {
    expect(EVALUATION_CRITERIA.every(c => c.max === 5)).toBe(true);
    expect(evaluationTotal(Object.fromEntries(EVALUATION_CRITERIA.map(c => [c.id, 5])))).toBe(5);
  });
  it('migrates old weighted scores proportionally exactly once', () => {
    const maximums = [15,15,15,10,10,5,8,5,5,5,2,5];
    const records = migrateEvaluations([{ scores: Object.fromEntries(EVALUATION_CRITERIA.map((c,i) => [c.id, maximums[i]])) }]);
    expect(records[0].total).toBe(5); expect(records[0].legacyScores.greeting).toBe(15);
    expect(migrateEvaluations(records)).toEqual(records);
  });
});

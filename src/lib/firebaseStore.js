import {
  collection, deleteDoc, doc, documentId, getDoc, onSnapshot, query, setDoc, where, writeBatch,
} from "firebase/firestore";
import { firestore, ORGANIZATION_ID } from "./firebase.js";

const LISTS = ["branches", "users", "attendance", "adjustments", "leaveRequests", "auditLog", "notifications", "evaluations", "transfers"];
const EMPTY_STATE = { branches: [], users: [], attendance: [], adjustments: [], sales: {}, leaveRequests: [], auditLog: [], notifications: [], evaluations: [], transfers: [] };

function pathFor(name) {
  return collection(firestore, "organizations", ORGANIZATION_ID, name);
}

function employeeBranch(state, employeeId) {
  return state.users.find((user) => user.id === employeeId)?.branchId || null;
}

function scopedQuery(name, profile) {
  const ref = pathFor(name);
  if (profile.role === "boss" || name === "branches") return query(ref);
  if (profile.role === "employee") {
    if (name === "users") return query(ref, where(documentId(), "==", profile.id));
    if (["attendance", "adjustments", "leaveRequests", "evaluations", "sales"].includes(name)) return query(ref, where("employeeId", "==", profile.id));
    if (name === "notifications") return query(ref, where("forRole", "==", "employee"));
    return query(ref, where("employeeId", "==", "__no_access__"));
  }
  if (name === "users") return query(ref, where("branchId", "==", profile.branchId));
  if (["attendance", "adjustments", "leaveRequests", "evaluations", "sales"].includes(name)) return query(ref, where("branchId", "==", profile.branchId));
  if (name === "notifications") return query(ref, where("forRole", "==", "admin"));
  if (name === "auditLog") return query(ref, where("actorId", "==", profile.id));
  return query(ref, where("fromBranchId", "==", profile.branchId));
}

export function emptyFirebaseState() {
  return { ...EMPTY_STATE, branches: [], users: [], attendance: [], adjustments: [], sales: {}, leaveRequests: [], auditLog: [], notifications: [], evaluations: [], transfers: [] };
}

export async function getProfile(uid) {
  const snapshot = await getDoc(doc(firestore, "organizations", ORGANIZATION_ID, "users", uid));
  return snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null;
}

export async function createFirstBoss({ uid, name, email }) {
  const batch = writeBatch(firestore);
  const profile = { id: uid, role: "boss", name, email, phone: "", branchId: null, position: "Direktor", salaryType: "oylik", rate: 0, hireDate: new Date().toISOString().slice(0, 10), firstLogin: false, createdAt: new Date().toISOString() };
  batch.set(doc(firestore, "organizations", ORGANIZATION_ID, "users", uid), profile);
  batch.set(doc(firestore, "organizations", ORGANIZATION_ID, "meta", "company"), { name: "Besh Bola Lavash", initializedAt: new Date().toISOString(), initializedBy: uid });
  await batch.commit();
  return profile;
}

export function subscribeOrganization(profile, onState, onError) {
  const current = emptyFirebaseState();
  const emit = () => onState({ ...current, sales: { ...current.sales } });
  const unsubscribe = [...LISTS, "sales"].map((name) => onSnapshot(scopedQuery(name, profile), (snapshot) => {
    if (name === "sales") {
      current.sales = Object.fromEntries(snapshot.docs.map((item) => [item.id, item.data().amount || 0]));
    } else {
      current[name] = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
      if (name === "users" && !current.users.some((user) => user.id === profile.id)) current.users.push(profile);
    }
    emit();
  }, onError));
  return () => unsubscribe.forEach((stop) => stop());
}

function dataForWrite(name, record, nextState, profile) {
  if (name === "users" || name === "branches") return record;
  const employeeId = record.employeeId;
  const branchId = record.branchId || employeeBranch(nextState, employeeId) || profile.branchId || null;
  if (name === "auditLog") return { ...record, actorId: record.actorId || profile.id, branchId };
  if (name === "transfers") return { ...record, branchId: record.branchId || record.fromBranchId || profile.branchId || null };
  return { ...record, branchId };
}

export async function syncOrganizationState(previous, next, profile) {
  const batch = writeBatch(firestore);
  let operationCount = 0;
  for (const name of LISTS) {
    const before = new Map((previous[name] || []).map((record) => [record.id, record]));
    const after = new Map((next[name] || []).map((record) => [record.id, record]));
    for (const [id, record] of after) {
      if (JSON.stringify(before.get(id)) !== JSON.stringify(record)) {
        batch.set(doc(pathFor(name), id), dataForWrite(name, record, next, profile));
        operationCount += 1;
      }
    }
    for (const id of before.keys()) {
      if (!after.has(id)) { batch.delete(doc(pathFor(name), id)); operationCount += 1; }
    }
  }
  const beforeSales = previous.sales || {};
  const afterSales = next.sales || {};
  for (const [id, amount] of Object.entries(afterSales)) {
    if (beforeSales[id] !== amount) {
      const [employeeId, month] = id.split(":");
      batch.set(doc(pathFor("sales"), id), { id, employeeId, month, amount, branchId: employeeBranch(next, employeeId) || profile.branchId || null });
      operationCount += 1;
    }
  }
  for (const id of Object.keys(beforeSales)) {
    if (!(id in afterSales)) { batch.delete(doc(pathFor("sales"), id)); operationCount += 1; }
  }
  if (operationCount) await batch.commit();
}

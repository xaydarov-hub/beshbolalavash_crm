import { uid } from "./utils.js";

export function logAction(state, actor, action) {
  const entry = { id: uid(), at: new Date().toLocaleString("uz-UZ"), actor, action };
  return { ...state, auditLog: [entry, ...state.auditLog] };
}

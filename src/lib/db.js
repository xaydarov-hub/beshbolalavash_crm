import { uid } from "./utils.js";

export function logAction(state, actor, action) {
  // The server overwrites `at` with its own timestamp for any genuinely new entry; this is a
  // throwaway placeholder before that round trip, kept in ISO form so nothing renders it raw.
  const entry = { id: uid(), at: new Date().toISOString(), actor, action };
  return { ...state, auditLog: [entry, ...state.auditLog] };
}

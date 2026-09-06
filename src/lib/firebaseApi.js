import { httpsCallable } from "firebase/functions";
import { functions } from "./firebase.js";

export async function createFirebaseEmployee(payload) {
  if (!functions) throw new Error("Firebase Functions sozlanmagan.");
  const createEmployee = httpsCallable(functions, "createEmployee");
  const result = await createEmployee(payload);
  return result.data.profile;
}

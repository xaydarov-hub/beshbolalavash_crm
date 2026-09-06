import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";

initializeApp();
const db = getFirestore();
const ORG = "organizations/main";

async function callerProfile(uid) {
  const snapshot = await db.doc(`${ORG}/users/${uid}`).get();
  if (!snapshot.exists) throw new HttpsError("permission-denied", "CRM profilingiz topilmadi.");
  return snapshot.data();
}

function requiredText(value, name, min = 1) {
  if (typeof value !== "string" || value.trim().length < min) throw new HttpsError("invalid-argument", `${name} noto'g'ri.`);
  return value.trim();
}

export const createEmployee = onCall({ region: "us-central1" }, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Kirish talab qilinadi.");
  const caller = await callerProfile(request.auth.uid);
  if (caller.role !== "boss") throw new HttpsError("permission-denied", "Xodim yaratish faqat boshliq uchun.");

  const data = request.data || {};
  const name = requiredText(data.name, "Ism-familiya", 3);
  const email = requiredText(data.email, "Email", 5).toLowerCase();
  const password = requiredText(data.temporaryPassword, "Vaqtinchalik parol", 8);
  const phone = requiredText(data.phone, "Telefon", 9).replace(/\D/g, "");
  const branchId = requiredText(data.branchId, "Filial");
  const role = data.role === "admin" ? "admin" : "employee";
  const rate = Number(data.rate);
  if (!Number.isFinite(rate) || rate < 0) throw new HttpsError("invalid-argument", "Maosh stavkasi noto'g'ri.");

  const duplicate = await db.collection(`${ORG}/users`).where("phone", "==", phone).limit(1).get();
  if (!duplicate.empty) throw new HttpsError("already-exists", "Bu telefon raqami bilan xodim mavjud.");

  const account = await getAuth().createUser({ email, password, displayName: name, disabled: false });
  const profile = {
    id: account.uid, name, email, phone, role, branchId,
    position: role === "admin" ? "Filial admini" : requiredText(data.position, "Lavozim"),
    salaryType: role === "admin" ? "oylik" : requiredText(data.salaryType, "Maosh turi"),
    rate, hireDate: data.hireDate || new Date().toISOString().slice(0, 10),
    firstLogin: false, mustChangePassword: true, createdAt: FieldValue.serverTimestamp(),
  };
  const batch = db.batch();
  batch.set(db.doc(`${ORG}/users/${account.uid}`), profile);
  batch.set(db.collection(`${ORG}/auditLog`).doc(), {
    at: new Date().toISOString(), actor: caller.name, actorId: request.auth.uid,
    action: `Yangi ${role === "admin" ? "admin" : "xodim"} qo'shdi: ${name}.`, branchId,
  });
  await batch.commit();
  return { profile: { ...profile, createdAt: new Date().toISOString() } };
});

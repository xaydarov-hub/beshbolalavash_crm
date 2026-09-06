import { initializeApp, getApps } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getFunctions } from "firebase/functions";
import { getStorage } from "firebase/storage";

const hasRealFirebaseValue = (value) => typeof value === "string" && value.trim().length > 0 && !value.includes("your-") && !value.includes("example") && !value.includes("CHANGE") && !value.includes("YOUR_");

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

const firebaseEnabled = import.meta.env.VITE_ENABLE_FIREBASE === "true" &&
  hasRealFirebaseValue(firebaseConfig.apiKey) &&
  hasRealFirebaseValue(firebaseConfig.projectId) &&
  hasRealFirebaseValue(firebaseConfig.appId) &&
  hasRealFirebaseValue(firebaseConfig.authDomain);

export const isFirebaseConfigured = firebaseEnabled;
export const firebaseApp = isFirebaseConfigured ? (getApps()[0] || initializeApp(firebaseConfig)) : null;
export const auth = firebaseApp ? getAuth(firebaseApp) : null;
export const firestore = firebaseApp ? getFirestore(firebaseApp) : null;
export const functions = firebaseApp ? getFunctions(firebaseApp) : null;
export const storage = firebaseApp ? getStorage(firebaseApp) : null;

export const ORGANIZATION_ID = "main";

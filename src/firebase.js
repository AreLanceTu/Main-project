import { initializeApp, getApps } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getDatabase } from "firebase/database";
import { getStorage } from "firebase/storage";

// Firebase is initialized once and shared across the app.
// Vite exposes env vars via import.meta.env.* (must be prefixed with VITE_).
export const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

const REQUIRED_ENV_VARS = [
  "VITE_FIREBASE_API_KEY",
  "VITE_FIREBASE_AUTH_DOMAIN",
  "VITE_FIREBASE_PROJECT_ID",
  "VITE_FIREBASE_STORAGE_BUCKET",
  "VITE_FIREBASE_MESSAGING_SENDER_ID",
  "VITE_FIREBASE_APP_ID",
];

export const missingFirebaseEnvVars = REQUIRED_ENV_VARS.filter((k) => !import.meta.env[k]);
export const isFirebaseConfigured = missingFirebaseEnvVars.length === 0;

export let firebaseInitError = null;

export let firebaseApp = null;
export let auth = null;
export let db = null;
export let storage = null;
export let rtdb = null;

if (!isFirebaseConfigured) {
  firebaseInitError = new Error(
    `Missing Firebase env vars: ${missingFirebaseEnvVars.join(", ")}. Copy .env.example to .env.local and restart the dev server.`,
  );
} else {
  try {
    firebaseApp = getApps().length > 0 ? getApps()[0] : initializeApp(firebaseConfig);
    auth = getAuth(firebaseApp);
    db = getFirestore(firebaseApp);
    storage = getStorage(firebaseApp);
    // Optional: used for presence (online/offline) via onDisconnect.
    rtdb = getDatabase(firebaseApp);
  } catch (e) {
    firebaseInitError = e;
  }
}

let _analytics = null;

// Firebase Analytics only works in the browser and only if a measurementId is set.
// Use this helper instead of importing firebase/analytics at module top-level.
export async function getFirebaseAnalytics() {
  if (_analytics) return _analytics;
  if (!firebaseConfig.measurementId) return null;
  if (typeof window === "undefined") return null;

  if (firebaseInitError || !firebaseApp) return null;

  const { isSupported, getAnalytics } = await import("firebase/analytics");
  if (!(await isSupported())) return null;

  _analytics = getAnalytics(firebaseApp);
  return _analytics;
}

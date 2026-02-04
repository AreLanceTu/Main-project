import { initializeApp, getApps } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getDatabase } from "firebase/database";

// Firebase is initialized once and shared across the app.
// Vite exposes env vars via import.meta.env.* (must be prefixed with VITE_).
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

export const firebaseApp =
  getApps().length > 0 ? getApps()[0] : initializeApp(firebaseConfig);

export const auth = getAuth(firebaseApp);

export const db = getFirestore(firebaseApp);

// Optional: used for presence (online/offline) via onDisconnect.
export const rtdb = getDatabase(firebaseApp);

let _analytics = null;

// Firebase Analytics only works in the browser and only if a measurementId is set.
// Use this helper instead of importing firebase/analytics at module top-level.
export async function getFirebaseAnalytics() {
  if (_analytics) return _analytics;
  if (!firebaseConfig.measurementId) return null;
  if (typeof window === "undefined") return null;

  const { isSupported, getAnalytics } = await import("firebase/analytics");
  if (!(await isSupported())) return null;

  _analytics = getAnalytics(firebaseApp);
  return _analytics;
}

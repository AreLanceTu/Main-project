import { onAuthStateChanged } from "firebase/auth";
import {
  onDisconnect,
  onValue,
  ref,
  serverTimestamp as rtdbServerTimestamp,
  set,
  type DatabaseReference,
} from "firebase/database";

import { auth, rtdb } from "@/firebase";

export type PresenceState = {
  state: "online" | "offline";
  last_changed: object | number;
};

/**
 * Starts RTDB presence handling for the current user.
 *
 * Writes:
 * - /status/{uid} = { state, last_changed }
 *
 * Uses RTDB's .info/connected + onDisconnect() so "offline" is set reliably
 * even on hard disconnects.
 */
export function startRtdbPresence(): () => void {
  let stopConnectedListener: null | (() => void) = null;
  let currentStatusRef: DatabaseReference | null = null;

  const unsubAuth = onAuthStateChanged(auth, (u) => {
    // cleanup previous
    if (stopConnectedListener) {
      stopConnectedListener();
      stopConnectedListener = null;
    }
    currentStatusRef = null;

    if (!u?.uid) return;

    const uid = u.uid;
    const statusRef = ref(rtdb, `/status/${uid}`);
    currentStatusRef = statusRef;

    const connectedRef = ref(rtdb, ".info/connected");

    const unsubConnected = onValue(connectedRef, (snap) => {
      const connected = Boolean(snap.val());
      if (!connected) return;

      // When we lose connection, mark offline.
      void onDisconnect(statusRef).set({
        state: "offline",
        last_changed: rtdbServerTimestamp(),
      });

      // Mark ourselves online.
      void set(statusRef, {
        state: "online",
        last_changed: rtdbServerTimestamp(),
      });
    });

    stopConnectedListener = () => unsubConnected();
  });

  return () => {
    try {
      unsubAuth();
    } catch {
      // ignore
    }

    if (stopConnectedListener) {
      stopConnectedListener();
      stopConnectedListener = null;
    }

    // Best-effort: mark offline on unmount.
    const uid = auth.currentUser?.uid;
    if (uid) {
      const statusRef = ref(rtdb, `/status/${uid}`);
      void set(statusRef, {
        state: "offline",
        last_changed: rtdbServerTimestamp(),
      }).catch(() => undefined);
    }

    currentStatusRef = null;
  };
}

export function subscribePresence(uid: string, cb: (p: PresenceState | null) => void): () => void {
  const statusRef = ref(rtdb, `/status/${uid}`);
  return onValue(
    statusRef,
    (snap) => {
      const v = snap.val();
      if (!v || typeof v !== "object") {
        cb(null);
        return;
      }
      const state = v.state === "online" ? "online" : v.state === "offline" ? "offline" : null;
      if (!state) {
        cb(null);
        return;
      }
      cb({ state, last_changed: v.last_changed ?? null });
    },
    () => {
      cb(null);
    },
  );
}

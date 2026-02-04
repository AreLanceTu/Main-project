import { useEffect } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";

import { auth, db } from "@/firebase";
import { startRtdbPresence } from "@/lib/presence";

const HEARTBEAT_MS = 30_000;

async function setMyPresence(uid: string, online: boolean) {
  await setDoc(
    doc(db, "users", uid),
    {
      online,
      lastSeen: serverTimestamp(),
      lastSeenClientMs: Date.now(),
    },
    { merge: true },
  );
}

/**
 * Keeps `/users/{uid}` updated with basic presence fields:
 * - online: boolean
 * - lastSeen: serverTimestamp()
 * - lastSeenClientMs: number (best-effort)
 *
 * This is a Firestore heartbeat approach (not perfect like RTDB onDisconnect),
 * but it provides practical real-time online/offline visibility across the app.
 */
export default function PresenceUpdater() {
  useEffect(() => {
    const stopRtdbPresence = startRtdbPresence();

    let uid: string | null = auth.currentUser?.uid ?? null;
    let interval: number | null = null;
    let disposed = false;

    const startHeartbeat = (nextUid: string) => {
      uid = nextUid;

      const tick = async () => {
        if (disposed || !uid) return;
        try {
          await setMyPresence(uid, true);
        } catch (e) {
          // Presence is best-effort; avoid spamming console.
          // eslint-disable-next-line no-console
          console.debug("Presence heartbeat failed", e);
        }
      };

      void tick();
      interval = window.setInterval(() => {
        void tick();
      }, HEARTBEAT_MS);

      const onVis = () => {
        if (!uid) return;
        const hidden = typeof document !== "undefined" && document.visibilityState === "hidden";
        void setMyPresence(uid, !hidden).catch(() => undefined);
      };

      document.addEventListener("visibilitychange", onVis);

      const onBeforeUnload = () => {
        if (!uid) return;
        // Best-effort. beforeunload may not complete network requests in all browsers.
        void setMyPresence(uid, false).catch(() => undefined);
      };

      window.addEventListener("beforeunload", onBeforeUnload);

      return () => {
        document.removeEventListener("visibilitychange", onVis);
        window.removeEventListener("beforeunload", onBeforeUnload);
      };
    };

    let stopDomListeners: null | (() => void) = null;

    const unsub = onAuthStateChanged(auth, (u) => {
      const nextUid = u?.uid ?? null;

      // Cleanup previous user heartbeat.
      if (interval) {
        window.clearInterval(interval);
        interval = null;
      }
      if (stopDomListeners) {
        stopDomListeners();
        stopDomListeners = null;
      }

      // Mark previous uid offline.
      if (uid && uid !== nextUid) {
        void setMyPresence(uid, false).catch(() => undefined);
      }

      uid = nextUid;

      if (!uid) return;
      stopDomListeners = startHeartbeat(uid);
    });

    return () => {
      try {
        stopRtdbPresence();
      } catch {
        // ignore
      }

      disposed = true;
      try {
        unsub();
      } catch {
        // ignore
      }
      if (interval) {
        window.clearInterval(interval);
        interval = null;
      }
      if (stopDomListeners) {
        stopDomListeners();
        stopDomListeners = null;
      }
      if (uid) {
        void setMyPresence(uid, false).catch(() => undefined);
      }
    };
  }, []);

  return null;
}

import { useEffect, useRef, useState } from "react";
import { Navigate } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";

import { auth } from "@/firebase";
import { db } from "@/firebase";
import { setUserRole } from "@/auth/role";
import { isFreelancerDocRegistered } from "@/lib/freelancerAccess";

/**
 * RoleGuard
 * Restricts access to a route by role stored in localStorage.
 * Intended to be used inside <AuthGuard> (user already authed + email verified).
 */
export default function RoleGuard({ role, redirectTo = "/dashboard", children }) {
  const [allowed, setAllowed] = useState(null);
  const activeUidRef = useRef(null);

  useEffect(() => {
    let unsubRole = null;
    let cancelled = false;

    const unsubAuth = onAuthStateChanged(auth, (u) => {
      // Avoid any flash of previously-allowed content when the auth user changes.
      setAllowed(null);
      activeUidRef.current = u?.uid ?? null;

      // Reset any prior subscription.
      if (unsubRole) {
        unsubRole();
        unsubRole = null;
      }

      if (!u) {
        setAllowed(false);
        return;
      }

      // Source of truth: Firestore.
      // Freelancer access = existence of /freelancers/{uid}.
      if (role === "freelancer") {
        const uid = u.uid;
        unsubRole = onSnapshot(
          doc(db, "freelancers", uid),
          (snap) => {
            // Guard against any stale snapshot callbacks.
            if (cancelled || activeUidRef.current !== uid) return;
            const ok = snap.exists() && isFreelancerDocRegistered(snap.data(), uid);
            setAllowed(ok);
            // Keep local routing state in sync for components that still read localStorage.
            setUserRole(uid, ok ? "freelancer" : "client");
          },
          () => {
            if (cancelled || activeUidRef.current !== uid) return;
            setAllowed(false);
            setUserRole(uid, "client");
          },
        );
        return;
      }

      // For now, any signed-in user can be treated as a client.
      setAllowed(true);
      setUserRole(u.uid, "client");
    });

    return () => {
      cancelled = true;
      if (unsubRole) unsubRole();
      unsubAuth();
    };
  }, [role]);

  if (allowed === null) return null;
  if (!allowed) return <Navigate to={redirectTo} replace />;
  return children;
}

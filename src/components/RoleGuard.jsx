import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";

import { auth } from "@/firebase";
import { getUserRole } from "@/auth/role";

/**
 * RoleGuard
 * Restricts access to a route by role stored in localStorage.
 * Intended to be used inside <AuthGuard> (user already authed + email verified).
 */
export default function RoleGuard({ role, redirectTo = "/dashboard", children }) {
  const [allowed, setAllowed] = useState(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      if (!u) {
        setAllowed(false);
        return;
      }

      const currentRole = getUserRole(u.uid);
      setAllowed(currentRole === role);
    });

    return unsub;
  }, [role]);

  if (allowed === null) return null;
  if (!allowed) return <Navigate to={redirectTo} replace />;
  return children;
}

import { useEffect, useMemo, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "../firebase";

/**
 * AuthGuard
 * - Not logged in  -> /login
 * - Logged in but email not verified -> /verify-email
 *
 * Wrap protected routes with <AuthGuard>...</AuthGuard>
 */
export default function AuthGuard({ children }) {
  const location = useLocation();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser);
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const from = useMemo(() => {
    // Keep it simple: preserve full path so we can send the user back after login.
    return `${location.pathname}${location.search}${location.hash}`;
  }, [location.pathname, location.search, location.hash]);

  if (loading) {
    // Avoid flicker/redirect loops while Firebase resolves auth state.
    return null;
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from }} />;
  }

  if (!user.emailVerified) {
    return <Navigate to="/verify-email" replace />;
  }

  return children;
}

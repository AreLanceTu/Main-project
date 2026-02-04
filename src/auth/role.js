// Minimal role persistence for routing decisions.
// This keeps the solution Firebase-Auth-only (no database required).

const ROLE_KEY_PREFIX = "userRole:";
const PENDING_ROLE_KEY = "pendingRole";

export function setUserRole(uid, role) {
  if (!uid || !role) return;
  localStorage.setItem(`${ROLE_KEY_PREFIX}${uid}`, role);
}

export function getUserRole(uid) {
  if (!uid) return null;
  return localStorage.getItem(`${ROLE_KEY_PREFIX}${uid}`);
}

export function consumePendingRole() {
  const role = localStorage.getItem(PENDING_ROLE_KEY);
  if (role) localStorage.removeItem(PENDING_ROLE_KEY);
  return role;
}

export function setPendingRole(role) {
  if (!role) return;
  localStorage.setItem(PENDING_ROLE_KEY, role);
}

export function roleDefaultDashboardPath(role) {
  // Default to client dashboard if role isn't known.
  return role === "freelancer" ? "/freelancer-dashboard" : "/dashboard";
}

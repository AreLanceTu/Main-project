import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  serverTimestamp,
  setDoc,
  where,
} from "firebase/firestore";

/**
 * Username rules:
 * - stored as `username` (original-ish) and `usernameLower` (for search/uniqueness)
 * - allowed: a-z, 0-9, underscore, dot
 * - 3..20 chars
 */
export function normalizeUsername(value) {
  let s = String(value || "").trim();
  if (s.startsWith("@")) s = s.slice(1);
  s = s.toLowerCase();
  // Replace whitespace with underscores then remove invalid characters.
  s = s.replace(/\s+/g, "_").replace(/[^a-z0-9_.]/g, "");
  // Collapse consecutive dots/underscores a bit.
  s = s.replace(/\.{2,}/g, ".").replace(/_{2,}/g, "_");
  return s;
}

export function isValidUsername(value) {
  const s = normalizeUsername(value);
  if (s.length < 3 || s.length > 20) return false;
  // Must start with letter/number.
  if (!/^[a-z0-9]/.test(s)) return false;
  // Disallow ending with dot/underscore.
  if (/[._]$/.test(s)) return false;
  return true;
}

function normalizeNameLower(value) {
  return String(value || "").trim().toLowerCase();
}

function baseFromEmail(email) {
  const e = String(email || "");
  const local = e.includes("@") ? e.split("@")[0] : e;
  return local || "user";
}

function generateUsernameBase({ email, displayName }) {
  const base = displayName ? String(displayName) : baseFromEmail(email);
  const normalized = normalizeUsername(base);
  return normalized.length >= 3 ? normalized : normalizeUsername(`${normalized}${baseFromEmail(email)}`);
}

async function usernameExists(db, usernameLower) {
  const q = query(
    collection(db, "users"),
    where("usernameLower", "==", usernameLower),
    limit(1),
  );
  const snap = await getDocs(q);
  return !snap.empty;
}

/**
 * Picks a unique usernameLower by trying the preferred value first, then adding a suffix.
 */
export async function pickUniqueUsernameLower(db, preferred, uidHint) {
  const base = normalizeUsername(preferred);
  if (!isValidUsername(base)) {
    throw new Error("Invalid username");
  }

  if (!(await usernameExists(db, base))) return base;

  const suffixBase = String(uidHint || "").slice(0, 4).toLowerCase();
  const candidates = [
    `${base}${suffixBase}`,
    `${base}_${suffixBase}`,
    `${base}${Math.floor(Math.random() * 9000 + 1000)}`,
    `${base}_${Math.floor(Math.random() * 9000 + 1000)}`,
  ].map((c) => normalizeUsername(c).slice(0, 20));

  for (const c of candidates) {
    if (isValidUsername(c) && !(await usernameExists(db, c))) return c;
  }

  // Worst case fallback.
  const fallback = normalizeUsername(`user_${suffixBase || "0000"}`).slice(0, 20);
  return fallback;
}

/**
 * Ensures /users/{uid} exists and contains username fields.
 * Safe to call on every login.
 */
export async function ensureUserProfile(db, user, { role, fullName, username } = {}) {
  if (!user?.uid) throw new Error("Missing user uid");

  const userRef = doc(db, "users", user.uid);
  const existing = await getDoc(userRef);
  const existingData = existing.exists() ? (existing.data() || {}) : {};
  const normalizedExistingUsername = existingData.username
    ? normalizeUsername(existingData.username)
    : "";

  const name = String(fullName || user.displayName || baseFromEmail(user.email) || "").trim();
  const photoURL = user.photoURL || "";

  // Determine username.
  const preferred = username ? normalizeUsername(username) : null;
  const base = preferred && isValidUsername(preferred)
    ? preferred
    : generateUsernameBase({ email: user.email, displayName: user.displayName });

  // Preserve an existing username if one was set previously.
  // This protects against cases where older documents only had `username` (no `usernameLower`).
  let usernameLower = existingData.usernameLower;
  if (!usernameLower && existingData.username) {
    if (isValidUsername(normalizedExistingUsername)) {
      usernameLower = normalizedExistingUsername;
    }
  }
  if (!usernameLower) {
    usernameLower = await pickUniqueUsernameLower(db, base, user.uid);
  }

  const payload = {
    name,
    nameLower: normalizeNameLower(name),
    photoURL,
    username: usernameLower,
    usernameLower,
    updatedAt: serverTimestamp(),
  };

  if (role) {
    payload.role = role;
  }

  if (!existing.exists()) {
    payload.createdAt = serverTimestamp();
    await setDoc(userRef, payload, { merge: false });
  } else {
    // Do not overwrite an existing explicit username; only fill missing.
    const updates = { ...payload };
    const hasExplicitUsernameLower =
      typeof existingData.usernameLower === "string" &&
      isValidUsername(existingData.usernameLower);
    const hasExplicitUsername =
      typeof existingData.username === "string" &&
      isValidUsername(normalizedExistingUsername);

    if (hasExplicitUsernameLower) {
      delete updates.username;
      delete updates.usernameLower;
    } else if (hasExplicitUsername) {
      // Preserve the user's chosen `username`, but backfill `usernameLower` for search/uniqueness.
      delete updates.username;
      updates.usernameLower = normalizedExistingUsername;
    }
    await setDoc(userRef, updates, { merge: true });
  }

  return { uid: user.uid, usernameLower };
}

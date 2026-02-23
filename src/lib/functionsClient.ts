import { auth } from "@/firebase";
import { onAuthStateChanged, type User } from "firebase/auth";

export function getFunctionsBaseUrl(): string {
  const explicit = import.meta.env.VITE_SUPABASE_FUNCTIONS_URL;
  if (explicit) {
    let url = String(explicit).trim().replace(/\/+$/, "");

    // Accept both invocation styles:
    // - https://<ref>.supabase.co/functions/v1
    // - https://<ref>.functions.supabase.co
    // A common misconfig is setting the latter + "/functions/v1".
    if (/\.functions\.supabase\.co\/functions\/v1$/i.test(url)) {
      url = url.replace(/\/functions\/v1$/i, "");
    }

    return url;
  }

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  if (!supabaseUrl) {
    throw new Error("Missing VITE_SUPABASE_URL (or VITE_SUPABASE_FUNCTIONS_URL)");
  }

  // Canonical functions base URL:
  // https://<ref>.supabase.co -> https://<ref>.supabase.co/functions/v1
  return `${String(supabaseUrl).trim().replace(/\/+$/, "")}/functions/v1`;
}

export async function getFirebaseIdToken(): Promise<string> {
  const existing = auth.currentUser;
  if (existing) return await existing.getIdToken();

  // On some pages we try to fetch signed URLs immediately on mount.
  // Firebase Auth may not have hydrated currentUser yet, even if the
  // user is signed in. Wait briefly for the auth state to initialize.
  const user = await new Promise<User | null>((resolve) => {
    let settled = false;

    const timeout = window.setTimeout(() => {
      if (settled) return;
      settled = true;
      resolve(auth.currentUser);
    }, 1500);

    const unsub = onAuthStateChanged(
      auth,
      (u) => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timeout);
        unsub();
        resolve(u);
      },
      () => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timeout);
        unsub();
        resolve(null);
      },
    );
  });

  if (!user) throw new Error("Not signed in");
  return await user.getIdToken();
}

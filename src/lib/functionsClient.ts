import { auth } from "@/firebase";

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
  const user = auth.currentUser;
  if (!user) throw new Error("Not signed in");
  return await user.getIdToken();
}

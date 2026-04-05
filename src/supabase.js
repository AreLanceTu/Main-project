import { createClient } from "@supabase/supabase-js";

const REQUIRED_ENV_VARS = ["VITE_SUPABASE_URL", "VITE_SUPABASE_ANON_KEY"];

const hasAnySupabaseEnv = Boolean(
  import.meta.env.VITE_SUPABASE_URL ||
    import.meta.env.VITE_SUPABASE_ANON_KEY ||
    import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
);

export const missingSupabaseEnvVars = hasAnySupabaseEnv
  ? REQUIRED_ENV_VARS.filter((k) => !import.meta.env[k])
  : [];

export const isSupabaseConfigured = hasAnySupabaseEnv && missingSupabaseEnvVars.length === 0;

export let supabaseInitError = null;
export let supabase = null;

function isValidUrl(value) {
  if (!value || typeof value !== "string") return false;
  try {
    const u = new URL(value);
    return u.protocol === "https:" || u.protocol === "http:";
  } catch {
    return false;
  }
}

if (!hasAnySupabaseEnv) {
  // Supabase is optional in this app. If you don't configure it, related features
  // (like some Storage uploads) should be considered disabled.
  supabase = null;
  supabaseInitError = null;
} else if (!isSupabaseConfigured) {
  supabaseInitError = new Error(
    `Missing Supabase env vars: ${missingSupabaseEnvVars.join(", ")}. Add them to .env.local and restart the dev server.`,
  );
} else if (!isValidUrl(import.meta.env.VITE_SUPABASE_URL)) {
  supabaseInitError = new Error(
    `Invalid Supabase URL in VITE_SUPABASE_URL: ${String(import.meta.env.VITE_SUPABASE_URL)}`,
  );
} else {
  try {
    // Supabase client (storage-only usage in this app)
    // Prefer publishable key if present, else anon key.
    const supabaseKey =
      import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ??
      import.meta.env.VITE_SUPABASE_ANON_KEY;

    supabase = createClient(import.meta.env.VITE_SUPABASE_URL, supabaseKey);
  } catch (e) {
    supabaseInitError = e;
  }
}

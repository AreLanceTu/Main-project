import { createClient } from "@supabase/supabase-js";

// Supabase client (storage-only usage in this app)
const supabaseKey =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ??
  import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  supabaseKey,
);

// @ts-nocheck
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { withCors } from "../_shared/cors.ts";
import { verifyFirebaseIdToken } from "../_shared/firebaseAuth.ts";

declare const Deno: any;

type Body = {
  bucket?: string;
  path?: string;
  contentType?: string;
};

function requireEnv(name: string): string {
  const v = String(Deno.env.get(name) || "").trim();
  if (!v) throw new Error(`Missing ${name}`);
  return v;
}

function normalize(value: unknown): string {
  return String(value || "").trim();
}

function sanitizeFilename(name: string): string {
  const base = normalize(name) || "file";
  return base.replace(/[^a-zA-Z0-9._-]/g, "_");
}

function isSafePath(path: string): boolean {
  // Prevent path traversal and disallow absolute paths.
  if (!path) return false;
  if (path.startsWith("/") || path.startsWith("\\")) return false;
  if (path.includes("..")) return false;
  return true;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: withCors() });
  }

  try {
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: withCors({ "Content-Type": "application/json" }),
      });
    }

    const supabaseUrl = requireEnv("SUPABASE_URL");
    const serviceRoleKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
    const firebaseProjectId = requireEnv("FIREBASE_PROJECT_ID");

    const token = req.headers.get("x-firebase-token") || req.headers.get("authorization");
    const { uid } = await verifyFirebaseIdToken(token, firebaseProjectId);

    const body = (await req.json().catch(() => null)) as Body | null;
    const bucket = normalize(body?.bucket) || "uploads";
    const contentType = normalize(body?.contentType) || "application/octet-stream";

    let path = normalize(body?.path);
    if (!path) {
      const safe = sanitizeFilename("attachment");
      path = `chat-uploads/${uid}/${Date.now()}-${safe}`;
    }

    if (!isSafePath(path)) {
      return new Response(JSON.stringify({ error: "Invalid path" }), {
        status: 400,
        headers: withCors({ "Content-Type": "application/json" }),
      });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { data, error } = await supabase.storage.from(bucket).createSignedUploadUrl(path, {
      contentType,
      upsert: true,
    });

    if (error) throw error;

    return new Response(
      JSON.stringify({
        bucket,
        path,
        token: data?.token || null,
        signedUrl: data?.signedUrl || null,
      }),
      { headers: withCors({ "Content-Type": "application/json" }) },
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ error: message || "Unknown error" }), {
      status: 400,
      headers: withCors({ "Content-Type": "application/json" }),
    });
  }
});

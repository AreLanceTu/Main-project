// @ts-nocheck
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { withCors } from "../_shared/cors.ts";
import { verifyFirebaseIdToken } from "../_shared/firebaseAuth.ts";

declare const Deno: any;

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
  if (!path) return false;
  if (path.startsWith("/") || path.startsWith("\\")) return false;
  if (path.includes("..")) return false;
  return true;
}

function json(status: number, body: any) {
  return new Response(JSON.stringify(body), {
    status,
    headers: withCors({ "Content-Type": "application/json" }),
  });
}

async function ensureBucketExists(supabase: any, bucket: string) {
  const name = normalize(bucket);
  if (!name) throw new Error("Missing bucket");

  const shouldBePublic = name === "uploads" || name === "gig-images";

  const { data: buckets, error: listError } = await supabase.storage.listBuckets();
  if (!listError && Array.isArray(buckets)) {
    const existing = buckets.find((b: any) => b?.name === name);
    if (existing) {
      // Best-effort: if the bucket exists but visibility doesn't match what we need, update it.
      try {
        const isPublic = Boolean((existing as any)?.public);
        if (isPublic !== shouldBePublic) {
          await supabase.storage.updateBucket(name, { public: shouldBePublic });
        }
      } catch {
        // ignore (updateBucket may not be available or permissions may block)
      }
      return;
    }
  }

  const { error: createError } = await supabase.storage.createBucket(name, { public: shouldBePublic });
  if (createError) {
    // If a concurrent request created it, ignore "already exists".
    const msg = String((createError as any)?.message || "");
    if (!msg.toLowerCase().includes("already")) throw createError;
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: withCors() });
  }

  try {
    if (req.method !== "POST") {
      return json(405, { error: "Method not allowed" });
    }

    const supabaseUrl = requireEnv("SUPABASE_URL");
    const serviceRoleKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
    const firebaseProjectId = requireEnv("FIREBASE_PROJECT_ID");

    const token = req.headers.get("x-firebase-token") || req.headers.get("authorization");
    const { uid } = await verifyFirebaseIdToken(token, firebaseProjectId);

    const url = new URL(req.url);
    const bucket = normalize(url.searchParams.get("bucket")) || "uploads";
    const rawPath = normalize(url.searchParams.get("path"));

    const fileName = sanitizeFilename(req.headers.get("x-file-name") || "file");
    const contentType = normalize(req.headers.get("content-type")) || "application/octet-stream";

    const path = rawPath || `uploads/${uid}/${Date.now()}-${fileName}`;
    if (!isSafePath(path)) return json(400, { error: "Invalid path" });

    // Read raw body as bytes.
    const ab = await req.arrayBuffer();
    const bytes = new Uint8Array(ab);
    if (!bytes?.length) return json(400, { error: "Empty upload" });

    // Basic size guard (Edge Functions have their own limits too).
    if (bytes.length > 25 * 1024 * 1024) return json(400, { error: "File too large (max 25MB)" });

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Make uploads more robust: auto-create the bucket if it doesn't exist.
    await ensureBucketExists(supabase, bucket);

    const { error: uploadError } = await supabase.storage.from(bucket).upload(path, bytes, {
      contentType,
      upsert: true,
      cacheControl: "3600",
    });

    if (uploadError) throw uploadError;

    const { data: publicData } = supabase.storage.from(bucket).getPublicUrl(path);
    const publicUrl = publicData?.publicUrl || null;

    return json(200, { bucket, path, publicUrl });
  } catch (e) {
    const message =
      typeof (e as any)?.message === "string"
        ? String((e as any).message)
        : e instanceof Error
          ? e.message
          : (() => {
              try {
                return JSON.stringify(e);
              } catch {
                return String(e);
              }
            })();

    const statusCode = Number((e as any)?.statusCode || (e as any)?.status) || 400;
    const extraHint = String(message || "").toLowerCase().includes("bucket")
      ? " Bucket not found: create it in Supabase Storage for the SAME project configured in this Edge Function (check SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)."
      : "";

    return json(statusCode, { error: `${message || "Unknown error"}${extraHint}`.trim() });
  }
});

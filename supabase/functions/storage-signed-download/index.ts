// @ts-nocheck
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { withCors } from "../_shared/cors.ts";
import { verifyFirebaseIdToken } from "../_shared/firebaseAuth.ts";

declare const Deno: any;

type Body = {
  bucket?: string;
  path?: string;
  expiresInSeconds?: number;
};

function requireEnv(name: string): string {
  const v = String(Deno.env.get(name) || "").trim();
  if (!v) throw new Error(`Missing ${name}`);
  return v;
}

function normalize(value: unknown): string {
  return String(value || "").trim();
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

  const { data: buckets, error: listError } = await supabase.storage.listBuckets();
  if (!listError && Array.isArray(buckets) && buckets.some((b: any) => b?.name === name)) {
    return;
  }

  const { error: createError } = await supabase.storage.createBucket(name, { public: false });
  if (createError) {
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
    await verifyFirebaseIdToken(token, firebaseProjectId);

    const body = (await req.json().catch(() => null)) as Body | null;
    const bucket = normalize(body?.bucket) || "uploads";
    const path = normalize(body?.path);
    if (!isSafePath(path)) return json(400, { error: "Invalid path" });

    const expiresInSecondsRaw = Number(body?.expiresInSeconds);
    const expiresInSeconds = Number.isFinite(expiresInSecondsRaw) && expiresInSecondsRaw > 0 ? expiresInSecondsRaw : 60 * 30;

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Auto-create bucket for first-time setup.
    await ensureBucketExists(supabase, bucket);

    const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, expiresInSeconds);
    if (error) throw error;

    return json(200, {
      bucket,
      path,
      signedUrl: data?.signedUrl || null,
      expiresInSeconds,
    });
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

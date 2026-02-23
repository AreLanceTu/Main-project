// @ts-nocheck
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { withCors } from "../_shared/cors.ts";
import { verifyFirebaseIdToken } from "../_shared/firebaseAuth.ts";

function json(status: number, body: any) {
  return new Response(JSON.stringify(body), {
    status,
    headers: withCors({ "Content-Type": "application/json" }),
  });
}

function normalizeMessage(e: unknown): string {
  if (typeof (e as any)?.message === "string") return String((e as any).message);
  if (e instanceof Error) return e.message;
  try {
    return JSON.stringify(e);
  } catch {
    return String(e);
  }
}

function pickStatusFromErrorMessage(message: string): number {
  const m = String(message || "").toLowerCase();
  if (!m) return 500;

  // Auth / token problems should be 401.
  if (
    m.includes("missing token") ||
    m.includes("unauthorized") ||
    m.includes("jwt") ||
    m.includes("audience") ||
    m.includes("issuer") ||
    m.includes("token") && m.includes("uid")
  ) {
    return 401;
  }

  // Server misconfig / schema issues should be 500.
  if (m.includes("missing supabase env") || m.includes("missing firebase_project_id")) return 500;
  if (m.includes("relation") && m.includes("does not exist")) return 500;

  return 400;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: withCors() });
  }

  try {
    if (req.method !== "GET") return json(405, { error: "Method not allowed" });

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const firebaseProjectId = Deno.env.get("FIREBASE_PROJECT_ID");

    if (!supabaseUrl || !serviceRoleKey) throw new Error("Missing Supabase env");
    if (!firebaseProjectId) throw new Error("Missing FIREBASE_PROJECT_ID");

    const authHeader = req.headers.get("x-firebase-token") || req.headers.get("authorization");
    if (!authHeader) {
      return json(401, { error: "Unauthorized: missing Firebase token" });
    }

    const verified = await verifyFirebaseIdToken(authHeader, firebaseProjectId);
    const uid = verified.uid;

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { data, error } = await supabase
      .from("user_subscriptions")
      .select("firebase_uid, plan, status, current_period_end")
      .eq("firebase_uid", uid)
      .maybeSingle();

    if (error) throw error;

    const now = Date.now();
    const endMs = data?.current_period_end ? Date.parse(String(data.current_period_end)) : NaN;
    const isActive = Boolean(data && data.status === "active" && Number.isFinite(endMs) && endMs > now);

    return json(200, {
      ok: true,
      active: isActive,
      plan: isActive ? (data?.plan || "pro") : null,
      currentPeriodEnd: data?.current_period_end || null,
    });
  } catch (e) {
    const message = normalizeMessage(e) || "Unknown error";
    const status = pickStatusFromErrorMessage(message);
    const hint = message.toLowerCase().includes("relation") && message.toLowerCase().includes("does not exist")
      ? "Database table missing. Apply Supabase migrations (supabase/migrations) to the linked project."
      : message.toLowerCase().includes("audience") || message.toLowerCase().includes("issuer")
        ? "Firebase token verification failed. Confirm the Edge Function secret FIREBASE_PROJECT_ID matches your Firebase project id (e.g. 'gigfl0w')."
        : "";

    return json(status, { error: hint ? `${message} (${hint})` : message });
  }
});

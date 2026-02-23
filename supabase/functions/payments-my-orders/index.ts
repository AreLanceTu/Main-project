// @ts-nocheck
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { withCors } from "../_shared/cors.ts";
import { verifyFirebaseIdToken } from "../_shared/firebaseAuth.ts";

function clampLimit(raw: string | null): number {
  const n = Number(raw);
  if (!Number.isFinite(n)) return 10;
  return Math.max(1, Math.min(25, Math.floor(n)));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: withCors() });
  }

  try {
    if (req.method !== "GET") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: withCors({ "Content-Type": "application/json" }),
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const firebaseProjectId = Deno.env.get("FIREBASE_PROJECT_ID");

    if (!supabaseUrl || !serviceRoleKey) throw new Error("Missing Supabase env");
    if (!firebaseProjectId) throw new Error("Missing FIREBASE_PROJECT_ID");

    const authHeader = req.headers.get("x-firebase-token") || req.headers.get("authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: withCors({ "Content-Type": "application/json" }),
      });
    }

    const verified = await verifyFirebaseIdToken(authHeader, firebaseProjectId);
    const uid = verified.uid;

    const url = new URL(req.url);
    const limit = clampLimit(url.searchParams.get("limit"));

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { data, error } = await supabase
      .from("payment_orders")
      .select(
        "id, amount, currency, status, receipt, razorpay_order_id, razorpay_payment_id, notes, created_at, paid_at",
      )
      .eq("firebase_uid", uid)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) throw error;

    return new Response(JSON.stringify({ ok: true, items: data || [] }), {
      headers: withCors({ "Content-Type": "application/json" }),
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ error: message || "Unknown error" }), {
      status: 400,
      headers: withCors({ "Content-Type": "application/json" }),
    });
  }
});

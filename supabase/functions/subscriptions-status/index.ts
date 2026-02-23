// @ts-nocheck
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { withCors } from "../_shared/cors.ts";
import { verifyFirebaseIdToken } from "../_shared/firebaseAuth.ts";

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

    return new Response(
      JSON.stringify({
        ok: true,
        active: isActive,
        plan: isActive ? (data?.plan || "pro") : null,
        currentPeriodEnd: data?.current_period_end || null,
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

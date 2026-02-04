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

    const token = req.headers.get("x-firebase-token") || req.headers.get("authorization");
    const { uid } = await verifyFirebaseIdToken(token, firebaseProjectId);

    const url = new URL(req.url);
    const rawLimit = url.searchParams.get("limit");
    let limit = rawLimit ? Number(rawLimit) : 25;
    if (!Number.isFinite(limit) || limit <= 0) limit = 25;
    limit = Math.min(100, Math.floor(limit));

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { data, error } = await supabase
      .from("withdrawals")
      .select("id, amount, status, created_at, updated_at, destination_summary")
      .eq("firebase_uid", uid)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) throw error;

    const withdrawals = (data || []).map((w: any) => ({
      id: w.id,
      amount: w.amount,
      status: w.status,
      createdAtISO: w.created_at,
      updatedAtISO: w.updated_at,
      destinationSummary: w.destination_summary,
    }));

    return new Response(JSON.stringify({ withdrawals }), {
      headers: withCors({ "Content-Type": "application/json" }),
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e?.message || "Unknown error" }), {
      status: 400,
      headers: withCors({ "Content-Type": "application/json" }),
    });
  }
});

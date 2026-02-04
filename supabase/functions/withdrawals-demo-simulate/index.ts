import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { withCors } from "../_shared/cors.ts";
import { verifyFirebaseIdToken } from "../_shared/firebaseAuth.ts";

type SimulateBody = {
  id: string;
  outcome: "completed" | "rejected";
};

Deno.serve(async (req) => {
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

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const firebaseProjectId = Deno.env.get("FIREBASE_PROJECT_ID");

    if (!supabaseUrl || !serviceRoleKey) throw new Error("Missing Supabase env");
    if (!firebaseProjectId) throw new Error("Missing FIREBASE_PROJECT_ID");

    const token = req.headers.get("x-firebase-token") || req.headers.get("authorization");
    const { uid } = await verifyFirebaseIdToken(token, firebaseProjectId);

    const body = (await req.json().catch(() => null)) as SimulateBody | null;
    if (!body) throw new Error("Invalid JSON body");

    const id = String(body.id || "").trim();
    if (!id) {
      return new Response(JSON.stringify({ error: "Missing id" }), {
        status: 400,
        headers: withCors({ "Content-Type": "application/json" }),
      });
    }

    const outcome = String(body.outcome || "").trim().toLowerCase();
    if (outcome !== "completed" && outcome !== "rejected") {
      return new Response(JSON.stringify({ error: "Invalid outcome" }), {
        status: 400,
        headers: withCors({ "Content-Type": "application/json" }),
      });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const nowISO = new Date().toISOString();

    const { data, error } = await supabase
      .from("withdrawals_demo")
      .update({
        simulate_outcome: outcome,
        simulate_finish_at: nowISO,
        status: outcome,
      })
      .eq("id", id)
      .eq("firebase_uid", uid)
      .select("id, status")
      .single();

    if (error) throw error;

    return new Response(JSON.stringify({ id: data.id, status: data.status }), {
      headers: withCors({ "Content-Type": "application/json" }),
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e?.message || "Unknown error" }), {
      status: 400,
      headers: withCors({ "Content-Type": "application/json" }),
    });
  }
});

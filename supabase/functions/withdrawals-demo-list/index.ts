import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { withCors } from "../_shared/cors.ts";
import { verifyFirebaseIdToken } from "../_shared/firebaseAuth.ts";

type WithdrawalRow = {
  id: string;
  amount: number;
  status: string;
  created_at: string;
  updated_at: string;
  destination_summary: string;
  simulate_outcome: "completed" | "rejected";
  simulate_finish_at: string | null;
};

function deriveFinalStatus(row: WithdrawalRow, now: number): string {
  const current = String(row.status || "").toLowerCase();
  if (current !== "pending" && current !== "processing") return row.status;

  if (!row.simulate_finish_at) return row.status;
  const finishMs = new Date(row.simulate_finish_at).getTime();
  if (!Number.isFinite(finishMs) || finishMs > now) return row.status;

  return row.simulate_outcome === "rejected" ? "rejected" : "completed";
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

    const token = req.headers.get("x-firebase-token") || req.headers.get("authorization");
    const { uid } = await verifyFirebaseIdToken(token, firebaseProjectId);

    const url = new URL(req.url);
    const rawLimit = url.searchParams.get("limit");
    let limit = rawLimit ? Number(rawLimit) : 25;
    if (!Number.isFinite(limit) || limit <= 0) limit = 25;
    limit = Math.min(100, Math.floor(limit));

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { data, error } = await supabase
      .from("withdrawals_demo")
      .select(
        "id, amount, status, created_at, updated_at, destination_summary, simulate_outcome, simulate_finish_at",
      )
      .eq("firebase_uid", uid)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) throw error;

    const rows = (data || []) as WithdrawalRow[];
    const now = Date.now();

    const toComplete: string[] = [];
    const toReject: string[] = [];

    const withdrawals = rows.map((w) => {
      const nextStatus = deriveFinalStatus(w, now);
      if (nextStatus !== w.status) {
        if (String(nextStatus).toLowerCase() === "completed") toComplete.push(w.id);
        else if (String(nextStatus).toLowerCase() === "rejected") toReject.push(w.id);
      }

      return {
        id: w.id,
        amount: w.amount,
        status: nextStatus,
        createdAtISO: w.created_at,
        updatedAtISO: w.updated_at,
        destinationSummary: w.destination_summary,
      };
    });

    if (toComplete.length) {
      const { error: updateError } = await supabase
        .from("withdrawals_demo")
        .update({ status: "completed" })
        .in("id", toComplete);
      if (updateError) throw updateError;
    }

    if (toReject.length) {
      const { error: updateError } = await supabase
        .from("withdrawals_demo")
        .update({ status: "rejected" })
        .in("id", toReject);
      if (updateError) throw updateError;
    }

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

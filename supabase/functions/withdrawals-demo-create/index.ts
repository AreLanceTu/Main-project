import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { withCors } from "../_shared/cors.ts";
import { verifyFirebaseIdToken } from "../_shared/firebaseAuth.ts";

type CreateWithdrawalBody = {
  amount: number;
  method: "bank" | "upi";
  accountHolderName: string;
  upiId?: string;
  bankAccountNumber?: string;
  ifsc?: string;
};

function destinationSummary(body: CreateWithdrawalBody): string {
  if (body.method === "upi") {
    return String(body.upiId || "").trim();
  }

  const acc = String(body.bankAccountNumber || "").trim();
  const last4 = acc.length >= 4 ? acc.slice(-4) : acc;
  const ifsc = String(body.ifsc || "").trim().toUpperCase();
  return `A/C •••• ${last4} / ${ifsc}`;
}

function pickOutcome(): "completed" | "rejected" {
  // ~85% success rate to feel realistic.
  return Math.random() < 0.85 ? "completed" : "rejected";
}

function pickFinishAt(): string {
  // 4-12 seconds from now.
  const ms = 4000 + Math.floor(Math.random() * 8000);
  return new Date(Date.now() + ms).toISOString();
}

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

    const body = (await req.json().catch(() => null)) as CreateWithdrawalBody | null;
    if (!body) throw new Error("Invalid JSON body");

    const amount = Number(body.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      return new Response(JSON.stringify({ error: "Invalid amount" }), {
        status: 400,
        headers: withCors({ "Content-Type": "application/json" }),
      });
    }

    const method = String(body.method || "");
    if (method !== "bank" && method !== "upi") {
      return new Response(JSON.stringify({ error: "Invalid method" }), {
        status: 400,
        headers: withCors({ "Content-Type": "application/json" }),
      });
    }

    const accountHolderName = String(body.accountHolderName || "").trim();
    if (!accountHolderName) {
      return new Response(JSON.stringify({ error: "Account holder name is required" }), {
        status: 400,
        headers: withCors({ "Content-Type": "application/json" }),
      });
    }

    if (method === "upi") {
      const upiId = String(body.upiId || "").trim();
      if (!upiId) {
        return new Response(JSON.stringify({ error: "UPI ID is required" }), {
          status: 400,
          headers: withCors({ "Content-Type": "application/json" }),
        });
      }
    } else {
      const bankAccountNumber = String(body.bankAccountNumber || "").trim();
      const ifsc = String(body.ifsc || "").trim().toUpperCase();
      if (!bankAccountNumber || !ifsc) {
        return new Response(JSON.stringify({ error: "Bank account number and IFSC are required" }), {
          status: 400,
          headers: withCors({ "Content-Type": "application/json" }),
        });
      }
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const outcome = pickOutcome();
    const finishAtISO = pickFinishAt();

    const insert = {
      firebase_uid: uid,
      amount,
      method,
      account_holder_name: accountHolderName,
      upi_id: method === "upi" ? String(body.upiId || "").trim() : null,
      bank_account_number: method === "bank" ? String(body.bankAccountNumber || "").trim() : null,
      ifsc: method === "bank" ? String(body.ifsc || "").trim().toUpperCase() : null,
      destination_summary: destinationSummary({
        amount,
        method: method as "bank" | "upi",
        accountHolderName,
        upiId: body.upiId,
        bankAccountNumber: body.bankAccountNumber,
        ifsc: body.ifsc,
      }),
      status: "processing",
      simulate_outcome: outcome,
      simulate_finish_at: finishAtISO,
    };

    const { data, error } = await supabase
      .from("withdrawals_demo")
      .insert(insert)
      .select("id, status, created_at, updated_at, destination_summary")
      .single();

    if (error) throw error;

    return new Response(
      JSON.stringify({
        id: data.id,
        status: data.status,
        createdAtISO: data.created_at,
        updatedAtISO: data.updated_at,
        destinationSummary: data.destination_summary,
      }),
      { headers: withCors({ "Content-Type": "application/json" }) },
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: e?.message || "Unknown error" }), {
      status: 400,
      headers: withCors({ "Content-Type": "application/json" }),
    });
  }
});

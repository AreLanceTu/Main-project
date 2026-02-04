// @ts-nocheck
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { withCors } from "../_shared/cors.ts";
import { verifyFirebaseIdToken } from "../_shared/firebaseAuth.ts";
import { hmacSha256Hex, timingSafeEqualHex } from "../_shared/razorpay.ts";

type VerifyBody = {
  // Preferred Razorpay keys (matches Checkout handler response)
  razorpay_order_id?: string;
  razorpay_payment_id?: string;
  razorpay_signature?: string;

  // Backwards compatible aliases
  orderId?: string;
  paymentId?: string;
  signature?: string;
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
    const razorpayKeySecret = Deno.env.get("RAZORPAY_KEY_SECRET");

    if (!supabaseUrl || !serviceRoleKey) throw new Error("Missing Supabase env");
    if (!razorpayKeySecret) throw new Error("Missing Razorpay env");

    // Optional Firebase auth:
    // - If a Firebase token is provided and FIREBASE_PROJECT_ID is configured, we enforce order ownership.
    // - Otherwise (demo flow), we skip ownership checks.
    let uid: string | null = null;
    const authHeader = req.headers.get("x-firebase-token") || req.headers.get("authorization");
    if (firebaseProjectId && authHeader) {
      const verified = await verifyFirebaseIdToken(authHeader, firebaseProjectId);
      uid = verified.uid;
    }

    const body = (await req.json().catch(() => null)) as VerifyBody | null;
    if (!body) throw new Error("Invalid JSON body");

    const orderId = String(body.razorpay_order_id || body.orderId || "");
    const paymentId = String(body.razorpay_payment_id || body.paymentId || "");
    const signature = String(body.razorpay_signature || body.signature || "");

    if (!orderId || !paymentId || !signature) {
      return new Response(JSON.stringify({ error: "Missing required payment fields" }), {
        status: 400,
        headers: withCors({ "Content-Type": "application/json" }),
      });
    }

    const expected = await hmacSha256Hex(razorpayKeySecret, `${orderId}|${paymentId}`);
    if (!timingSafeEqualHex(expected, signature)) {
      return new Response(JSON.stringify({ ok: false, error: "Invalid signature" }), {
        status: 401,
        headers: withCors({ "Content-Type": "application/json" }),
      });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // If uid is set, ensure the order belongs to this Firebase user.
    const { data: order, error: loadErr } = await supabase
      .from("payment_orders")
      .select("id, firebase_uid, status")
      .eq("razorpay_order_id", orderId)
      .maybeSingle();

    if (loadErr) throw loadErr;
    if (!order) {
      // Create the record if missing (webhook may have not run yet).
      await supabase.from("payment_orders").insert({
        firebase_uid: uid,
        amount: 0,
        currency: "INR",
        status: "paid",
        razorpay_order_id: orderId,
        razorpay_payment_id: paymentId,
        notes: {},
        paid_at: new Date().toISOString(),
      });
      return new Response(JSON.stringify({ ok: true, status: "paid" }), {
        headers: withCors({ "Content-Type": "application/json" }),
      });
    }

    if (uid && order.firebase_uid !== uid) {
      return new Response(JSON.stringify({ ok: false, error: "Forbidden" }), {
        status: 403,
        headers: withCors({ "Content-Type": "application/json" }),
      });
    }

    const { error: updErr } = await supabase
      .from("payment_orders")
      .update({
        status: "paid",
        razorpay_payment_id: paymentId,
        paid_at: new Date().toISOString(),
      })
      .eq("id", order.id);

    if (updErr) throw updErr;

    return new Response(JSON.stringify({ ok: true, status: "paid" }), {
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

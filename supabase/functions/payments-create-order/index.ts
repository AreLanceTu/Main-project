// @ts-nocheck
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { withCors } from "../_shared/cors.ts";
import { verifyFirebaseIdToken } from "../_shared/firebaseAuth.ts";
import { razorpayBasicAuthHeader } from "../_shared/razorpay.ts";

type CreateOrderBody = {
  // Amount in rupees.
  // Optional for backwards compatibility with the demo client.
  amount?: number;
  currency?: string; // default INR
  purpose?: string;
  notes?: Record<string, unknown>;
};

const DEFAULT_AMOUNT_RUPEES = 499; // Fallback amount for demo

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

    const razorpayKeyId = Deno.env.get("RAZORPAY_KEY_ID");
    const razorpayKeySecret = Deno.env.get("RAZORPAY_KEY_SECRET");

    if (!supabaseUrl || !serviceRoleKey) throw new Error("Missing Supabase env");
    if (!razorpayKeyId || !razorpayKeySecret) throw new Error("Missing Razorpay env");

    // Optional Firebase auth:
    // - If your app sends Authorization: Bearer <firebase_id_token>, we attribute the order to that user.
    // - If not provided (e.g., standalone HTML demo), we allow it but mark the uid as "guest".
    let uid = "guest";
    const authHeader = req.headers.get("x-firebase-token") || req.headers.get("authorization");
    if (firebaseProjectId && authHeader) {
      const verified = await verifyFirebaseIdToken(authHeader, firebaseProjectId);
      uid = verified.uid;
    }

    const body = (await req.json().catch(() => null)) as CreateOrderBody | null;
    if (!body) throw new Error("Invalid JSON body");

    const amountFromClient = Number(body.amount);
    const amountRupees = Number.isFinite(amountFromClient) && amountFromClient > 0
      ? amountFromClient
      : DEFAULT_AMOUNT_RUPEES;

    const currency = String(body.currency || "INR");
    if (currency !== "INR") {
      return new Response(JSON.stringify({ error: "Only INR supported" }), {
        status: 400,
        headers: withCors({ "Content-Type": "application/json" }),
      });
    }

    const amountPaise = Math.round(amountRupees * 100);
    if (amountPaise < 100) {
      return new Response(JSON.stringify({ error: "Minimum amount is ₹1.00" }), {
        status: 400,
        headers: withCors({ "Content-Type": "application/json" }),
      });
    }

    const receipt = `ord_${Date.now()}`;

    // 1) Create Razorpay order.
    const rpRes = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: razorpayBasicAuthHeader(razorpayKeyId, razorpayKeySecret),
      },
      body: JSON.stringify({
        amount: amountPaise,
        currency,
        receipt,
        notes: {
          purpose: body.purpose || "",
          firebase_uid: uid,
          ...(body.notes || {}),
        },
      }),
    });

    const rpJson = await rpRes.json().catch(() => ({}));
    if (!rpRes.ok) {
      return new Response(JSON.stringify({ error: "Razorpay order creation failed", details: rpJson }), {
        status: 502,
        headers: withCors({ "Content-Type": "application/json" }),
      });
    }

    const razorpayOrderId = String(rpJson?.id || "");
    if (!razorpayOrderId) throw new Error("Razorpay did not return order id");

    // 2) Persist order in Supabase.
    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const { error } = await supabase.from("payment_orders").insert({
      firebase_uid: uid,
      amount: amountPaise,
      currency,
      status: "created",
      razorpay_order_id: razorpayOrderId,
      receipt,
      notes: body.notes || {},
    });

    if (error) {
      // Still return order id so payment can proceed; webhook will reconcile.
      console.error("Failed to insert payment_orders", error);
    }

    return new Response(
      JSON.stringify({
        orderId: razorpayOrderId,
        amount: amountPaise,
        currency,
        razorpayKeyId,
        receipt,
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

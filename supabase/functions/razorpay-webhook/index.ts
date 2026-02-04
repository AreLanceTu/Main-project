import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { withCors } from "../_shared/cors.ts";
import { hmacSha256Hex, timingSafeEqualHex } from "../_shared/razorpay.ts";

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
    const webhookSecret = Deno.env.get("RAZORPAY_WEBHOOK_SECRET");

    if (!supabaseUrl || !serviceRoleKey) throw new Error("Missing Supabase env");
    if (!webhookSecret) throw new Error("Missing RAZORPAY_WEBHOOK_SECRET");

    const signatureHeader = req.headers.get("x-razorpay-signature") || "";

    // Razorpay signs the raw request body.
    const rawBody = await req.text();
    const expected = await hmacSha256Hex(webhookSecret, rawBody);

    if (!timingSafeEqualHex(expected, signatureHeader)) {
      return new Response(JSON.stringify({ ok: false, error: "Invalid webhook signature" }), {
        status: 401,
        headers: withCors({ "Content-Type": "application/json" }),
      });
    }

    const payload = JSON.parse(rawBody || "{}");

    const eventId = String(payload?.event_id || payload?.id || "");
    const eventType = String(payload?.event || "");

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Dedupe: store event, ignore if already received.
    if (eventId) {
      const { error: insertErr } = await supabase.from("payment_webhook_events").insert({
        razorpay_event_id: eventId,
        event_type: eventType || "unknown",
        payload,
        status: "received",
      });

      // Unique violation => already processed/received.
      if (insertErr) {
        return new Response(JSON.stringify({ ok: true, deduped: true }), {
          headers: withCors({ "Content-Type": "application/json" }),
        });
      }
    }

    // Try to update order status when possible.
    const orderId =
      payload?.payload?.payment?.entity?.order_id ||
      payload?.payload?.order?.entity?.id ||
      payload?.payload?.refund?.entity?.order_id ||
      null;

    const paymentId = payload?.payload?.payment?.entity?.id || null;
    const paymentStatus = payload?.payload?.payment?.entity?.status || null;

    if (orderId) {
      const nextStatus =
        eventType === "payment.captured" || eventType === "order.paid" || paymentStatus === "captured"
          ? "paid"
          : eventType === "payment.failed" || paymentStatus === "failed"
          ? "failed"
          : null;

      if (nextStatus) {
        await supabase
          .from("payment_orders")
          .update({
            status: nextStatus,
            razorpay_payment_id: paymentId || undefined,
            paid_at: nextStatus === "paid" ? new Date().toISOString() : undefined,
          })
          .eq("razorpay_order_id", String(orderId));
      }
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: withCors({ "Content-Type": "application/json" }),
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e?.message || "Unknown error" }), {
      status: 400,
      headers: withCors({ "Content-Type": "application/json" }),
    });
  }
});

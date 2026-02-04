import "dotenv/config";
import crypto from "node:crypto";
import express from "express";
import cors from "cors";
import { Pool } from "pg";
import { z } from "zod";

const PORT = Number(process.env.PORT || 5055);
const DATABASE_URL = process.env.DATABASE_URL;
const WEBHOOK_SECRET = process.env.RAZORPAYX_WEBHOOK_SECRET || "demo_webhook_secret";
const SELF_BASE_URL = process.env.SELF_BASE_URL || `http://localhost:${PORT}`;

if (!DATABASE_URL) {
  // eslint-disable-next-line no-console
  console.error("Missing DATABASE_URL. Create a Postgres DB and set DATABASE_URL env.");
  process.exit(1);
}

const pool = new Pool({ connectionString: DATABASE_URL });

const app = express();
app.use(cors({ origin: true, credentials: true }));

// Capture raw JSON body for webhook signature verification.
// Demo note: in production, also enforce size limits and strict content-types.
app.use(
  express.json({
    limit: "1mb",
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

function decodeJwtSubUnsafe(token) {
  // Demo only. This does NOT verify signature.
  if (!token) return null;
  const parts = String(token).split(".");
  if (parts.length < 2) return null;
  try {
    const payloadJson = Buffer.from(parts[1], "base64url").toString("utf8");
    const payload = JSON.parse(payloadJson);
    return payload.sub || payload.user_id || payload.uid || null;
  } catch {
    return null;
  }
}

function getDemoUid(req) {
  const auth = req.headers.authorization;
  const bearer = typeof auth === "string" && auth.startsWith("Bearer ") ? auth.slice(7) : null;
  const token = bearer || req.headers["x-firebase-token"];
  const uid = decodeJwtSubUnsafe(token);
  return uid || "demo-user";
}

function destinationSummary({ method, upiId, bankAccountNumber, ifsc }) {
  if (method === "upi") return String(upiId || "").trim();
  const acc = String(bankAccountNumber || "").trim();
  const last4 = acc.length >= 4 ? acc.slice(-4) : acc;
  const normalizedIfsc = String(ifsc || "").trim().toUpperCase();
  return `A/C •••• ${last4} / ${normalizedIfsc}`;
}

const CreateWithdrawalSchema = z.object({
  amount: z.number().finite().positive(),
  method: z.enum(["upi", "bank"]),
  accountHolderName: z.string().min(1),
  upiId: z.string().optional(),
  bankAccountNumber: z.string().optional(),
  ifsc: z.string().optional(),
  simulateOutcome: z.enum(["success", "failure", "random"]).optional(),
});

app.get("/health", (_req, res) => res.json({ ok: true }));

app.get("/", (_req, res) => {
  res
    .status(200)
    .setHeader("Content-Type", "text/html; charset=utf-8")
    .send(`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>RazorpayX Withdrawals Demo</title>
    <style>
      body{font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;margin:40px;line-height:1.4}
      code,pre{background:#f4f4f5;border:1px solid #e4e4e7;border-radius:8px}
      code{padding:2px 6px}
      pre{padding:12px;overflow:auto}
      a{color:#0f766e;text-decoration:none}
      a:hover{text-decoration:underline}
      .muted{color:#71717a}
    </style>
  </head>
  <body>
    <h1>RazorpayX Withdrawals Demo Server</h1>
    <p class="muted">This is an API server used by the Freelancer Dashboard “Demo mode”.</p>
    <ul>
      <li><a href="/health">/health</a> (quick check)</li>
      <li><code>GET /api/withdrawals</code></li>
      <li><code>POST /api/withdrawals</code></li>
      <li><code>POST /api/withdrawals/:id/simulate?outcome=success|failure|random</code></li>
    </ul>
    <h2>Quick test</h2>
    <pre>curl -X POST ${SELF_BASE_URL}/api/withdrawals \
  -H "Content-Type: application/json" \
  -d "{\"amount\":1000,\"method\":\"upi\",\"accountHolderName\":\"Demo User\",\"upiId\":\"demo@upi\",\"simulateOutcome\":\"success\"}"</pre>
    <p class="muted">Note: auth is demo-only; tokens are decoded but not verified.</p>
  </body>
</html>`);
});

app.get("/api/withdrawals", async (req, res) => {
  try {
    const uid = getDemoUid(req);
    const limit = Math.max(1, Math.min(100, Number(req.query.limit || 25)));

    const { rows } = await pool.query(
      `select id, amount, status, created_at, updated_at, destination_summary
       from public.razorpayx_demo_withdrawals
       where firebase_uid = $1
       order by created_at desc
       limit $2`,
      [uid, limit],
    );

    res.json({
      withdrawals: rows.map((r) => ({
        id: r.id,
        amount: Number(r.amount),
        status: r.status,
        createdAtISO: r.created_at,
        updatedAtISO: r.updated_at,
        destinationSummary: r.destination_summary,
      })),
    });
  } catch (e) {
    res.status(400).json({ error: e?.message || "Failed to list withdrawals" });
  }
});

app.post("/api/withdrawals", async (req, res) => {
  try {
    const uid = getDemoUid(req);
    const body = CreateWithdrawalSchema.parse(req.body);

    if (body.method === "upi") {
      if (!String(body.upiId || "").trim()) throw new Error("UPI ID is required");
    } else {
      if (!String(body.bankAccountNumber || "").trim() || !String(body.ifsc || "").trim()) {
        throw new Error("Bank account number and IFSC are required");
      }
    }

    const insert = {
      firebase_uid: uid,
      amount: body.amount,
      currency: "INR",
      method: body.method,
      account_holder_name: body.accountHolderName.trim(),
      upi_id: body.method === "upi" ? String(body.upiId || "").trim() : null,
      bank_account_number: body.method === "bank" ? String(body.bankAccountNumber || "").trim() : null,
      ifsc: body.method === "bank" ? String(body.ifsc || "").trim().toUpperCase() : null,
      destination_summary: destinationSummary(body),
      status: "processing",
      provider: "razorpayx",
      provider_reference_id: null,
      provider_payout_id: null,
      failure_reason: null,
    };

    const { rows } = await pool.query(
      `insert into public.razorpayx_demo_withdrawals (
        firebase_uid, amount, currency, method, account_holder_name,
        upi_id, bank_account_number, ifsc, destination_summary,
        status, provider, provider_reference_id, provider_payout_id, failure_reason
      ) values (
        $1,$2,$3,$4,$5,
        $6,$7,$8,$9,
        $10,$11,$12,$13,$14
      ) returning id, status, created_at, updated_at`,
      [
        insert.firebase_uid,
        insert.amount,
        insert.currency,
        insert.method,
        insert.account_holder_name,
        insert.upi_id,
        insert.bank_account_number,
        insert.ifsc,
        insert.destination_summary,
        insert.status,
        insert.provider,
        insert.provider_reference_id,
        insert.provider_payout_id,
        insert.failure_reason,
      ],
    );

    const created = rows[0];

    const outcome = body.simulateOutcome || "random";
    scheduleSimulation({
      withdrawalId: created.id,
      outcome,
    }).catch(() => {
      // best-effort
    });

    res.json({
      id: created.id,
      status: created.status,
      createdAtISO: created.created_at,
      updatedAtISO: created.updated_at,
    });
  } catch (e) {
    res.status(400).json({ error: e?.message || "Withdrawal request failed" });
  }
});

app.post("/api/withdrawals/:id/simulate", async (req, res) => {
  try {
    const withdrawalId = String(req.params.id || "").trim();
    const outcome = String(req.query.outcome || "random").toLowerCase();
    if (!withdrawalId) throw new Error("Missing withdrawal id");
    if (!["success", "failure", "random"].includes(outcome)) throw new Error("Invalid outcome");

    await scheduleSimulation({ withdrawalId, outcome });
    res.json({ ok: true });
  } catch (e) {
    res.status(400).json({ error: e?.message || "Simulation failed" });
  }
});

async function scheduleSimulation({ withdrawalId, outcome }) {
  const resolvedOutcome =
    outcome === "random" ? (Math.random() < 0.8 ? "success" : "failure") : outcome;

  const delayMs = 1200 + Math.floor(Math.random() * 2200);

  await new Promise((r) => setTimeout(r, delayMs));

  const event = buildWebhookEvent({
    withdrawalId,
    outcome: resolvedOutcome,
  });

  const rawBody = JSON.stringify(event);
  const signature = crypto.createHmac("sha256", WEBHOOK_SECRET).update(rawBody).digest("hex");

  // self-call webhook endpoint to exercise signature verification + idempotency
  await fetch(`${SELF_BASE_URL}/webhooks/razorpayx`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-razorpay-signature": signature,
    },
    body: rawBody,
  });
}

function buildWebhookEvent({ withdrawalId, outcome }) {
  const eventId = `evt_${crypto.randomBytes(10).toString("hex")}`;
  const payoutId = `pout_${crypto.randomBytes(8).toString("hex")}`;

  if (outcome === "success") {
    return {
      id: eventId,
      event: "payout.processed",
      created_at: Date.now(),
      payload: {
        payout: {
          entity: {
            id: payoutId,
            status: "processed",
            reference_id: withdrawalId,
          },
        },
      },
    };
  }

  return {
    id: eventId,
    event: "payout.failed",
    created_at: Date.now(),
    payload: {
      payout: {
        entity: {
          id: payoutId,
          status: "failed",
          reference_id: withdrawalId,
          failure_reason: "Beneficiary bank declined the transfer (sandbox simulation)",
        },
      },
    },
  };
}

app.post("/webhooks/razorpayx", async (req, res) => {
    try {
      const signature = String(req.headers["x-razorpay-signature"] || "");
      const rawBuffer = req.rawBody instanceof Buffer ? req.rawBody : null;
      const rawBody = rawBuffer ? rawBuffer.toString("utf8") : "";

      const expected = crypto
        .createHmac("sha256", WEBHOOK_SECRET)
        .update(rawBody)
        .digest("hex");

      if (!signature) {
        return res.status(401).json({ error: "Missing signature" });
      }

      const sigBuf = Buffer.from(signature);
      const expBuf = Buffer.from(expected);
      if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
        return res.status(401).json({ error: "Invalid signature" });
      }

      const evt = JSON.parse(rawBody);
      const eventId = String(evt?.id || "");
      const eventType = String(evt?.event || "");
      const entity = evt?.payload?.payout?.entity;
      const payoutId = String(entity?.id || "");
      const withdrawalId = String(entity?.reference_id || "");
      const failureReason = String(entity?.failure_reason || "").trim();

      if (!eventId || !eventType) throw new Error("Malformed event");

      // Idempotency: store event once
      await pool.query(
        `insert into public.razorpayx_demo_withdrawal_events (withdrawal_id, provider, event_id, event_type, payload)
         values ($1, 'razorpayx', $2, $3, $4)
         on conflict (provider, event_id) do nothing`,
        [withdrawalId || null, eventId, eventType, evt],
      );

      if (withdrawalId) {
        if (eventType === "payout.processed") {
          await pool.query(
            `update public.razorpayx_demo_withdrawals
             set status = 'completed', provider_payout_id = $2, failure_reason = null
             where id = $1`,
            [withdrawalId, payoutId || null],
          );
        } else if (eventType === "payout.failed") {
          await pool.query(
            `update public.razorpayx_demo_withdrawals
             set status = 'rejected', provider_payout_id = $2, failure_reason = $3
             where id = $1`,
            [withdrawalId, payoutId || null, failureReason || "Payout failed"],
          );
        } else if (eventType === "payout.processing") {
          await pool.query(
            `update public.razorpayx_demo_withdrawals
             set status = 'processing', provider_payout_id = $2
             where id = $1`,
            [withdrawalId, payoutId || null],
          );
        }
      }

      res.json({ ok: true });
    } catch (e) {
      res.status(400).json({ error: e?.message || "Webhook handling failed" });
    }
});

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`RazorpayX withdrawals demo server listening on ${SELF_BASE_URL}`);
});

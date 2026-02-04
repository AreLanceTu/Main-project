# RazorpayX Sandbox Withdrawals (Demo)

This repo already has a Supabase-backed withdrawals flow (Edge Functions + `public.withdrawals`).
This document adds an **optional demo Node.js backend** that simulates a RazorpayX payout lifecycle (success/failure) and drives the **Freelancer Dashboard** withdrawals list.

## Goals

- Demonstrate a withdrawal lifecycle like RazorpayX payouts
- Include a clear **DB schema**, **API flow**, and **webhook handling**
- Support **simulated success/failure** so the UI can show realistic states

## Database schema

Use the included SQL:

- `server/razorpayx-withdrawals-demo/schema.sql`

Tables:

- `razorpayx_demo_withdrawals`
  - core withdrawal request
  - status: `pending | processing | completed | rejected`
  - provider fields: `provider_payout_id`, `provider_reference_id`
  - destination summary string for display
- `razorpayx_demo_withdrawal_events`
  - stores every webhook event once (idempotency)
  - unique constraint on `(provider, event_id)`

## API flow

### 1) Create withdrawal

`POST /api/withdrawals`

Body (bank):

- `amount`
- `method: "bank"`
- `accountHolderName`
- `bankAccountNumber`
- `ifsc`
- optional: `simulateOutcome: "success" | "failure" | "random"`

Body (upi):

- `amount`
- `method: "upi"`
- `accountHolderName`
- `upiId`
- optional: `simulateOutcome`

Response:

- `{ id, status }`

Server behavior:

- inserts a row in `withdrawals` as `processing`
- schedules a simulated outcome (80% success by default)
- calls its own webhook endpoint to exercise signature verification + idempotency

### 2) Webhook callback (RazorpayX style)

`POST /webhooks/razorpayx`

- expects header: `x-razorpay-signature`
- verifies signature as HMAC-SHA256 over raw request body using `RAZORPAYX_WEBHOOK_SECRET`

Supported events (demo):

- `payout.processing` → keeps `processing`
- `payout.processed` → updates to `completed`
- `payout.failed` → updates to `rejected` and stores failure reason

### 3) List withdrawals (Freelancer dashboard)

`GET /api/withdrawals?limit=25`

Returns:

- `{ withdrawals: WithdrawalListItem[] }`

## Wiring to the frontend (Freelancer Dashboard)

The frontend can be pointed at the demo server using:

- `VITE_WITHDRAWALS_API_URL=http://localhost:5055`

Then the existing freelancer UI will use the demo endpoints for:

- creating a withdrawal
- listing withdrawals

If `VITE_WITHDRAWALS_API_URL` is **not** set, the app continues using the existing Supabase Edge Functions (`withdrawals-create` / `withdrawals-list`).

## Running the demo server

1) Create a Postgres database and apply schema:

- Run the SQL in `server/razorpayx-withdrawals-demo/schema.sql`

2) Install server deps:

- `cd server/razorpayx-withdrawals-demo`
- `npm install`

3) Configure env:

- `DATABASE_URL=postgres://...`
- `RAZORPAYX_WEBHOOK_SECRET=demo_webhook_secret`
- optional: `PORT=5055`
- optional: `SELF_BASE_URL=http://localhost:5055`

4) Start:

- `npm run dev`

5) Verify it’s up:

- Open `http://localhost:5055/` (simple status page)
- Or `http://localhost:5055/health` (JSON health check)

## Notes / Production hardening

- The demo server decodes the Firebase ID token **without verifying it** (demo-only). In production, verify it using `firebase-admin` and enforce per-user authorization.
- Webhook handling is idempotent (stores webhook events once), which is required in real payout systems.

# Supabase (Edge Functions) for Razorpay + UPI payments

This project keeps **Firebase for auth + chat** and uses **Supabase only for payments**.

No Firebase Cloud Functions are used.

## What you get

- SQL schema for payment orders + webhook event log
- Supabase Edge Functions:
  - `payments-create-order`: creates a Razorpay order
  - `payments-verify`: verifies Razorpay signature after Checkout success
  - `razorpay-webhook`: receives Razorpay webhooks (signature-verified)
- Frontend flow using Firebase ID token + Razorpay Checkout

Also included (to eliminate legacy `/api/*` calls without Firebase Functions):

- Withdrawals (payout request) schema + Edge Functions:
  - `withdrawals-create`: create a withdrawal request
  - `withdrawals-list`: list the current user’s requests

## 1) Create Supabase project

- Create a Supabase project (free tier is fine).
- Copy:
  - Project URL (looks like `https://<ref>.supabase.co`)
  - Anon key

## 2) Add frontend env

Set these in your Vite env (local `.env` and/or Hosting env):

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Optional (recommended if you want to be explicit):

- `VITE_SUPABASE_FUNCTIONS_URL` (example: `https://<ref>.functions.supabase.co`)

If `VITE_SUPABASE_FUNCTIONS_URL` is not set, the frontend derives it from `VITE_SUPABASE_URL`.

## 3) Apply database schema

Run the SQL in [supabase/migrations/20251225_payments.sql](supabase/migrations/20251225_payments.sql) using:

- Supabase SQL editor, or
- Supabase CLI (`supabase db push`)

Also apply withdrawals schema:

- [supabase/migrations/2025122502_withdrawals.sql](supabase/migrations/2025122502_withdrawals.sql)

## 4) Configure Edge Function secrets

Set these secrets in Supabase (Dashboard → Project Settings → Functions → Secrets) or via CLI:

- `SUPABASE_URL` (provided automatically in Supabase runtime)
- `SUPABASE_SERVICE_ROLE_KEY` (required for DB writes)
- `FIREBASE_PROJECT_ID` (your Firebase project id)
- `OPENROUTER_API_KEY` (required for AI functions like `ai-gig-title`, `ai-chat`)
- `OPENROUTER_MODEL` (optional; default: `openai/gpt-4o-mini`)
- `RAZORPAY_KEY_ID`
- `RAZORPAY_KEY_SECRET`
- `RAZORPAY_WEBHOOK_SECRET`

Local development tip:

- Copy [supabase/.env.example](supabase/.env.example) to `supabase/.env` and fill values.
- Then run `supabase functions serve --env-file supabase/.env`.

## 5) Deploy Edge Functions

Install Supabase CLI (recommended: as a project dev dependency) and run it via `npx`:

- `npm i -D supabase`
- `npx supabase login`

(Note: `npm i -g supabase` is not supported by Supabase CLI.)

These functions intentionally disable Supabase JWT verification because the app uses Firebase Auth.

- Config is in [supabase/config.toml](supabase/config.toml)

Deploy (examples):

- `supabase functions deploy payments-create-order`
- `supabase functions deploy payments-verify`
- `supabase functions deploy razorpay-webhook`
- `supabase functions deploy withdrawals-create`
- `supabase functions deploy withdrawals-list`
- `supabase functions deploy ai-gig-title`
- `supabase functions deploy ai-chat`

If you don’t use `supabase/config.toml`, deploy with:

- `supabase functions deploy payments-create-order --no-verify-jwt`
- `supabase functions deploy payments-verify --no-verify-jwt`
- `supabase functions deploy razorpay-webhook --no-verify-jwt`

## Smoke test (backend)

Before testing Razorpay Checkout, confirm the Edge Function is actually deployed and reachable.

Expected result: HTTP `200` with JSON containing `orderId`.

- Windows (PowerShell):
  - `curl.exe -i -X POST -H "Content-Type: application/json" -d "{\"currency\":\"INR\",\"purpose\":\"Smoke test\"}" https://<project-ref>.functions.supabase.co/payments-create-order`

If you see `404 Requested function was not found`, the function is not deployed to that Supabase project yet.

Note: `firebase deploy` does not deploy Supabase Edge Functions.

## AI title generation (Gig title helper)

The Freelancer Dashboard “Generate Title (AI)” button calls the Supabase Edge Function `ai-gig-title`.

Checklist if the button shows "AI title failed":

- Ensure the function is deployed: `supabase functions deploy ai-gig-title`
- Ensure secrets are set in Supabase:
  - `FIREBASE_PROJECT_ID`
  - `OPENROUTER_API_KEY`

If the function isn’t deployed you’ll typically see `Requested function was not found`.

## 6) Configure Razorpay webhook

In Razorpay Dashboard → Webhooks:

- URL:
  - `https://<your-supabase-project-ref>.functions.supabase.co/razorpay-webhook`
- Secret:
  - Must match `RAZORPAY_WEBHOOK_SECRET`
- Events (recommended minimum):
  - `payment.captured`
  - `payment.failed`
  - `order.paid`

## 7) Frontend flow

1. User signs in with Firebase.
2. Frontend requests order:
   - Calls Supabase function `payments-create-order`
   - Sends `Authorization: Bearer <firebase-id-token>`
3. Frontend opens Razorpay Checkout with the returned `orderId`.
4. On success, frontend calls `payments-verify` with:
   - `orderId`, `paymentId`, `signature`
5. Webhook acts as backup reconciliation if the verify call is skipped.

Security note: You must treat the webhook as the final source of truth for captured/failed events.

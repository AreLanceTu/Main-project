-- Payments schema (Razorpay) for a Firebase-auth app using Supabase only for payments.
-- Apply with: supabase db push (or run in SQL editor).

create extension if not exists pgcrypto;
create table if not exists public.payment_orders (
  id uuid primary key default gen_random_uuid(),
  firebase_uid text not null,

  amount integer not null check (amount > 0), -- Razorpay expects smallest currency unit (paise)
  currency text not null default 'INR',

  status text not null default 'created' check (status in (
    'created',
    'attempted',
    'paid',
    'failed',
    'cancelled'
  )),

  razorpay_order_id text unique,
  razorpay_payment_id text,

  receipt text,
  notes jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  paid_at timestamptz
);
create table if not exists public.payment_webhook_events (
  id uuid primary key default gen_random_uuid(),
  razorpay_event_id text unique,
  event_type text not null,
  payload jsonb not null,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  status text not null default 'received' check (status in ('received', 'processed', 'ignored', 'error'))
);
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
drop trigger if exists trg_payment_orders_updated_at on public.payment_orders;
create trigger trg_payment_orders_updated_at
before update on public.payment_orders
for each row execute function public.set_updated_at();
-- Lock down tables: frontend uses Edge Functions; Edge Functions use service role.
alter table public.payment_orders enable row level security;
alter table public.payment_webhook_events enable row level security;
-- No RLS policies on purpose (deny-by-default for anon/auth).;

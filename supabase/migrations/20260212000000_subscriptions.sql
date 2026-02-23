-- Pro subscription schema (₹800) tied to Firebase UID.

create extension if not exists pgcrypto;

create table if not exists public.user_subscriptions (
  id uuid primary key default gen_random_uuid(),
  firebase_uid text not null unique,

  plan text not null default 'pro',
  status text not null default 'active' check (status in ('active', 'inactive', 'cancelled', 'expired')),

  current_period_start timestamptz not null default now(),
  current_period_end timestamptz not null,

  last_payment_order_id text,
  last_payment_id text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_user_subscriptions_updated_at on public.user_subscriptions;
create trigger trg_user_subscriptions_updated_at
before update on public.user_subscriptions
for each row execute function public.set_updated_at();

create index if not exists idx_user_subscriptions_uid on public.user_subscriptions (firebase_uid);
create index if not exists idx_user_subscriptions_status_end on public.user_subscriptions (status, current_period_end desc);

alter table public.user_subscriptions enable row level security;
-- No RLS policies on purpose (deny-by-default); use Edge Functions with service role.

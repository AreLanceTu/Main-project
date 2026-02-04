-- Demo schema for RazorpayX sandbox withdrawals.
-- Uses Postgres (works with Supabase/Postgres too).

create extension if not exists pgcrypto;

create table if not exists public.razorpayx_demo_withdrawals (
  id uuid primary key default gen_random_uuid(),
  firebase_uid text not null,

  amount numeric(12,2) not null check (amount > 0),
  currency text not null default 'INR',
  method text not null check (method in ('bank', 'upi')),

  account_holder_name text not null,
  upi_id text,
  bank_account_number text,
  ifsc text,
  destination_summary text not null,

  status text not null default 'processing' check (status in ('pending','processing','completed','rejected')),

  provider text not null default 'razorpayx',
  provider_payout_id text,
  provider_reference_id text,

  failure_reason text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_withdrawals_firebase_uid_created_at
  on public.razorpayx_demo_withdrawals (firebase_uid, created_at desc);

create table if not exists public.razorpayx_demo_withdrawal_events (
  id uuid primary key default gen_random_uuid(),
  withdrawal_id uuid references public.razorpayx_demo_withdrawals(id) on delete cascade,

  provider text not null default 'razorpayx',
  event_id text not null,
  event_type text not null,

  payload jsonb not null,

  created_at timestamptz not null default now(),

  unique(provider, event_id)
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

drop trigger if exists trg_withdrawals_updated_at on public.razorpayx_demo_withdrawals;
create trigger trg_withdrawals_updated_at
before update on public.razorpayx_demo_withdrawals
for each row execute function public.set_updated_at();

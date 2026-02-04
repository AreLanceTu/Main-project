-- Supabase-hosted demo withdrawals (RazorpayX-like simulation).
-- Separate from real withdrawals to avoid mixing demo data.

create table if not exists public.withdrawals_demo (
  id uuid primary key default gen_random_uuid(),
  firebase_uid text not null,

  amount numeric(12,2) not null check (amount > 0),
  method text not null check (method in ('bank', 'upi')),

  account_holder_name text not null,
  upi_id text,
  bank_account_number text,
  ifsc text,

  destination_summary text not null,

  status text not null default 'processing' check (status in (
    'pending',
    'processing',
    'completed',
    'rejected'
  )),

  -- Simulation controls
  simulate_outcome text not null default 'completed' check (simulate_outcome in ('completed', 'rejected')),
  simulate_finish_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Reuse the same updated_at trigger function created in 20251225_withdrawals.sql

drop trigger if exists trg_withdrawals_demo_updated_at on public.withdrawals_demo;
create trigger trg_withdrawals_demo_updated_at
before update on public.withdrawals_demo
for each row execute function public.set_updated_at();

alter table public.withdrawals_demo enable row level security;
-- No RLS policies on purpose (deny-by-default for anon/auth).

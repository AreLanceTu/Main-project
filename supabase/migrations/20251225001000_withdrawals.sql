-- Withdrawals (payout requests) stored in Supabase.
-- Firebase remains the auth provider; Edge Functions write/read using service role.

create table if not exists public.withdrawals (
  id uuid primary key default gen_random_uuid(),
  firebase_uid text not null,

  amount numeric(12,2) not null check (amount > 0),
  method text not null check (method in ('bank', 'upi')),

  account_holder_name text not null,
  upi_id text,
  bank_account_number text,
  ifsc text,

  destination_summary text not null,

  status text not null default 'pending' check (status in (
    'pending',
    'processing',
    'completed',
    'rejected'
  )),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
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

drop trigger if exists trg_withdrawals_updated_at on public.withdrawals;
create trigger trg_withdrawals_updated_at
before update on public.withdrawals
for each row execute function public.set_updated_at();

alter table public.withdrawals enable row level security;
-- No RLS policies on purpose (deny-by-default for anon/auth).

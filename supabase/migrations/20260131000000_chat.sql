-- Chat schema for Supabase-backed messaging (Firebase Auth via Edge Functions)

create extension if not exists "pgcrypto";

create table if not exists public.chat_conversations (
  id text primary key,
  uid_a text not null,
  uid_b text not null,
  last_message text not null default '',
  last_message_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Enforce deterministic pair uniqueness (uids should be sorted before insert/upsert).
create unique index if not exists chat_conversations_uid_pair_idx
  on public.chat_conversations (uid_a, uid_b);

create index if not exists chat_conversations_uid_a_last_idx
  on public.chat_conversations (uid_a, last_message_at desc nulls last);

create index if not exists chat_conversations_uid_b_last_idx
  on public.chat_conversations (uid_b, last_message_at desc nulls last);

create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id text not null references public.chat_conversations(id) on delete cascade,
  sender_uid text not null,
  receiver_uid text not null,
  body text not null,
  created_at timestamptz not null default now(),
  read_at timestamptz
);

create index if not exists chat_messages_conversation_created_idx
  on public.chat_messages (conversation_id, created_at);

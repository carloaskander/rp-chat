create extension if not exists pgcrypto;

create table if not exists public.chats (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default '',
  story_summary text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  chat_id uuid not null references public.chats(id) on delete cascade,
  role text not null,
  content text not null,
  created_at timestamptz not null default now(),
  is_archived boolean not null default false
);

create index if not exists chats_user_id_idx on public.chats(user_id);
create index if not exists messages_chat_id_idx on public.messages(chat_id);
create index if not exists messages_created_at_idx on public.messages(created_at);

alter table public.chats enable row level security;
alter table public.messages enable row level security;

drop policy if exists chats_select_own on public.chats;
create policy chats_select_own
on public.chats
for select
using (auth.uid() = user_id);

drop policy if exists chats_insert_own on public.chats;
create policy chats_insert_own
on public.chats
for insert
with check (auth.uid() = user_id);

drop policy if exists chats_update_own on public.chats;
create policy chats_update_own
on public.chats
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists chats_delete_own on public.chats;
create policy chats_delete_own
on public.chats
for delete
using (auth.uid() = user_id);

drop policy if exists messages_select_own_chats on public.messages;
create policy messages_select_own_chats
on public.messages
for select
using (
  exists (
    select 1
    from public.chats
    where chats.id = messages.chat_id
      and chats.user_id = auth.uid()
  )
);

drop policy if exists messages_insert_own_chats on public.messages;
create policy messages_insert_own_chats
on public.messages
for insert
with check (
  exists (
    select 1
    from public.chats
    where chats.id = messages.chat_id
      and chats.user_id = auth.uid()
  )
);

drop policy if exists messages_update_own_chats on public.messages;
create policy messages_update_own_chats
on public.messages
for update
using (
  exists (
    select 1
    from public.chats
    where chats.id = messages.chat_id
      and chats.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.chats
    where chats.id = messages.chat_id
      and chats.user_id = auth.uid()
  )
);

drop policy if exists messages_delete_own_chats on public.messages;
create policy messages_delete_own_chats
on public.messages
for delete
using (
  exists (
    select 1
    from public.chats
    where chats.id = messages.chat_id
      and chats.user_id = auth.uid()
  )
);

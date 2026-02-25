create table if not exists public.api_keys (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null,
  encrypted_key text not null,
  created_at timestamptz not null default now(),
  unique (user_id, provider)
);

create index if not exists api_keys_user_id_idx on public.api_keys(user_id);

alter table public.api_keys enable row level security;

drop policy if exists api_keys_select_own on public.api_keys;
create policy api_keys_select_own
on public.api_keys
for select
using (auth.uid() = user_id);

drop policy if exists api_keys_insert_own on public.api_keys;
create policy api_keys_insert_own
on public.api_keys
for insert
with check (auth.uid() = user_id);

drop policy if exists api_keys_update_own on public.api_keys;
create policy api_keys_update_own
on public.api_keys
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists api_keys_delete_own on public.api_keys;
create policy api_keys_delete_own
on public.api_keys
for delete
using (auth.uid() = user_id);

create table if not exists public.api_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  provider text not null,
  model text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists api_profiles_user_id_idx on public.api_profiles(user_id);

alter table public.api_profiles enable row level security;

drop policy if exists api_profiles_select_own on public.api_profiles;
create policy api_profiles_select_own
on public.api_profiles
for select
using (auth.uid() = user_id);

drop policy if exists api_profiles_insert_own on public.api_profiles;
create policy api_profiles_insert_own
on public.api_profiles
for insert
with check (auth.uid() = user_id);

drop policy if exists api_profiles_update_own on public.api_profiles;
create policy api_profiles_update_own
on public.api_profiles
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists api_profiles_delete_own on public.api_profiles;
create policy api_profiles_delete_own
on public.api_profiles
for delete
using (auth.uid() = user_id);

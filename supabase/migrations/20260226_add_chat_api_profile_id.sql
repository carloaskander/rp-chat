alter table public.chats
add column if not exists api_profile_id uuid null references public.api_profiles(id) on delete set null;

create index if not exists chats_api_profile_id_idx on public.chats(api_profile_id);

alter table public.chats
add column if not exists character_preset_id text null,
add column if not exists instruction_preset_id text null;

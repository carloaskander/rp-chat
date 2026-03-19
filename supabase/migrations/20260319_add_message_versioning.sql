alter table public.messages
add column if not exists version_group_id uuid,
add column if not exists is_active boolean,
add column if not exists sequence_number integer,
add column if not exists response_to_message_id uuid references public.messages(id) on delete set null;

update public.messages
set version_group_id = id
where version_group_id is null;

update public.messages
set is_active = true
where is_active is null;

with ordered_messages as (
  select
    id,
    row_number() over (
      partition by chat_id
      order by created_at asc, id asc
    ) as next_sequence_number
  from public.messages
)
update public.messages as messages
set sequence_number = ordered_messages.next_sequence_number
from ordered_messages
where messages.id = ordered_messages.id
  and messages.sequence_number is null;

alter table public.messages
alter column version_group_id set not null,
alter column is_active set not null,
alter column is_active set default true,
alter column sequence_number set not null;

create index if not exists messages_chat_id_sequence_number_idx
on public.messages(chat_id, sequence_number);

create index if not exists messages_chat_id_is_active_sequence_number_idx
on public.messages(chat_id, is_active, sequence_number);

create index if not exists messages_version_group_id_idx
on public.messages(version_group_id);

create index if not exists messages_response_to_message_id_idx
on public.messages(response_to_message_id);

create unique index if not exists messages_one_active_version_per_group_idx
on public.messages(version_group_id)
where is_active = true;

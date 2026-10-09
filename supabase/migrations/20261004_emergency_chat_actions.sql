alter table public.emergency_chats
  add column if not exists inicio_enviado boolean not null default false;

grant update, delete on public.emergency_chats to authenticated;
grant delete on public.emergency_messages to authenticated;
grant insert on public.emergency_chats to authenticated;

drop policy if exists emergency_chats_create on public.emergency_chats;
create policy emergency_chats_create
on public.emergency_chats for insert to authenticated
with check (activo = true);

drop policy if exists emergency_chats_read on public.emergency_chats;
create policy emergency_chats_read
on public.emergency_chats for select to authenticated
using (true);

drop policy if exists emergency_chats_update on public.emergency_chats;
create policy emergency_chats_update
on public.emergency_chats for update to authenticated
using (activo = true)
with check (activo = false);

drop policy if exists emergency_chats_delete on public.emergency_chats;
create policy emergency_chats_delete
on public.emergency_chats for delete to authenticated
using (activo = false);

drop policy if exists emergency_messages_delete on public.emergency_messages;
create policy emergency_messages_delete
on public.emergency_messages for delete to authenticated
using (
  exists (
    select 1
    from public.emergency_chats chat
    where chat.id = emergency_messages.chat_id
      and chat.activo = false
  )
);

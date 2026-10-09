begin;
create table if not exists public.emergency_chat_preferences (
 usuario_id uuid primary key references auth.users(id) on delete cascade,
 valor integer not null default 50 check (valor between 0 and 100),
 x integer check (x between 0 and 10000),
 y integer check (y between 0 and 10000),
 ancho integer check (ancho between 300 and 10000),
 alto integer check (alto between 280 and 10000),
 actualizado_en timestamptz not null default now()
);
alter table public.emergency_messages add column if not exists enviado_por uuid references auth.users(id) on delete set null;
alter table public.emergency_messages add column if not exists direccion text not null default 'entrada';
alter table public.emergency_messages add column if not exists enviado boolean not null default false;
alter table public.emergency_chats add column if not exists inicio_enviado boolean not null default false;
alter table public.emergency_messages enable row level security;
alter table public.emergency_chats enable row level security;
alter table public.emergency_chat_preferences enable row level security;
grant select on public.emergency_chats to authenticated;
grant select,insert on public.emergency_messages to authenticated;
grant select,insert,update on public.emergency_chat_preferences to authenticated;
drop policy if exists emergency_chats_read on public.emergency_chats;
create policy emergency_chats_read on public.emergency_chats for select to authenticated using (activo=true);
drop policy if exists emergency_messages_read on public.emergency_messages;
create policy emergency_messages_read on public.emergency_messages for select to authenticated using (true);
drop policy if exists emergency_messages_create on public.emergency_messages;
create policy emergency_messages_create on public.emergency_messages for insert to authenticated with check (enviado_por=(select auth.uid()) and direccion='salida' and enviado=false);
drop policy if exists emergency_preferences_read on public.emergency_chat_preferences;
create policy emergency_preferences_read on public.emergency_chat_preferences for select to authenticated using (usuario_id=(select auth.uid()));
drop policy if exists emergency_preferences_create on public.emergency_chat_preferences;
create policy emergency_preferences_create on public.emergency_chat_preferences for insert to authenticated with check (usuario_id=(select auth.uid()));
drop policy if exists emergency_preferences_update on public.emergency_chat_preferences;
create policy emergency_preferences_update on public.emergency_chat_preferences for update to authenticated using (usuario_id=(select auth.uid())) with check (usuario_id=(select auth.uid()));
commit;

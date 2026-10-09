create table if not exists public.service_heartbeats (
 service_id text primary key,
 updated_at timestamptz not null default now()
);

alter table public.service_heartbeats enable row level security;
grant select on public.service_heartbeats to authenticated;
revoke all on public.service_heartbeats from anon;

drop policy if exists service_heartbeats_read on public.service_heartbeats;
create policy service_heartbeats_read
on public.service_heartbeats for select to authenticated
using (true);

grant select, insert, update on public.service_heartbeats to service_role;

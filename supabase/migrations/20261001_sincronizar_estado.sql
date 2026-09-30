begin;
create table if not exists public.campus_estado (
 usuario_id uuid not null references auth.users(id) on delete cascade,
 clave text not null check (clave = 'ocultar_completadas' or clave like 'actividad:%'),
 valor boolean not null default false,
 primary key (usuario_id, clave)
);
alter table public.campus_estado enable row level security;
revoke all on public.campus_estado from anon;
grant select, insert, update on public.campus_estado to authenticated;
drop policy if exists campus_estado_leer on public.campus_estado;
create policy campus_estado_leer on public.campus_estado for select to authenticated using (usuario_id = (select auth.uid()));
drop policy if exists campus_estado_crear on public.campus_estado;
create policy campus_estado_crear on public.campus_estado for insert to authenticated with check (usuario_id = (select auth.uid()));
drop policy if exists campus_estado_editar on public.campus_estado;
create policy campus_estado_editar on public.campus_estado for update to authenticated using (usuario_id = (select auth.uid())) with check (usuario_id = (select auth.uid()));
commit;

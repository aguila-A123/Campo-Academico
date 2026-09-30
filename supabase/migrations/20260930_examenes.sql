create table if not exists public.examenes (
 id uuid primary key default gen_random_uuid(),
 usuario_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
 curso_id text,
 asignatura text,
 titulo text not null check (length(trim(titulo)) between 1 and 200),
 descripcion text not null default '',
 fecha timestamptz not null,
 creado_en timestamptz not null default now()
);
alter table public.examenes enable row level security;
revoke all on public.examenes from anon;
grant select, insert on public.examenes to authenticated;
drop policy if exists examenes_propios_lectura on public.examenes;
create policy examenes_propios_lectura on public.examenes for select to authenticated using (usuario_id = (select auth.uid()));
drop policy if exists examenes_propios_creacion on public.examenes;
create policy examenes_propios_creacion on public.examenes for insert to authenticated with check (usuario_id = (select auth.uid()));
create index if not exists examenes_usuario_fecha on public.examenes(usuario_id,fecha);

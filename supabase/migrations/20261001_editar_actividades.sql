-- Ejecutar en el SQL Editor de Supabase. Solo Fabrizio edita las actividades compartidas.
begin;
grant update (titulo, tipo) on public.actividades to authenticated;
alter table public.actividades enable row level security;
drop policy if exists campus_admin_edicion on public.actividades;
create policy campus_admin_edicion on public.actividades for update to authenticated
using ((select auth.uid()) = '04758a53-3645-4fc1-b51e-e0cb02c76978'::uuid)
with check ((select auth.uid()) = '04758a53-3645-4fc1-b51e-e0cb02c76978'::uuid);
commit;

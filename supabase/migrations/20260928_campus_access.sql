-- Ejecutar en SQL Editor si todos los usuarios registrados deben ver el mismo campus.
-- Retira la lectura anónima de estas tablas; mantiene las escrituras existentes.
begin;
revoke select on public.cursos, public.secciones, public.actividades from anon;
alter table public.cursos enable row level security;
alter table public.secciones enable row level security;
alter table public.actividades enable row level security;
grant select on public.cursos, public.secciones, public.actividades to authenticated;
drop policy if exists campus_lectura_autenticada on public.cursos;
create policy campus_lectura_autenticada on public.cursos for select to authenticated using (true);
drop policy if exists campus_lectura_autenticada on public.secciones;
create policy campus_lectura_autenticada on public.secciones for select to authenticated using (true);
drop policy if exists campus_lectura_autenticada on public.actividades;
create policy campus_lectura_autenticada on public.actividades for select to authenticated using (true);
-- La función de acceso necesita leer el vínculo usuario -> UID únicamente en el servidor.
grant select on public.credenciales to service_role;
commit;

-- Ejecutar una vez en el SQL Editor de Supabase.
-- Exámenes: cada usuario solo puede modificar o eliminar los suyos.
-- Moodle: solo el UID de Fabrizio indicado abajo puede borrar datos compartidos.
begin;
grant update, delete on public.examenes to authenticated;
drop policy if exists examenes_propios_edicion on public.examenes;
create policy examenes_propios_edicion on public.examenes for update to authenticated
using (usuario_id = (select auth.uid())) with check (usuario_id = (select auth.uid()));
drop policy if exists examenes_propios_eliminacion on public.examenes;
create policy examenes_propios_eliminacion on public.examenes for delete to authenticated
using (usuario_id = (select auth.uid()));

grant delete on public.cursos, public.secciones, public.actividades to authenticated;
alter table public.cursos enable row level security;
alter table public.secciones enable row level security;
alter table public.actividades enable row level security;
drop policy if exists campus_admin_eliminacion on public.cursos;
create policy campus_admin_eliminacion on public.cursos for delete to authenticated
using ((select auth.uid()) = '04758a53-3645-4fc1-b51e-e0cb02c76978'::uuid);
drop policy if exists campus_admin_eliminacion on public.secciones;
create policy campus_admin_eliminacion on public.secciones for delete to authenticated
using ((select auth.uid()) = '04758a53-3645-4fc1-b51e-e0cb02c76978'::uuid);
drop policy if exists campus_admin_eliminacion on public.actividades;
create policy campus_admin_eliminacion on public.actividades for delete to authenticated
using ((select auth.uid()) = '04758a53-3645-4fc1-b51e-e0cb02c76978'::uuid);

-- Borrado del curso y sus contenidos en una sola transacción.
create or replace function public.campus_eliminar_curso(curso text)
returns boolean language plpgsql security invoker set search_path = '' as $$
declare borrados integer;
begin
 if auth.uid() is distinct from '04758a53-3645-4fc1-b51e-e0cb02c76978'::uuid then
  raise exception 'No autorizado';
 end if;
 delete from public.actividades where seccion_id in
 (select id from public.secciones where curso_id::text = curso);
 delete from public.secciones where curso_id::text = curso;
 delete from public.cursos where id::text = curso;
 get diagnostics borrados = row_count;
 if borrados = 0 then raise exception 'Curso no disponible o sin permiso'; end if;
 return true;
end;
$$;
revoke all on function public.campus_eliminar_curso(text) from public, anon;
grant execute on function public.campus_eliminar_curso(text) to authenticated;
commit;

-- Campus: preferencias y cola de mensajes para el proyecto Python.
-- Ejecuta este archivo completo una vez en SQL Editor.
begin;
create table if not exists public.ia_preferencias (
 usuario_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
 modelo text not null default 'chatgpt' check (modelo in ('chatgpt','gemini')),
 modo text not null default 'fast' check (modo in ('fast','avanzado')),
 dragon boolean not null default false,
 valor integer not null default 50 check (valor between 0 and 100),
 x integer check (x between 0 and 10000),
 y integer check (y between 0 and 10000),
 ancho integer check (ancho between 300 and 10000),
 alto integer check (alto between 280 and 10000),
 actualizado_en timestamptz not null default now()
);
alter table public.ia_preferencias add column if not exists x integer check (x between 0 and 10000);
alter table public.ia_preferencias add column if not exists modo text not null default 'fast' check (modo in ('fast','avanzado'));
alter table public.ia_preferencias add column if not exists dragon boolean not null default false;
alter table public.ia_mensajes add column if not exists dragon boolean not null default false;
alter table public.ia_preferencias add column if not exists y integer check (y between 0 and 10000);
alter table public.ia_preferencias add column if not exists ancho integer check (ancho between 300 and 10000);
alter table public.ia_preferencias add column if not exists alto integer check (alto between 280 and 10000);
create table if not exists public.ia_mensajes (
 id uuid primary key default gen_random_uuid(),
 usuario_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
 modelo text not null check (modelo in ('chatgpt','gemini')),
 dragon boolean not null default false,
 valor integer not null default 50 check (valor between 0 and 100),
 prompt text not null check (length(trim(prompt)) between 1 and 20000),
 respuesta text,
 estado text not null default 'pendiente' check (estado in ('pendiente','procesando','completado','error')),
 error text,
 creado_en timestamptz not null default now(),
 iniciado_en timestamptz,
 terminado_en timestamptz,
 token_trabajo uuid,
 check (estado <> 'completado' or (respuesta is not null and length(trim(respuesta)) > 0))
);
create index if not exists ia_mensajes_usuario_fecha on public.ia_mensajes(usuario_id,creado_en desc);
create index if not exists ia_mensajes_pendientes on public.ia_mensajes(creado_en) where estado='pendiente';
alter table public.ia_preferencias enable row level security;
alter table public.ia_mensajes enable row level security;
revoke all on public.ia_preferencias,public.ia_mensajes from anon,authenticated;
grant select,insert,update on public.ia_preferencias to authenticated;
grant select on public.ia_mensajes to authenticated;
grant insert (id,usuario_id,modelo,dragon,valor,prompt) on public.ia_mensajes to authenticated;
grant delete on public.ia_mensajes to authenticated;
grant all on public.ia_preferencias,public.ia_mensajes to service_role;
drop policy if exists ia_preferencias_leer on public.ia_preferencias;
create policy ia_preferencias_leer on public.ia_preferencias for select to authenticated using (usuario_id=(select auth.uid()));
drop policy if exists ia_preferencias_crear on public.ia_preferencias;
create policy ia_preferencias_crear on public.ia_preferencias for insert to authenticated with check (usuario_id=(select auth.uid()));
drop policy if exists ia_preferencias_editar on public.ia_preferencias;
create policy ia_preferencias_editar on public.ia_preferencias for update to authenticated using (usuario_id=(select auth.uid())) with check (usuario_id=(select auth.uid()));
drop policy if exists ia_mensajes_leer on public.ia_mensajes;
create policy ia_mensajes_leer on public.ia_mensajes for select to authenticated using (usuario_id=(select auth.uid()));
drop policy if exists ia_mensajes_crear on public.ia_mensajes;
create policy ia_mensajes_crear on public.ia_mensajes for insert to authenticated with check (usuario_id=(select auth.uid()) and estado='pendiente' and respuesta is null and error is null and token_trabajo is null);
drop policy if exists ia_mensajes_borrar on public.ia_mensajes;
create policy ia_mensajes_borrar on public.ia_mensajes for delete to authenticated using (usuario_id=(select auth.uid()));
create or replace function public.ia_actualizar_fecha() returns trigger language plpgsql set search_path='' as $$
begin new.actualizado_en=now();return new;end;
$$;
drop trigger if exists ia_preferencias_fecha on public.ia_preferencias;
create trigger ia_preferencias_fecha before update on public.ia_preferencias for each row execute function public.ia_actualizar_fecha();
-- Python reclama exactamente un mensaje, incluso si hay varios procesos.
create or replace function public.ia_tomar_siguiente(p_modelo text default null)
returns setof public.ia_mensajes language sql security invoker set search_path='' as $$
 update public.ia_mensajes set estado='procesando',iniciado_en=now(),token_trabajo=gen_random_uuid()
 where id=(select id from public.ia_mensajes where estado='pendiente' and (p_modelo is null or modelo=p_modelo) order by creado_en,id for update skip locked limit 1)
 returning *;
$$;
create or replace function public.ia_finalizar(p_id uuid,p_token uuid,p_respuesta text default null,p_error text default null)
returns boolean language plpgsql security invoker set search_path='' as $$
declare cantidad integer;
begin
 if nullif(trim(p_error),'') is null and nullif(trim(p_respuesta),'') is null then raise exception 'La respuesta no puede estar vacía';end if;
 update public.ia_mensajes set respuesta=case when nullif(trim(p_error),'') is null then p_respuesta else null end,
 error=nullif(trim(p_error),''),estado=case when nullif(trim(p_error),'') is null then 'completado' else 'error' end,terminado_en=now()
 where id=p_id and token_trabajo=p_token and estado='procesando';
 get diagnostics cantidad=row_count;return cantidad=1;
end;
$$;
revoke all on function public.ia_tomar_siguiente(text) from public,anon,authenticated;
revoke all on function public.ia_finalizar(uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.ia_tomar_siguiente(text) to service_role;
grant execute on function public.ia_finalizar(uuid,uuid,text,text) to service_role;
commit;

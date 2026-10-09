-- Los mensajes escritos desde la web quedan pendientes para el worker local.
drop policy if exists emergency_messages_create on public.emergency_messages;
create policy emergency_messages_create
on public.emergency_messages
for insert
to authenticated
with check (
  enviado_por = (select auth.uid())
  and direccion = 'salida'
  and enviado = false
  and length(trim(mensaje)) > 0
);

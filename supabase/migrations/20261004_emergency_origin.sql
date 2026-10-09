alter table public.emergency_chats
  add column if not exists origen text not null default 'alerta'
  check (origen in ('fijado','alerta'));

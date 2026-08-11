-- Durable, server-resolved context for NRS Desk conversations.
-- Additive only. Applying this migration to live Supabase requires the owner
-- confirmation recorded in the NRS Desk release plan.

alter table public.conversations
  add column if not exists metadata jsonb not null default '{}'::jsonb;

alter table public.messages
  add column if not exists client_turn_id uuid;

create unique index if not exists idx_messages_conversation_client_turn_role
  on public.messages (conversation_id, client_turn_id, role)
  where client_turn_id is not null;

comment on column public.conversations.metadata is
  'Versioned channel context. NRS Desk stores exact media and typed result references under desk_context.';

comment on column public.messages.client_turn_id is
  'Browser-generated idempotency key shared by one user/assistant turn pair.';

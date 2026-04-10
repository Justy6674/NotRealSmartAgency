-- Phase 9 of the Mixpost UI port — Account Entities
-- Per-account custom hashtags / mentions / variables that get injected
-- into every post published from that specific social account.
--
-- Example: Justin's TeleScribe Instagram account always includes
-- #HealthTech + "made in Australia" — stored here rather than
-- re-typed into every draft.
--
-- Sync direction is NRS-native. For now the `account_id` is a free
-- string referencing Mixpost's account id (see
-- `fetchMixpostAccounts()` in src/lib/mixpost/client.ts). When Phase 10
-- migrates publishing to direct platform APIs, account_id will
-- reference `social_oauth_tokens.id` instead — the type stays `text`
-- so both worlds work.

create table if not exists account_entities (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references brands(id) on delete cascade,
  account_id text not null,
  account_name text,
  platform text,
  -- Entity types: 'hashtag' | 'mention' | 'variable'
  -- hashtag  → value is a single hashtag (without the # prefix)
  -- mention  → value is a handle/id to inject (e.g. '@brand')
  -- variable → value is a default value for a named template variable
  entity_type text not null check (entity_type in ('hashtag','mention','variable')),
  name text,   -- variable name when entity_type = 'variable', nullable for hashtag/mention
  value text not null,
  position integer default 0,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

create index account_entities_brand_account_idx
  on account_entities(brand_id, account_id);

alter table account_entities enable row level security;

create policy "team members read account entities" on account_entities
  for select using (can_access_brand(brand_id));

create policy "team members write account entities" on account_entities
  for all
  using (can_write_for_owner(brand_id))
  with check (can_write_for_owner(brand_id));

create trigger account_entities_updated_at
  before update on account_entities
  for each row execute function update_updated_at();

comment on table account_entities is
  'Per-account hashtags/mentions/variables injected into every post from that social account. '
  'Used by the Accounts management UI shipped in Phase 9 of the Mixpost UI port.';

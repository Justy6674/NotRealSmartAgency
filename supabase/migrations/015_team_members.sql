-- 015: Team Members & Invitation System
-- Adds multi-user access: invite team members with per-brand or all-brand access
-- Replaces all single-user RLS policies with team-aware versions

-- Enable pgcrypto for gen_random_bytes (invite tokens)
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- =============================================================================
-- 1. Enums
-- =============================================================================

DO $$ BEGIN CREATE TYPE team_role AS ENUM ('owner', 'admin', 'viewer'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE invite_status AS ENUM ('pending', 'accepted', 'revoked'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- =============================================================================
-- 2. team_members table
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  member_email TEXT NOT NULL,
  member_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  role team_role NOT NULL DEFAULT 'viewer',
  brand_ids UUID[] DEFAULT NULL,  -- NULL = all brands, otherwise specific brand UUIDs
  invite_token TEXT UNIQUE DEFAULT encode(extensions.gen_random_bytes(32), 'hex'),
  status invite_status NOT NULL DEFAULT 'pending',
  invited_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(owner_id, member_email)
);

CREATE INDEX idx_team_members_owner ON team_members(owner_id);
CREATE INDEX idx_team_members_member ON team_members(member_id);
CREATE INDEX idx_team_members_email ON team_members(member_email);
CREATE INDEX idx_team_members_token ON team_members(invite_token);

CREATE TRIGGER team_members_updated_at
  BEFORE UPDATE ON team_members
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- 3. Helper functions (SECURITY DEFINER — bypass RLS for subqueries)
-- =============================================================================

-- Check if current user is the owner OR an accepted team member of that owner
CREATE OR REPLACE FUNCTION public.is_owner_or_team_member(p_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN (
    auth.uid() = p_user_id
    OR EXISTS (
      SELECT 1 FROM public.team_members tm
      WHERE tm.owner_id = p_user_id
        AND tm.member_id = auth.uid()
        AND tm.status = 'accepted'
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Same as above but excludes viewer role (for write operations)
CREATE OR REPLACE FUNCTION public.can_write_for_owner(p_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN (
    auth.uid() = p_user_id
    OR EXISTS (
      SELECT 1 FROM public.team_members tm
      WHERE tm.owner_id = p_user_id
        AND tm.member_id = auth.uid()
        AND tm.status = 'accepted'
        AND tm.role IN ('owner', 'admin')
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Check if current user can access a specific brand (owner or team member with brand access)
CREATE OR REPLACE FUNCTION public.can_access_brand(p_brand_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.brands b
    WHERE b.id = p_brand_id
    AND (
      b.user_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.team_members tm
        WHERE tm.owner_id = b.user_id
          AND tm.member_id = auth.uid()
          AND tm.status = 'accepted'
          AND (tm.brand_ids IS NULL OR p_brand_id = ANY(tm.brand_ids))
      )
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- =============================================================================
-- 4. RLS on team_members itself
-- =============================================================================

CREATE POLICY "team_owners_select" ON team_members FOR SELECT USING (auth.uid() = owner_id);
CREATE POLICY "team_members_see_own" ON team_members FOR SELECT USING (auth.uid() = member_id);
CREATE POLICY "team_owners_insert" ON team_members FOR INSERT WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "team_owners_update" ON team_members FOR UPDATE USING (auth.uid() = owner_id);
CREATE POLICY "team_owners_delete" ON team_members FOR DELETE USING (auth.uid() = owner_id);
CREATE POLICY "service_team_members" ON team_members FOR ALL USING (auth.role() = 'service_role');

-- =============================================================================
-- 5. Replace ALL existing RLS policies with team-aware versions
-- =============================================================================

-- ── users ────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "users_select_own" ON users;
CREATE POLICY "users_select" ON users FOR SELECT
  USING (auth.uid() = id OR EXISTS (
    SELECT 1 FROM team_members tm WHERE tm.owner_id = id AND tm.member_id = auth.uid() AND tm.status = 'accepted'
  ));
-- INSERT/UPDATE stay owner-only (unchanged names so no drop needed — they check auth.uid() = id)

-- ── brands ───────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "brands_select_own" ON brands;
DROP POLICY IF EXISTS "brands_insert_own" ON brands;
DROP POLICY IF EXISTS "brands_update_own" ON brands;
DROP POLICY IF EXISTS "brands_delete_own" ON brands;

CREATE POLICY "brands_select" ON brands FOR SELECT USING (is_owner_or_team_member(user_id));
CREATE POLICY "brands_insert" ON brands FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "brands_update" ON brands FOR UPDATE USING (can_write_for_owner(user_id));
CREATE POLICY "brands_delete" ON brands FOR DELETE USING (auth.uid() = user_id);

-- ── conversations ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "conversations_select_own" ON conversations;
DROP POLICY IF EXISTS "conversations_insert_own" ON conversations;
DROP POLICY IF EXISTS "conversations_update_own" ON conversations;

CREATE POLICY "conversations_select" ON conversations FOR SELECT USING (is_owner_or_team_member(user_id));
CREATE POLICY "conversations_insert" ON conversations FOR INSERT WITH CHECK (can_write_for_owner(user_id));
CREATE POLICY "conversations_update" ON conversations FOR UPDATE USING (can_write_for_owner(user_id));

-- ── messages (via conversation join) ─────────────────────────────────────────
DROP POLICY IF EXISTS "messages_select_own" ON messages;
DROP POLICY IF EXISTS "messages_insert_own" ON messages;

CREATE POLICY "messages_select" ON messages FOR SELECT
  USING (EXISTS (SELECT 1 FROM conversations c WHERE c.id = conversation_id AND is_owner_or_team_member(c.user_id)));
CREATE POLICY "messages_insert" ON messages FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM conversations c WHERE c.id = conversation_id AND can_write_for_owner(c.user_id)));

-- ── outputs ──────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "outputs_select_own" ON outputs;
DROP POLICY IF EXISTS "outputs_insert_own" ON outputs;
DROP POLICY IF EXISTS "outputs_update_own" ON outputs;
DROP POLICY IF EXISTS "outputs_delete_own" ON outputs;

CREATE POLICY "outputs_select" ON outputs FOR SELECT USING (is_owner_or_team_member(user_id));
CREATE POLICY "outputs_insert" ON outputs FOR INSERT WITH CHECK (can_write_for_owner(user_id));
CREATE POLICY "outputs_update" ON outputs FOR UPDATE USING (can_write_for_owner(user_id));
CREATE POLICY "outputs_delete" ON outputs FOR DELETE USING (can_write_for_owner(user_id));

-- ── agent_registry ───────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Users manage own agents" ON agent_registry;

CREATE POLICY "agent_registry_select" ON agent_registry FOR SELECT USING (is_owner_or_team_member(user_id));
CREATE POLICY "agent_registry_insert" ON agent_registry FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "agent_registry_update" ON agent_registry FOR UPDATE USING (can_write_for_owner(user_id));
CREATE POLICY "agent_registry_delete" ON agent_registry FOR DELETE USING (auth.uid() = user_id);

-- ── goals ────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Users manage own goals" ON goals;

CREATE POLICY "goals_select" ON goals FOR SELECT USING (is_owner_or_team_member(user_id));
CREATE POLICY "goals_insert" ON goals FOR INSERT WITH CHECK (can_write_for_owner(user_id));
CREATE POLICY "goals_update" ON goals FOR UPDATE USING (can_write_for_owner(user_id));
CREATE POLICY "goals_delete" ON goals FOR DELETE USING (can_write_for_owner(user_id));

-- ── tasks ────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Users manage own tasks" ON tasks;

CREATE POLICY "tasks_select" ON tasks FOR SELECT USING (is_owner_or_team_member(user_id));
CREATE POLICY "tasks_insert" ON tasks FOR INSERT WITH CHECK (can_write_for_owner(user_id));
CREATE POLICY "tasks_update" ON tasks FOR UPDATE USING (can_write_for_owner(user_id));
CREATE POLICY "tasks_delete" ON tasks FOR DELETE USING (can_write_for_owner(user_id));

-- ── audit_log (append-only: select + insert only) ───────────────────────────
DROP POLICY IF EXISTS "Users view own audit log" ON audit_log;
DROP POLICY IF EXISTS "Users insert own audit log" ON audit_log;

CREATE POLICY "audit_log_select" ON audit_log FOR SELECT USING (is_owner_or_team_member(user_id));
CREATE POLICY "audit_log_insert" ON audit_log FOR INSERT WITH CHECK (can_write_for_owner(user_id));

-- ── approval_queue ───────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Users manage own approvals" ON approval_queue;

CREATE POLICY "approval_queue_select" ON approval_queue FOR SELECT USING (is_owner_or_team_member(user_id));
CREATE POLICY "approval_queue_insert" ON approval_queue FOR INSERT WITH CHECK (can_write_for_owner(user_id));
CREATE POLICY "approval_queue_update" ON approval_queue FOR UPDATE USING (can_write_for_owner(user_id));
CREATE POLICY "approval_queue_delete" ON approval_queue FOR DELETE USING (auth.uid() = user_id);

-- ── heartbeats (select only for non-owners) ──────────────────────────────────
DROP POLICY IF EXISTS "Users view own heartbeats" ON heartbeats;

CREATE POLICY "heartbeats_select" ON heartbeats FOR SELECT USING (is_owner_or_team_member(user_id));

-- ── media_items ──────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Users can manage own media items" ON media_items;

CREATE POLICY "media_items_select" ON media_items FOR SELECT USING (is_owner_or_team_member(user_id));
CREATE POLICY "media_items_insert" ON media_items FOR INSERT WITH CHECK (can_write_for_owner(user_id));
CREATE POLICY "media_items_update" ON media_items FOR UPDATE USING (can_write_for_owner(user_id));
CREATE POLICY "media_items_delete" ON media_items FOR DELETE USING (can_write_for_owner(user_id));

-- ── scheduled_posts ──────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Users can manage own scheduled posts" ON scheduled_posts;

CREATE POLICY "scheduled_posts_select" ON scheduled_posts FOR SELECT USING (is_owner_or_team_member(user_id));
CREATE POLICY "scheduled_posts_insert" ON scheduled_posts FOR INSERT WITH CHECK (can_write_for_owner(user_id));
CREATE POLICY "scheduled_posts_update" ON scheduled_posts FOR UPDATE USING (can_write_for_owner(user_id));
CREATE POLICY "scheduled_posts_delete" ON scheduled_posts FOR DELETE USING (can_write_for_owner(user_id));

-- ── project_scans ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "project_scans_select_own" ON project_scans;
DROP POLICY IF EXISTS "project_scans_insert_own" ON project_scans;
DROP POLICY IF EXISTS "project_scans_update_own" ON project_scans;
DROP POLICY IF EXISTS "project_scans_delete_own" ON project_scans;

CREATE POLICY "project_scans_select" ON project_scans FOR SELECT USING (is_owner_or_team_member(user_id));
CREATE POLICY "project_scans_insert" ON project_scans FOR INSERT WITH CHECK (can_write_for_owner(user_id));
CREATE POLICY "project_scans_update" ON project_scans FOR UPDATE USING (can_write_for_owner(user_id));
CREATE POLICY "project_scans_delete" ON project_scans FOR DELETE USING (can_write_for_owner(user_id));

-- ── brand_proforma_sections (brand-scoped) ───────────────────────────────────
DROP POLICY IF EXISTS "Users manage own brand proformas" ON brand_proforma_sections;

CREATE POLICY "proforma_select" ON brand_proforma_sections FOR SELECT USING (can_access_brand(brand_id));
CREATE POLICY "proforma_insert" ON brand_proforma_sections FOR INSERT WITH CHECK (can_access_brand(brand_id));
CREATE POLICY "proforma_update" ON brand_proforma_sections FOR UPDATE USING (can_access_brand(brand_id));
CREATE POLICY "proforma_delete" ON brand_proforma_sections FOR DELETE USING (can_access_brand(brand_id));

-- ── brand_conversation_log (brand-scoped) ────────────────────────────────────
DROP POLICY IF EXISTS "Users manage own conversation logs" ON brand_conversation_log;

CREATE POLICY "convo_log_select" ON brand_conversation_log FOR SELECT USING (can_access_brand(brand_id));
CREATE POLICY "convo_log_insert" ON brand_conversation_log FOR INSERT WITH CHECK (can_access_brand(brand_id));
CREATE POLICY "convo_log_update" ON brand_conversation_log FOR UPDATE USING (can_access_brand(brand_id));
CREATE POLICY "convo_log_delete" ON brand_conversation_log FOR DELETE USING (can_access_brand(brand_id));

-- =============================================================================
-- 6. Update handle_new_user() to auto-accept pending invites
-- =============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, full_name, profession_type)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', ''),
    COALESCE((NEW.raw_user_meta_data ->> 'profession_type')::profession_type, 'other')
  );

  -- Auto-accept any pending team invitations for this email
  UPDATE public.team_members
  SET member_id = NEW.id,
      status = 'accepted',
      accepted_at = now(),
      invite_token = NULL
  WHERE member_email = lower(NEW.email)
    AND status = 'pending';

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- 7. Seed Bec as admin with all-brand access
-- =============================================================================

INSERT INTO public.team_members (owner_id, member_email, role, brand_ids, status)
SELECT id, 'bec@downscale.com.au', 'admin', NULL, 'pending'
FROM public.users
WHERE email = 'downscale@icloud.com'
ON CONFLICT (owner_id, member_email) DO NOTHING;

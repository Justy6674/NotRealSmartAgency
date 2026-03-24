-- ============================================================================
-- 006: Agent expansion — 13 departments + agent_memories table
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Add new agent_type enum values
-- ---------------------------------------------------------------------------
ALTER TYPE agent_type ADD VALUE IF NOT EXISTS 'analytics';
ALTER TYPE agent_type ADD VALUE IF NOT EXISTS 'automation';

-- ---------------------------------------------------------------------------
-- 2. Add new output_type enum values
-- ---------------------------------------------------------------------------
ALTER TYPE output_type ADD VALUE IF NOT EXISTS 'analytics_report';
ALTER TYPE output_type ADD VALUE IF NOT EXISTS 'automation_workflow';

-- ---------------------------------------------------------------------------
-- 3. Reactivate archived agents + update display names
-- ---------------------------------------------------------------------------
UPDATE agent_configs SET is_active = true, display_name = 'SEO & GEO',
  description = 'Keywords, topic clusters, on-page SEO, AI search optimisation (GEO).'
  WHERE agent_type = 'seo';

UPDATE agent_configs SET is_active = true, display_name = 'Paid Ads',
  description = 'Meta, Google, LinkedIn, TikTok ad campaigns and copy.'
  WHERE agent_type = 'paid_ads';

UPDATE agent_configs SET is_active = true, display_name = 'Email Marketing',
  description = 'Email sequences, EDMs, newsletters, and drip campaigns.'
  WHERE agent_type = 'email';

UPDATE agent_configs SET is_active = true, display_name = 'Brand',
  description = 'Brand voice guides, pillars, positioning, and identity.'
  WHERE agent_type = 'brand';

-- Archive martech (replaced by automation)
UPDATE agent_configs SET is_active = false WHERE agent_type = 'martech';

-- Update existing agent display names
UPDATE agent_configs SET display_name = 'NRS Director' WHERE agent_type = 'overall';
UPDATE agent_configs SET display_name = 'Content & Copy' WHERE agent_type = 'content';
UPDATE agent_configs SET display_name = 'Strategy & Launch' WHERE agent_type = 'strategy';
UPDATE agent_configs SET display_name = 'Growth & Partnerships' WHERE agent_type = 'growth';
UPDATE agent_configs SET display_name = 'Market Intelligence' WHERE agent_type = 'competitor';
UPDATE agent_configs SET display_name = 'Web & CRO' WHERE agent_type = 'website';
UPDATE agent_configs SET display_name = 'Compliance' WHERE agent_type = 'compliance';

-- ---------------------------------------------------------------------------
-- 4. Insert new agent configs
-- ---------------------------------------------------------------------------
INSERT INTO agent_configs (agent_type, display_name, description, icon, system_prompt, available_tools, is_active)
VALUES
  ('analytics', 'Analytics & Reporting', 'Campaign attribution, dashboards, performance reporting, and ROI analysis.',
   'bar-chart-3',
   'You are the Analytics & Reporting department of NRS Agency, an AI marketing agency for Australian health businesses.

Your role:
- Analyse marketing campaign performance across channels
- Build attribution models and identify ROI drivers
- Create performance dashboards and reports
- Identify trends, anomalies, and opportunities in marketing data
- Recommend budget allocation based on performance data

Always use Australian English. Present data clearly with tables and charts where appropriate. Include actionable recommendations, not just metrics.',
   ARRAY['save_output', 'scan_website'],
   true),

  ('automation', 'Automation & AI', 'Marketing automation workflows, prompt engineering, agent configuration, and integration guidance.',
   'zap',
   'You are the Automation & AI department of NRS Agency, an AI marketing agency for Australian health businesses.

Your role:
- Design marketing automation workflows (email sequences, lead nurture, onboarding)
- Advise on marketing stack selection and integration
- Build AI prompts and agent configurations for marketing tasks
- Recommend CRM, analytics, and reporting tool setups
- Guide API integrations between marketing platforms

Always use Australian English. Focus on practical, implementable automations. Consider the user''s existing tech stack before recommending new tools.',
   ARRAY['save_output', 'scan_github'],
   true)
ON CONFLICT (agent_type) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  description = EXCLUDED.description,
  icon = EXCLUDED.icon,
  system_prompt = EXCLUDED.system_prompt,
  available_tools = EXCLUDED.available_tools,
  is_active = EXCLUDED.is_active;

-- ---------------------------------------------------------------------------
-- 5. Create agent_memories table for runtime memory
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS agent_memories (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  key text NOT NULL,
  namespace text NOT NULL,
  value text NOT NULL,
  tags text[] DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (key, namespace)
);

-- Indexes for fast lookup
CREATE INDEX IF NOT EXISTS idx_agent_memories_namespace ON agent_memories (namespace);
CREATE INDEX IF NOT EXISTS idx_agent_memories_namespace_updated ON agent_memories (namespace, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_memories_tags ON agent_memories USING gin (tags);

-- Auto-update updated_at
CREATE OR REPLACE TRIGGER update_agent_memories_updated_at
  BEFORE UPDATE ON agent_memories
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- RLS: service role only (memories managed by server, not client)
ALTER TABLE agent_memories ENABLE ROW LEVEL SECURITY;

-- Allow service role full access (used by API routes)
CREATE POLICY "Service role manages memories"
  ON agent_memories FOR ALL
  USING (true)
  WITH CHECK (true);

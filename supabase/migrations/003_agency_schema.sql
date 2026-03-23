-- Agency platform schema: brands, conversations, messages, outputs, agent configs

-- New ENUM types
CREATE TYPE agent_type AS ENUM (
  'content', 'seo', 'paid_ads', 'strategy', 'email',
  'growth', 'brand', 'competitor', 'website', 'compliance'
);

CREATE TYPE output_type AS ENUM (
  'social_post', 'blog_article', 'ad_copy', 'email_sequence',
  'landing_page', 'seo_audit', 'strategy_doc', 'competitor_report',
  'compliance_check', 'brand_guide', 'other'
);

-- Brands
CREATE TABLE public.brands (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  tagline TEXT,
  description TEXT,
  website_url TEXT,
  niche TEXT NOT NULL,
  tone_of_voice JSONB DEFAULT '{}',
  target_audience JSONB DEFAULT '{}',
  competitors JSONB DEFAULT '[]',
  compliance_flags JSONB DEFAULT '{"ahpra": false, "tga": false, "tga_categories": []}',
  brand_colours JSONB DEFAULT '{}',
  content_pillars TEXT[] DEFAULT '{}',
  extra_context TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Conversations (per brand, per agent)
CREATE TABLE public.conversations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  brand_id UUID REFERENCES public.brands(id) ON DELETE CASCADE NOT NULL,
  agent_type agent_type NOT NULL,
  title TEXT,
  is_archived BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Messages
CREATE TABLE public.messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID REFERENCES public.conversations(id) ON DELETE CASCADE NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system', 'tool')),
  content TEXT NOT NULL,
  tool_calls JSONB,
  tool_results JSONB,
  tokens_input INT DEFAULT 0,
  tokens_output INT DEFAULT 0,
  model TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Saved outputs (deliverables)
CREATE TABLE public.outputs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  brand_id UUID REFERENCES public.brands(id) ON DELETE CASCADE NOT NULL,
  conversation_id UUID REFERENCES public.conversations(id) ON DELETE SET NULL,
  message_id UUID REFERENCES public.messages(id) ON DELETE SET NULL,
  output_type output_type NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  is_approved BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Agent configs (seeded, drives agent behaviour)
CREATE TABLE public.agent_configs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_type agent_type UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  description TEXT NOT NULL,
  icon TEXT NOT NULL,
  system_prompt TEXT NOT NULL,
  available_tools TEXT[] DEFAULT '{}',
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_brands_user ON public.brands(user_id);
CREATE INDEX idx_brands_slug ON public.brands(slug);
CREATE INDEX idx_conversations_brand ON public.conversations(brand_id, agent_type);
CREATE INDEX idx_conversations_user ON public.conversations(user_id, updated_at DESC);
CREATE INDEX idx_messages_conversation ON public.messages(conversation_id, created_at);
CREATE INDEX idx_outputs_brand ON public.outputs(brand_id, output_type);
CREATE INDEX idx_outputs_user ON public.outputs(user_id, created_at DESC);

-- Updated_at triggers (reuse existing function)
CREATE TRIGGER brands_updated BEFORE UPDATE ON public.brands FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER conversations_updated BEFORE UPDATE ON public.conversations FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER outputs_updated BEFORE UPDATE ON public.outputs FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER agent_configs_updated BEFORE UPDATE ON public.agent_configs FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- RLS
ALTER TABLE public.brands ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.outputs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_configs ENABLE ROW LEVEL SECURITY;

-- Agent configs: public read
CREATE POLICY "agent_configs_public_read" ON public.agent_configs FOR SELECT USING (is_active = TRUE);

-- Brands: own rows
CREATE POLICY "brands_select_own" ON public.brands FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "brands_insert_own" ON public.brands FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "brands_update_own" ON public.brands FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "brands_delete_own" ON public.brands FOR DELETE USING (auth.uid() = user_id);

-- Conversations: own rows
CREATE POLICY "conversations_select_own" ON public.conversations FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "conversations_insert_own" ON public.conversations FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "conversations_update_own" ON public.conversations FOR UPDATE USING (auth.uid() = user_id);

-- Messages: own via conversation join
CREATE POLICY "messages_select_own" ON public.messages FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.conversations c WHERE c.id = conversation_id AND c.user_id = auth.uid()));
CREATE POLICY "messages_insert_own" ON public.messages FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.conversations c WHERE c.id = conversation_id AND c.user_id = auth.uid()));

-- Outputs: own rows
CREATE POLICY "outputs_select_own" ON public.outputs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "outputs_insert_own" ON public.outputs FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "outputs_update_own" ON public.outputs FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "outputs_delete_own" ON public.outputs FOR DELETE USING (auth.uid() = user_id);

-- Service role bypass for all new tables
CREATE POLICY "service_brands" ON public.brands FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "service_conversations" ON public.conversations FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "service_messages" ON public.messages FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "service_outputs" ON public.outputs FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "service_agent_configs" ON public.agent_configs FOR ALL USING (auth.role() = 'service_role');

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ENUM types
CREATE TYPE profession_type AS ENUM (
  'gp', 'nurse_practitioner', 'allied_health', 'specialist',
  'telehealth', 'aesthetics', 'cannabis', 'mental_health',
  'weight_loss', 'practice_manager', 'other'
);

CREATE TYPE subscription_tier AS ENUM ('free', 'starter', 'professional', 'practice');
CREATE TYPE subscription_status AS ENUM ('active', 'cancelled', 'past_due', 'trialing', 'incomplete');
CREATE TYPE phase_status AS ENUM ('not_started', 'in_progress', 'completed', 'skipped');
CREATE TYPE scan_type AS ENUM ('website', 'social_media', 'google_business');
CREATE TYPE integration_provider AS ENUM ('halaxy', 'xero', 'stripe', 'google_analytics');

-- Users (extends auth.users)
CREATE TABLE public.users (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT,
  profession_type profession_type NOT NULL DEFAULT 'other',
  clinic_name TEXT,
  clinic_url TEXT,
  state TEXT,
  subscription_tier subscription_tier NOT NULL DEFAULT 'free',
  subscription_status subscription_status DEFAULT 'active',
  stripe_customer_id TEXT UNIQUE,
  stripe_subscription_id TEXT UNIQUE,
  current_phase INT DEFAULT 1 CHECK (current_phase >= 1 AND current_phase <= 24),
  onboarding_completed BOOLEAN DEFAULT FALSE,
  diagnostic_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 24 Lifecycle Phases
CREATE TABLE public.phases (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  number INT UNIQUE NOT NULL CHECK (number >= 1 AND number <= 24),
  slug TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  subtitle TEXT,
  description TEXT NOT NULL,
  category TEXT NOT NULL,
  icon TEXT,
  tier_required subscription_tier NOT NULL DEFAULT 'free',
  content JSONB DEFAULT '{}',
  sort_order INT NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- User progress per phase
CREATE TABLE public.user_phases (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  phase_id UUID REFERENCES public.phases(id) ON DELETE CASCADE NOT NULL,
  status phase_status DEFAULT 'not_started',
  score INT CHECK (score >= 0 AND score <= 100),
  checklist_data JSONB DEFAULT '{}',
  notes TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, phase_id)
);

-- Tool library
CREATE TABLE public.tools (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  category TEXT NOT NULL,
  description TEXT,
  website_url TEXT,
  pricing_model TEXT,
  price_from TEXT,
  price_to TEXT,
  has_free_tier BOOLEAN DEFAULT FALSE,
  australian_data_residency BOOLEAN,
  bulk_billing BOOLEAN,
  integrations TEXT[] DEFAULT '{}',
  profession_types profession_type[] DEFAULT '{}',
  phase_numbers INT[] DEFAULT '{}',
  pros JSONB DEFAULT '[]',
  cons JSONB DEFAULT '[]',
  best_for TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Regulations reference (version-controlled)
CREATE TABLE public.regulations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  authority TEXT NOT NULL,
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  full_text TEXT,
  source_url TEXT,
  effective_date DATE,
  supersedes_id UUID REFERENCES public.regulations(id),
  profession_types profession_type[] DEFAULT '{}',
  phase_numbers INT[] DEFAULT '{}',
  severity TEXT DEFAULT 'info',
  is_current BOOLEAN DEFAULT TRUE,
  last_verified_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Diagnostic results
CREATE TABLE public.diagnostics (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  session_id TEXT NOT NULL,
  email TEXT,
  profession_type profession_type NOT NULL,
  clinic_url TEXT,
  responses JSONB NOT NULL DEFAULT '{}',
  website_scan JSONB DEFAULT '{}',
  phase_scores JSONB DEFAULT '{}',
  overall_score INT CHECK (overall_score >= 0 AND overall_score <= 100),
  recommended_phase INT,
  gap_report JSONB DEFAULT '{}',
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Compliance scans
CREATE TABLE public.compliance_scans (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  url TEXT NOT NULL,
  scan_type scan_type NOT NULL DEFAULT 'website',
  raw_text TEXT,
  results JSONB NOT NULL DEFAULT '{}',
  score INT CHECK (score >= 0 AND score <= 100),
  issues_found INT DEFAULT 0,
  issues_resolved INT DEFAULT 0,
  ai_model TEXT,
  tokens_used INT,
  scanned_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- User API integrations
CREATE TABLE public.user_integrations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  provider integration_provider NOT NULL,
  encrypted_credentials BYTEA,
  access_token_expires_at TIMESTAMPTZ,
  last_sync_at TIMESTAMPTZ,
  sync_status TEXT DEFAULT 'never_synced',
  sync_error TEXT,
  cached_data JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, provider)
);

-- AI usage tracking
CREATE TABLE public.ai_usage (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  query_type TEXT NOT NULL,
  tokens_input INT NOT NULL DEFAULT 0,
  tokens_output INT NOT NULL DEFAULT 0,
  model TEXT NOT NULL,
  cost_usd DECIMAL(10,6) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_users_stripe ON public.users(stripe_customer_id);
CREATE INDEX idx_users_subscription ON public.users(subscription_tier, subscription_status);
CREATE INDEX idx_users_profession ON public.users(profession_type);
CREATE INDEX idx_user_phases_user ON public.user_phases(user_id);
CREATE INDEX idx_user_phases_status ON public.user_phases(user_id, status);
CREATE INDEX idx_tools_category ON public.tools(category);
CREATE INDEX idx_tools_profession ON public.tools USING GIN(profession_types);
CREATE INDEX idx_regulations_authority ON public.regulations(authority, is_current);
CREATE INDEX idx_regulations_phase ON public.regulations USING GIN(phase_numbers);
CREATE INDEX idx_diagnostics_session ON public.diagnostics(session_id);
CREATE INDEX idx_diagnostics_user ON public.diagnostics(user_id);
CREATE INDEX idx_compliance_scans_user ON public.compliance_scans(user_id);
CREATE INDEX idx_ai_usage_user_date ON public.ai_usage(user_id, created_at);
CREATE INDEX idx_user_integrations_user ON public.user_integrations(user_id, provider);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER users_updated BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER user_phases_updated BEFORE UPDATE ON public.user_phases FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER user_integrations_updated BEFORE UPDATE ON public.user_integrations FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Auto-create user profile on auth signup
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
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- RLS Policies
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.phases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_phases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tools ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.regulations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.diagnostics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.compliance_scans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_usage ENABLE ROW LEVEL SECURITY;

-- Public read: phases, tools, regulations
CREATE POLICY "phases_public_read" ON public.phases FOR SELECT USING (is_active = TRUE);
CREATE POLICY "tools_public_read" ON public.tools FOR SELECT USING (is_active = TRUE);
CREATE POLICY "regulations_public_read" ON public.regulations FOR SELECT USING (is_current = TRUE);

-- Users: own row
CREATE POLICY "users_select_own" ON public.users FOR SELECT USING (auth.uid() = id);
CREATE POLICY "users_update_own" ON public.users FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "users_insert_own" ON public.users FOR INSERT WITH CHECK (auth.uid() = id);

-- User phases: own rows
CREATE POLICY "user_phases_select" ON public.user_phases FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "user_phases_insert" ON public.user_phases FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "user_phases_update" ON public.user_phases FOR UPDATE USING (auth.uid() = user_id);

-- Diagnostics: own rows + anonymous insert
CREATE POLICY "diagnostics_select" ON public.diagnostics FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "diagnostics_insert" ON public.diagnostics FOR INSERT WITH CHECK (TRUE);
CREATE POLICY "diagnostics_update" ON public.diagnostics FOR UPDATE USING (auth.uid() = user_id);

-- Compliance scans: own rows
CREATE POLICY "scans_select" ON public.compliance_scans FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "scans_insert" ON public.compliance_scans FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Integrations: own rows
CREATE POLICY "integrations_select" ON public.user_integrations FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "integrations_insert" ON public.user_integrations FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "integrations_update" ON public.user_integrations FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "integrations_delete" ON public.user_integrations FOR DELETE USING (auth.uid() = user_id);

-- AI usage: own rows
CREATE POLICY "ai_usage_select" ON public.ai_usage FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "ai_usage_insert" ON public.ai_usage FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Service role bypass
CREATE POLICY "service_users" ON public.users FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "service_user_phases" ON public.user_phases FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "service_diagnostics" ON public.diagnostics FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "service_integrations" ON public.user_integrations FOR ALL USING (auth.role() = 'service_role');

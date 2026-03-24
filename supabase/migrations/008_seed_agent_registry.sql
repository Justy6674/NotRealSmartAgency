-- ============================================================================
-- 008: Seed agent_registry for founder user
-- 1 Director + 12 Department Heads
-- ============================================================================

-- Insert Director first (no reports_to)
INSERT INTO public.agent_registry (user_id, agent_type, role, department, reports_to, model, status, is_active, budget_monthly_cents)
VALUES (
  '9a8dad4d-87c8-44ea-9070-67f1cdbda507',
  'overall', 'director', 'Executive', NULL,
  'anthropic/claude-sonnet-4', 'idle', true, 10000
)
ON CONFLICT (user_id, agent_type) DO NOTHING;

-- Get the Director's ID for reports_to
DO $$
DECLARE
  director_id uuid;
  founder_id uuid := '9a8dad4d-87c8-44ea-9070-67f1cdbda507';
BEGIN
  SELECT id INTO director_id FROM public.agent_registry
    WHERE user_id = founder_id AND agent_type = 'overall';

  -- Insert 12 Department Heads
  INSERT INTO public.agent_registry (user_id, agent_type, role, department, reports_to, model, status, is_active, budget_monthly_cents)
  VALUES
    (founder_id, 'content',    'head', 'Content & Copy',         director_id, 'anthropic/claude-sonnet-4', 'idle', true, 5000),
    (founder_id, 'seo',        'head', 'SEO & GEO',              director_id, 'anthropic/claude-sonnet-4', 'idle', true, 5000),
    (founder_id, 'paid_ads',   'head', 'Paid Ads',               director_id, 'anthropic/claude-sonnet-4', 'idle', true, 5000),
    (founder_id, 'strategy',   'head', 'Strategy & Launch',      director_id, 'anthropic/claude-sonnet-4', 'idle', true, 5000),
    (founder_id, 'email',      'head', 'Email Marketing',        director_id, 'anthropic/claude-sonnet-4', 'idle', true, 5000),
    (founder_id, 'growth',     'head', 'Growth & Partnerships',  director_id, 'anthropic/claude-sonnet-4', 'idle', true, 5000),
    (founder_id, 'brand',      'head', 'Brand',                  director_id, 'anthropic/claude-sonnet-4', 'idle', true, 5000),
    (founder_id, 'competitor', 'head', 'Market Intelligence',    director_id, 'anthropic/claude-sonnet-4', 'idle', true, 5000),
    (founder_id, 'website',    'head', 'Web & CRO',              director_id, 'anthropic/claude-sonnet-4', 'idle', true, 5000),
    (founder_id, 'compliance', 'head', 'Compliance',             director_id, 'anthropic/claude-sonnet-4', 'idle', true, 5000),
    (founder_id, 'analytics',  'head', 'Analytics & Reporting',  director_id, 'anthropic/claude-sonnet-4', 'idle', true, 5000),
    (founder_id, 'automation', 'head', 'Automation & AI',        director_id, 'anthropic/claude-sonnet-4', 'idle', true, 5000)
  ON CONFLICT (user_id, agent_type) DO NOTHING;
END $$;

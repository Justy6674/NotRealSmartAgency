import type { AgentType } from '@/types/database'

export type MarketingSkillId =
  | 'product-marketing'
  | 'brand-context'
  | 'seo-audit'
  | 'ai-seo'
  | 'schema'
  | 'site-architecture'
  | 'cro'
  | 'analytics'
  | 'competitor-intel'
  | 'social'
  | 'marketing-loops'

interface SkillRule {
  id: MarketingSkillId
  pattern: RegExp
  owner: AgentType
  reason: string
  evidence: string
}

const SKILL_RULES: SkillRule[] = [
  { id: 'brand-context', pattern: /\b(brand context|brand voice|positioning|audience|persona|proof point|brand brief)\b/i, owner: 'brand', reason: 'Keep one maintained source of truth for the brand.', evidence: 'Read the active brand proforma and saved brand context before asking repeat questions.' },
  { id: 'seo-audit', pattern: /\b(seo audit|technical seo|crawl|index|ranking|core web vitals|page speed|search console|sitemap|robots)\b/i, owner: 'seo', reason: 'Audit crawlability, indexation, technical foundations, then content.', evidence: 'Use scan_website/browse_page and report observed evidence, not guessed metrics.' },
  { id: 'ai-seo', pattern: /\b(ai search|ai seo|geo|aeo|llmo|llms\.txt|ai overview|perplexity|chatgpt search|citation|generative engine)\b/i, owner: 'seo', reason: 'Make useful content extractable and citable by answer engines.', evidence: 'Pair normal people-first SEO with structured answer blocks, source citations, and machine-readable public resources.' },
  { id: 'schema', pattern: /\b(schema|structured data|json-ld|rich result|breadcrumbs)\b/i, owner: 'seo', reason: 'Use valid schema that describes the visible page.', evidence: 'Inspect rendered JSON-LD and keep schema truthful, canonical, and page-specific.' },
  { id: 'site-architecture', pattern: /\b(site architecture|url structure|information architecture|navigation|internal links|sitemap|robots)\b/i, owner: 'website', reason: 'Make the public site easy to crawl and understand.', evidence: 'Check canonical routes, internal links, sitemap coverage, robots rules, and orphan pages.' },
  { id: 'cro', pattern: /\b(cro|conversion|landing page|signup|onboarding|activation|funnel)\b/i, owner: 'website', reason: 'Improve the path from intent to the next meaningful action.', evidence: 'Use real user paths and visible states; do not optimise from invented conversion numbers.' },
  { id: 'analytics', pattern: /\b(analytics|metrics|measurement|ga4|gtm|attribution|roi|performance report)\b/i, owner: 'analytics', reason: 'Tie marketing work to observable outcomes.', evidence: 'Query the authoritative connected source and show raw numbers with date range and uncertainty.' },
  { id: 'competitor-intel', pattern: /\b(competitor|competitive|benchmark|market research|serp competitors|battle card)\b/i, owner: 'competitor', reason: 'Use evidence-backed market and competitor comparisons.', evidence: 'Browse the named sources and label unverified gaps instead of filling them from memory.' },
  { id: 'social', pattern: /\b(instagram|facebook|linkedin|tiktok|youtube|social post|reel|carousel|organic social)\b/i, owner: 'content', reason: 'Adapt content to the platform and approval state.', evidence: 'Draft through NRS, keep publishing behind approval, and use the connected NRS publisher/tool surface.' },
  { id: 'marketing-loops', pattern: /\b(loop|recurring|weekly|daily|always-on|autopilot|monitor|heartbeat|schedule)\b/i, owner: 'strategy', reason: 'Define a bounded recurring workflow rather than a vague automation.', evidence: 'Every loop needs cadence, trigger, self-check, idempotent state, stop condition, output, and an approval gate for publish/spend.' },
]

export interface MarketingSkillSelection {
  id: MarketingSkillId
  owner: AgentType
  reason: string
}

export function selectMarketingSkills(message: string): MarketingSkillSelection[] {
  const selected: MarketingSkillSelection[] = SKILL_RULES
    .filter((rule) => rule.pattern.test(message))
    .map(({ id, owner, reason }) => ({ id, owner, reason }))

  const foundation: MarketingSkillSelection = { id: 'product-marketing', owner: 'strategy', reason: 'Start from the brand, audience, goal, and proof before choosing tactics.' }
  return [
    foundation,
    ...selected,
  ].filter((skill, index, all) => all.findIndex((candidate) => candidate.id === skill.id) === index)
}

/**
 * Adapted from the public Corey Haines and HyperFX skill frameworks. This is
 * intentionally a compact NRS policy layer: the NRS Director remains the
 * orchestrator, and all execution stays on NRS tools over web, MCP, or Telegram.
 */
export function buildMarketingSkillContext(message: string, channel: 'web' | 'mcp' | 'telegram' = 'web'): string {
  const skills = selectMarketingSkills(message)
  const lines = [
    '## ADAPTED MARKETING SKILL ROUTING',
    `Channel: **${channel}**. The NRS Director remains the only orchestrator.`,
    'Use NRS project-scoped tools and departments; do not call a separate Hyper MCP, invent provider data, or make the caller orchestrate steps.',
    'For Telegram and MCP responses, return clean text and a concrete result or next action. Keep drafts staged; publishing, sending, spending, and external writes require the existing NRS approval gate.',
    `Selected skill patterns: ${skills.map((skill) => `**${skill.id}**`).join(', ')}`,
  ]

  for (const skill of skills) {
    const rule = skill.id === 'product-marketing'
      ? null
      : SKILL_RULES.find((candidate) => candidate.id === skill.id)
    lines.push(`- ${skill.id} → ${skill.reason}${rule ? ` Evidence: ${rule.evidence}` : ''}`)
  }

  return lines.join('\n')
}

import { AGENT_LABELS } from '@/types/database'
import type { AgentType } from '@/types/database'

/**
 * Intent classification — analyses user message and determines
 * which department(s) should handle it. Returns routing hints that
 * get injected into the Director's context.
 *
 * This is rule-based (fast, free) with LLM fallback for ambiguous cases.
 */

interface RoutingResult {
  suggestedAgent: AgentType
  confidence: 'high' | 'medium' | 'low'
  reason: string
  shouldScanUrl: string | null
  shouldDelegate: boolean
}

export interface MultiRoutingResult {
  departments: { agent: AgentType; reason: string }[]
  shouldConvene: boolean // true if 2+ departments matched
  shouldScanUrl: string | null
}

// URL detection
const URL_REGEX = /https?:\/\/[^\s<>"{}|\\^`\[\]]+/gi

// Keyword patterns → department mapping
const INTENT_PATTERNS: { pattern: RegExp; agent: AgentType; reason: string }[] = [
  // Website/URL analysis
  { pattern: /\b(look at|check|scan|review|audit|analyse|analyze)\b.*\b(website|site|page|url|landing)\b/i, agent: 'website', reason: 'Website analysis requested' },
  { pattern: /\b(website|site|page|landing|homepage|ux|conversion|cro)\b.*\b(copy|improve|fix|optimise|optimize|redesign)\b/i, agent: 'website', reason: 'Website improvement requested' },

  // Content creation
  { pattern: /\b(write|create|draft|produce|generate)\b.*\b(content|post|blog|article|caption|copy|script)\b/i, agent: 'content', reason: 'Content creation requested' },
  { pattern: /\b(instagram|tiktok|linkedin|facebook|social media|social post|reel|story)\b/i, agent: 'content', reason: 'Social media content requested' },

  // SEO
  { pattern: /\b(seo|keyword|search engine|organic|ranking|serp|backlink|topic cluster|on-page)\b/i, agent: 'seo', reason: 'SEO work requested' },
  { pattern: /\b(geo|generative engine|ai search|perplexity|chatgpt search)\b/i, agent: 'seo', reason: 'GEO/AI search optimisation requested' },

  // Paid advertising
  { pattern: /\b(ad|ads|advertising|campaign|google ads|meta ads|facebook ads|tiktok ads|linkedin ads|ppc|cpc|cpm)\b/i, agent: 'paid_ads', reason: 'Paid advertising requested' },

  // Email
  { pattern: /\b(email|edm|newsletter|drip|sequence|nurture|welcome email|onboarding email)\b/i, agent: 'email', reason: 'Email marketing requested' },

  // Strategy
  { pattern: /\b(strategy|plan|campaign plan|gtm|go-to-market|launch|quarterly|roadmap|playbook)\b/i, agent: 'strategy', reason: 'Strategy work requested' },

  // Competitors
  { pattern: /\b(competitor|competition|swot|gap analysis|market research|what are .* doing|compare|benchmark)\b/i, agent: 'competitor', reason: 'Competitor analysis requested' },

  // Compliance
  { pattern: /\b(ahpra|tga|complian|compliance|regulated|advertising guidelines|testimonial|before.?after)\b/i, agent: 'compliance', reason: 'Compliance check requested' },

  // Brand
  { pattern: /\b(brand voice|brand guide|positioning|tone of voice|brand identity|brand pillar|tagline)\b/i, agent: 'brand', reason: 'Brand work requested' },

  // Growth
  { pattern: /\b(referral|partnership|pr\b|press release|media|growth hack|acquisition channel)\b/i, agent: 'growth', reason: 'Growth/partnerships requested' },

  // Analytics
  { pattern: /\b(analytics|reporting|dashboard|metrics|performance|attribution|roi|conversion rate)\b/i, agent: 'analytics', reason: 'Analytics/reporting requested' },

  // Automation
  { pattern: /\b(automat|workflow|zapier|make\.com|integration|api|webhook|prompt engineering)\b/i, agent: 'automation', reason: 'Automation work requested' },

  // Pricing
  { pattern: /\b(pric|pricing|subscription|billing|cost|revenue model|freemium|tier)\b/i, agent: 'strategy', reason: 'Pricing analysis requested' },
]

// ─── Compound patterns: common multi-department briefs ────────────────────────

const COMPOUND_PATTERNS: { pattern: RegExp; departments: AgentType[]; reason: string }[] = [
  {
    pattern: /\b(comprehensive|full|complete)\b.*\b(marketing audit|audit|review)\b/i,
    departments: ['competitor', 'seo', 'content', 'analytics', 'compliance'],
    reason: 'Comprehensive marketing audit — requires multiple department perspectives',
  },
  {
    pattern: /\b(launch|go-to-market|gtm)\b.*\b(plan|strategy|campaign)\b/i,
    departments: ['strategy', 'content', 'seo', 'paid_ads', 'email'],
    reason: 'Launch plan — requires coordinated strategy across channels',
  },
  {
    pattern: /\b(campaign)\b.*\b(plan|create|build|design)\b/i,
    departments: ['strategy', 'content', 'paid_ads', 'email'],
    reason: 'Campaign creation — requires multi-channel coordination',
  },
  {
    pattern: /\b(rebrand|brand refresh|brand overhaul)\b/i,
    departments: ['brand', 'content', 'website', 'compliance'],
    reason: 'Brand refresh — requires coordinated brand + content + web update',
  },
  {
    pattern: /\b(growth|scale|grow)\b.*\b(strategy|plan)\b/i,
    departments: ['strategy', 'growth', 'seo', 'paid_ads'],
    reason: 'Growth strategy — requires multi-channel planning',
  },
  {
    pattern: /\b(content strategy|content plan|content calendar)\b/i,
    departments: ['content', 'seo', 'email', 'brand'],
    reason: 'Content strategy — requires SEO alignment + brand voice + distribution',
  },
  {
    pattern: /\b(competitor|competitive)\b.*\b(analysis|audit|review|report)\b/i,
    departments: ['competitor', 'seo', 'analytics'],
    reason: 'Competitive analysis — requires market intel + SEO + data',
  },
]

// ─── Single-match classifier (backward compat) ───────────────────────────────

export function classifyIntent(message: string): RoutingResult {
  const urls = message.match(URL_REGEX)
  const firstUrl = urls?.[0] ?? null

  for (const { pattern, agent, reason } of INTENT_PATTERNS) {
    if (pattern.test(message)) {
      return {
        suggestedAgent: agent,
        confidence: 'high',
        reason,
        shouldScanUrl: firstUrl,
        shouldDelegate: true,
      }
    }
  }

  if (firstUrl) {
    return {
      suggestedAgent: 'website',
      confidence: 'medium',
      reason: 'URL detected — likely wants website analysis',
      shouldScanUrl: firstUrl,
      shouldDelegate: true,
    }
  }

  return {
    suggestedAgent: 'overall',
    confidence: 'low',
    reason: 'No clear department match — Director should assess',
    shouldScanUrl: null,
    shouldDelegate: false,
  }
}

// ─── Multi-match classifier (meeting detection) ──────────────────────────────

export function classifyIntentMulti(message: string): MultiRoutingResult {
  const urls = message.match(URL_REGEX)
  const firstUrl = urls?.[0] ?? null

  // Check compound patterns first (these are explicit meeting triggers)
  for (const { pattern, departments, reason } of COMPOUND_PATTERNS) {
    if (pattern.test(message)) {
      return {
        departments: departments.map(agent => ({ agent, reason })),
        shouldConvene: true,
        shouldScanUrl: firstUrl,
      }
    }
  }

  // Fall back to collecting all individual pattern matches
  const matched = new Map<AgentType, string>()
  for (const { pattern, agent, reason } of INTENT_PATTERNS) {
    if (pattern.test(message) && !matched.has(agent)) {
      matched.set(agent, reason)
    }
  }

  const departments = Array.from(matched.entries()).map(([agent, reason]) => ({ agent, reason }))

  return {
    departments,
    shouldConvene: departments.length >= 2,
    shouldScanUrl: firstUrl,
  }
}

// ─── Routing context builder ─────────────────────────────────────────────────

export function buildRoutingContext(routing: RoutingResult, multiRouting?: MultiRoutingResult): string {
  // Meeting mode — multiple departments needed
  if (multiRouting?.shouldConvene) {
    const deptNames = multiRouting.departments
      .map(d => AGENT_LABELS[d.agent] ?? d.agent)
      .join(', ')
    const deptTypes = multiRouting.departments
      .map(d => d.agent)
      .join(', ')

    const lines = [
      `\n## AUTO-ROUTING ADVISORY — MEETING REQUIRED`,
      `This request requires input from **multiple departments**.`,
      `Matched departments: **${deptNames}**`,
      `Reason: ${multiRouting.departments[0]?.reason ?? 'Multi-department brief detected'}`,
    ]

    if (multiRouting.shouldScanUrl) {
      lines.push(`\nURL detected: **${multiRouting.shouldScanUrl}** — include this URL in the meeting brief for departments to analyse.`)
    }

    lines.push(`\n**ACTION REQUIRED:** Use **convene_meeting** to chair a meeting with departments: [${deptTypes}].`)
    lines.push(`Write a clear, detailed brief for the meeting. After receiving department results, write a Director's Summary that synthesises key recommendations, highlights any conflicts, and provides a prioritised action plan.`)
    lines.push(`Do NOT attempt the specialist work yourself. Do NOT use delegate_to_agent for this — use convene_meeting.`)

    return lines.join('\n')
  }

  // Single department mode
  if (!routing.shouldDelegate) return ''

  const lines = [
    `\n## AUTO-ROUTING ADVISORY`,
    `Intent classified: **${routing.reason}**`,
    `Suggested department: **${routing.suggestedAgent}** (confidence: ${routing.confidence})`,
  ]

  if (routing.shouldScanUrl) {
    lines.push(`URL detected: **${routing.shouldScanUrl}** — SCAN THIS IMMEDIATELY using scan_website or browse_page before doing anything else.`)
  }

  lines.push(`\n**ACTION REQUIRED:** Use delegate_to_agent to send this work to the ${routing.suggestedAgent} department. Do NOT attempt to do the specialist work yourself. Briefly acknowledge the user's request, then delegate.`)

  return lines.join('\n')
}

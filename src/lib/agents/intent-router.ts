import type { AgentType } from '@/types/database'

/**
 * Intent classification — analyses user message and determines
 * which department should handle it. Returns routing hints that
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

export function classifyIntent(message: string): RoutingResult {
  // Extract URLs
  const urls = message.match(URL_REGEX)
  const firstUrl = urls?.[0] ?? null

  // Check patterns (first match wins — patterns ordered by specificity)
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

  // If message contains a URL but no clear intent, suggest website analysis
  if (firstUrl) {
    return {
      suggestedAgent: 'website',
      confidence: 'medium',
      reason: 'URL detected — likely wants website analysis',
      shouldScanUrl: firstUrl,
      shouldDelegate: true,
    }
  }

  // No clear match — let Director handle it
  return {
    suggestedAgent: 'overall',
    confidence: 'low',
    reason: 'No clear department match — Director should assess',
    shouldScanUrl: null,
    shouldDelegate: false,
  }
}

/**
 * Build routing context to inject into the Director's prompt.
 * This tells the Director what to do WITHOUT it having to figure it out.
 */
export function buildRoutingContext(routing: RoutingResult): string {
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

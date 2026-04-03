/**
 * Master Marketing Proforma — section definitions
 *
 * Each brand gets one row per section in `brand_proforma_sections`.
 * The Director (and all agents) read from this; only the Director writes.
 */

export const PROFORMA_SECTIONS = [
  { key: 'executive_snapshot', title: 'Executive Snapshot', cadence: 'weekly' },
  { key: 'client_profile', title: 'Client Profile', cadence: 'monthly' },
  { key: 'brand_fundamentals', title: 'Brand Fundamentals', cadence: 'monthly' },
  { key: 'audience', title: 'Audience Summary', cadence: 'monthly' },
  { key: 'market_context', title: 'Market Context', cadence: 'quarterly' },
  { key: 'compliance_profile', title: 'Compliance Profile', cadence: 'monthly' },
  { key: 'business_goals', title: 'Business Goals', cadence: 'monthly' },
  { key: 'funnel_map', title: 'Funnel Map', cadence: 'monthly' },
  { key: 'channel_website', title: 'Website', cadence: 'fortnightly' },
  { key: 'channel_seo', title: 'SEO', cadence: 'fortnightly' },
  { key: 'channel_social', title: 'Social Media', cadence: 'weekly' },
  { key: 'channel_paid', title: 'Paid Media', cadence: 'weekly' },
  { key: 'channel_email', title: 'Email & CRM', cadence: 'fortnightly' },
  { key: 'content_creative', title: 'Content & Creative', cadence: 'weekly' },
  { key: 'competitors', title: 'Competitor Intelligence', cadence: 'fortnightly' },
  { key: 'kpi_dashboard', title: 'KPI Dashboard', cadence: 'weekly' },
  { key: 'gaps_opportunities', title: 'Gaps & Opportunities', cadence: 'monthly' },
  { key: 'wins_losses', title: 'Wins, Losses & Learnings', cadence: 'weekly' },
  { key: 'risk_register', title: 'Risk Register', cadence: 'monthly' },
  { key: 'decision_log', title: 'Decision Log', cadence: 'weekly' },
  { key: 'thirty_sixty_ninety', title: '30/60/90 Day Plan', cadence: 'monthly' },
] as const

export type ProformaSectionKey = typeof PROFORMA_SECTIONS[number]['key']

export type ReviewCadence = 'weekly' | 'fortnightly' | 'monthly' | 'quarterly'

/** Number of days before a section is considered stale */
export const CADENCE_DAYS: Record<ReviewCadence, number> = {
  weekly: 7,
  fortnightly: 14,
  monthly: 30,
  quarterly: 90,
}

/** All valid section keys as an array (for Zod enums) */
export const PROFORMA_SECTION_KEYS = PROFORMA_SECTIONS.map(s => s.key) as unknown as [ProformaSectionKey, ...ProformaSectionKey[]]

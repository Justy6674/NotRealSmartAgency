/**
 * convene_meeting — Spawn multiple independent agent workers in parallel.
 *
 * Each department is a genuinely separate agent with its own model, memory,
 * tools, and budget. All run simultaneously via Promise.allSettled().
 * Results are collected and returned to the Director for synthesis.
 */

import { tool } from 'ai'
import { z } from 'zod/v3'
import type { Brand } from '@/types/database'
import type { SupabaseClient } from '@supabase/supabase-js'
import { AGENT_LABELS, type AgentType } from '@/types/database'
import { runParallelAgents, type WorkerContext } from '@/lib/agents/worker'
import { logAudit } from '@/lib/agents/audit'

// ─── Per-department meeting briefs ───────────────────────────────────────────

const DEPARTMENT_MEETING_BRIEFS: Record<string, string> = {
  competitor: `As Market Intelligence, produce a DEEP competitive analysis:
- Name every known competitor, their pricing, market position, and recent changes
- Identify gaps in the market that this brand can exploit
- Analyse competitor messaging, positioning, and unique selling points
- Provide a detailed SWOT analysis with evidence
- Recommend specific competitive positioning strategies
- Include market size estimates and growth trends where possible
This should be a COMPLETE intelligence report, not a summary.`,

  seo: `As SEO & GEO, produce a COMPLETE search strategy document:
- Audit current search visibility (if website exists) or define the search strategy from scratch
- Identify target keywords with search volume estimates (head terms + long-tail)
- Define topic cluster strategy with pillar pages and supporting content
- GEO strategy: how to get cited by ChatGPT, Perplexity, and Google AI Overviews
- Local SEO requirements (Google Business Profile, directory listings, schema markup)
- Technical SEO checklist (meta descriptions, structured data, page speed, mobile)
- Content calendar recommendations (what to publish, how often, which formats)
This should be an actionable SEO playbook, not a list of suggestions.`,

  content: `As Content & Copy, produce a FULL content strategy:
- Define the brand voice with specific examples of how to write for this brand
- Create 3-5 sample content pieces (social posts, blog outlines, ad copy) ready to publish
- Content pillar strategy with 10+ topic ideas per pillar
- Platform-specific content recommendations (what works on each channel)
- Content repurposing strategy (one piece to multiple formats)
- Calls-to-action that are compliant with AHPRA/TGA where applicable
- Publishing cadence and content calendar framework
This should include ACTUAL COPY the brand can use, not just recommendations.`,

  analytics: `As Analytics & Reporting, define the COMPLETE measurement framework:
- KPI definitions with specific targets for the first 90 days
- Analytics stack recommendations (GA4, Hotjar, custom dashboards)
- Conversion funnel design with expected benchmarks per stage
- Attribution model recommendations for multi-channel marketing
- Reporting cadence and template structure
- Competitor benchmarking metrics to track
- Budget tracking and ROAS calculation methodology
This should be a measurement playbook that can be implemented immediately.`,

  compliance: `As Compliance, produce a THOROUGH regulatory audit:
- Specific AHPRA advertising requirements for this brand's profession type
- TGA requirements for any therapeutic goods or services advertised
- Platform-specific compliance risks (Google Ads, Meta, TikTok, LinkedIn)
- Review of any existing marketing materials for compliance issues
- Safe language guide specific to this brand's services
- Mandatory disclaimers and disclosures required
- Risk register with severity ratings and mitigation strategies
This should be a compliance manual, not a checklist.`,

  strategy: `As Strategy & Launch, produce a COMPREHENSIVE go-to-market plan:
- Market entry strategy with phased rollout timeline
- Pricing strategy analysis with competitive positioning
- Channel strategy with budget allocation recommendations
- Partnership and distribution opportunities
- Launch campaign framework (pre-launch, launch, post-launch)
- Growth levers and scaling strategy for months 1-6
- Risk mitigation plan for launch
This should be a full GTM document a team can execute against.`,

  paid_ads: `As Paid Ads, produce a DETAILED advertising strategy:
- Platform selection with justification (Google, Meta, TikTok, LinkedIn, Reddit)
- Budget allocation across platforms with expected ROAS
- Campaign structure (campaigns, ad groups, targeting)
- Ad copy recommendations with compliance considerations
- Landing page requirements for each campaign
- A/B testing framework and optimisation schedule
- Audience targeting strategy (first-party, lookalike, interest-based)
This should be a campaign blueprint ready for setup.`,

  email: `As Email Marketing, produce a COMPLETE email strategy:
- Welcome/onboarding sequence (5-7 emails with subject lines and key content)
- Nurture sequence for leads who don't convert immediately
- Retention/engagement sequence for existing users
- Re-engagement sequence for lapsed users
- Newsletter strategy with content themes and frequency
- Email automation triggers and workflows
- Subject line formulas and A/B testing plan
- Compliance (Australian Spam Act, unsubscribe, ABN)
This should include ACTUAL email outlines, not just recommendations.`,

  growth: `As Growth & Partnerships, produce a DETAILED growth strategy:
- Partnership opportunities (who to partner with, what the deal looks like)
- Referral program design (incentives, mechanics, compliance)
- Community building strategy (forums, social groups, events)
- PR and media opportunities (publications, podcasts, speaking)
- Influencer/KOL strategy (who, how, what it costs)
- Distribution channel analysis (direct, indirect, marketplace)
This should be an actionable growth playbook with specific targets.`,

  brand: `As Brand, produce a COMPLETE brand strategy document:
- Brand positioning statement with rationale
- Value proposition framework (for different audience segments)
- Brand personality and tone of voice guide with examples
- Visual identity recommendations (if not already established)
- Brand messaging hierarchy (tagline, elevator pitch, long description)
- Differentiation strategy vs competitors
This should be a brand bible section, not bullet points.`,

  website: `As Web & CRO, produce a DETAILED website strategy:
- Site structure and information architecture recommendations
- Key page templates needed (homepage, features, pricing, about, blog)
- Conversion optimisation recommendations per page
- UX best practices for this industry
- Mobile experience priorities
- Page speed and Core Web Vitals targets
- Social proof and trust signal placement strategy
This should be a website brief a developer can build from.`,

  video: `As Video & Scripting, produce PLATFORM-SPECIFIC video scripts:
- Scene-by-scene script breakdowns (Scene / Visual / Audio / CTA)
- Variants for: Instagram Reels (9:16, 60s), TikTok (9:16, 15-60s), YouTube Shorts (9:16, 60s), LinkedIn (1:1, 30-120s)
- Hook MUST appear in first 3 seconds
- Reference brand video preferences (avatar, accent, presenter style, background)
- Include presenter direction: tone, pace, gestures, eye contact
- For AHPRA/TGA brands: NO therapeutic claims, NO before/after, NO testimonials
- Include CTA placement guidance
This should include READY-TO-FILM scripts with every line of dialogue written out.`,

  automation: `As Automation & AI, produce a COMPLETE automation strategy:
- Marketing automation workflows (lead scoring, nurture triggers, alerts)
- AI integration opportunities (chatbots, content generation, personalisation)
- Tech stack recommendations for marketing operations
- Data integration requirements between systems
- Reporting automation and dashboard design
- Workflow diagrams for key processes
This should be a technical automation blueprint.`,
}


interface MeetingContext {
  supabase: SupabaseClient
  userId: string
  brandId: string
  brand: Brand
  conversationId: string | null
}

const DEPARTMENT_TYPES = [
  'content', 'seo', 'paid_ads', 'strategy', 'email', 'growth',
  'brand', 'competitor', 'website', 'compliance', 'analytics', 'automation', 'video',
] as const

export function createConveneMeetingTool(ctx: MeetingContext) {
  const workerCtx: WorkerContext = {
    supabase: ctx.supabase,
    userId: ctx.userId,
    brandId: ctx.brandId,
    brand: ctx.brand,
    conversationId: ctx.conversationId,
  }

  return tool({
    description:
      'Convene a meeting with multiple department heads. Each department runs as an INDEPENDENT agent with its own model, memory, and tools — all executing in PARALLEL. Use when a request requires deep specialist input from 2+ departments. After receiving results, synthesise them into a cohesive response.',
    inputSchema: z.object({
      brief: z.string().describe('Clear meeting brief — what should all departments address'),
      departments: z.array(z.enum(DEPARTMENT_TYPES)).min(2).max(6)
        .describe('Which departments to include in the meeting'),
    }),
    execute: async ({ brief, departments }) => {
      console.log(`[meeting] Convening ${departments.length} independent agents: ${departments.join(', ')} — "${brief.slice(0, 80)}"`)

      // Spawn all department workers in parallel — each is genuinely independent
      const { results, errors, totalCostCents, totalTokens, totalDurationMs } = await runParallelAgents(
        departments.map(dept => ({
          agentType: dept,
          task: brief,
          options: {
            withWebSearch: true,
            meetingDepartments: departments,
            departmentBrief: DEPARTMENT_MEETING_BRIEFS[dept] ?? '',
            timeoutMs: 180000,
          },
        })),
        workerCtx,
      )

      // Audit the meeting as a whole
      await logAudit({
        supabase: ctx.supabase,
        userId: ctx.userId,
        action: 'meeting_completed',
        entityType: 'meeting',
        detail: {
          brief: brief.slice(0, 200),
          departments,
          departmentsCompleted: results.length,
          departmentsFailed: errors.length,
          totalTokens,
          totalCostCents,
          totalDurationMs,
          models: results.map(r => `${r.department}:${r.model}`),
        },
        costCents: totalCostCents,
      })

      return {
        type: 'meeting',
        brief,
        departments: results.map(r => ({
          department: r.department,
          name: r.departmentName,
          result: r.result,
          model: r.model,
          costCents: r.costCents,
          durationMs: r.durationMs,
        })),
        errors: errors.length > 0 ? errors.map(e => ({ department: e.department, error: e.error })) : undefined,
        totalCostCents,
        totalTokens,
        totalDurationMs,
      }
    },
  })
}

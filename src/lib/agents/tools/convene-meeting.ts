import { tool, generateText } from 'ai'
import { gateway } from '@ai-sdk/gateway'
import { z } from 'zod/v3'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { AgentType, Brand, AgentConfig } from '@/types/database'
import { AGENT_LABELS } from '@/types/database'
import { buildSystemPromptWithMemory } from '@/lib/agents/prompt-builder'
import { getToolsForAgent } from './index'
import { logAudit } from '@/lib/agents/audit'
import { getOrCreateAgentRegistry, recordAgentSpend } from '@/lib/agents/registry'

// ─── Per-department meeting briefs ───────────────────────────────────────────
// Each department gets a tailored brief so they know exactly what deep analysis to produce

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
- Content repurposing strategy (one piece → multiple formats)
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
- Upcoming regulatory changes that could affect this brand
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
- Compliance requirements (Australian Spam Act, unsubscribe, ABN)
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
  'brand', 'competitor', 'website', 'compliance', 'analytics', 'automation',
] as const

const outputTypeMap: Record<string, string> = {
  content: 'social_post', seo: 'seo_audit', paid_ads: 'ad_copy',
  strategy: 'strategy_doc', email: 'email_sequence', growth: 'strategy_doc',
  brand: 'brand_guide', competitor: 'competitor_report', website: 'landing_page',
  compliance: 'compliance_check', analytics: 'analytics_report', automation: 'automation_workflow',
}

async function runDepartment(
  dept: string,
  brief: string,
  allDepartments: string[],
  ctx: MeetingContext
): Promise<{
  department: string
  result: string
  costCents: number
  tokensUsed: number
  error?: string
}> {
  try {
    // Fetch agent config
    const { data: agentConfig } = await ctx.supabase
      .from('agent_configs')
      .select('*')
      .eq('agent_type', dept)
      .single()

    if (!agentConfig) {
      return { department: dept, result: '', costCents: 0, tokensUsed: 0, error: `Department ${dept} not found` }
    }

    // Get registry for budget
    const registry = await getOrCreateAgentRegistry(ctx.supabase, ctx.userId, dept as AgentType)

    // Build system prompt with meeting context
    const { prompt: basePrompt } = await buildSystemPromptWithMemory(
      ctx.brand,
      agentConfig as AgentConfig,
      brief
    )

    const otherDepts = allDepartments
      .filter(d => d !== dept)
      .map(d => AGENT_LABELS[d as AgentType] ?? d)
      .join(', ')

    // Get department-specific brief or use generic
    const deptBrief = DEPARTMENT_MEETING_BRIEFS[dept] ?? ''

    const meetingPrompt = `${basePrompt}

---

## MEETING CONTEXT

You are in a **department meeting** chaired by the NRS Director.
Other departments in this meeting: ${otherDepts}

Your role: provide your **deep specialist expertise** as the ${AGENT_LABELS[dept as AgentType] ?? dept} department head.

${deptBrief}

## OUTPUT REQUIREMENTS — READ CAREFULLY

You are producing a **FULL EXPERT DOCUMENT**, not a summary. This is a formal department contribution to a cross-functional meeting. Your output will be reviewed by the founder and potentially shared with the team.

Rules:
- **DEPTH over breadth** — go deep on YOUR area, don't try to cover everything
- **SPECIFICS over generics** — use actual numbers, real platform names, concrete examples
- **ACTIONABLE over advisory** — every recommendation must say WHO does WHAT by WHEN
- **EVIDENCE-BASED** — cite the marketing intelligence you have (platform CPCs, regulations, benchmarks)
- **INCLUDE ACTUAL DELIVERABLES** where possible — sample copy, campaign structures, keyword lists, email outlines
- Minimum 800 words. If you can write 1500+, do it.
- Write in Australian English, publish-ready quality
- Flag any risks, compliance concerns, or dependencies on other departments

The meeting brief from the Director is below. Respond with your FULL department contribution.`

    // Get department tools
    const departmentTools = getToolsForAgent(dept as AgentType, {
      supabase: ctx.supabase,
      userId: ctx.userId,
      brandId: ctx.brandId,
      conversationId: ctx.conversationId,
    })

    // Gateway options
    const isHealthBrand = ctx.brand.compliance_flags?.ahpra || ctx.brand.compliance_flags?.tga
    const gatewayOptions = {
      gateway: {
        models: ['openai/gpt-4.1', 'google/gemini-2.5-flash'] as string[],
        user: ctx.userId,
        tags: [dept, ctx.brand.slug, 'meeting'],
        ...(isHealthBrand && { zeroDataRetention: true }),
      },
    }

    // Give meeting departments web search capability
    const meetingTools = {
      ...departmentTools,
      web_search: gateway.tools.perplexitySearch({
        maxResults: 5,
        searchLanguageFilter: ['en'],
        searchRecencyFilter: 'month',
      }),
    }

    // Run with 180s timeout (doubled for deep analysis)
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 180000)

    const result = await generateText({
      model: gateway(registry?.model || 'anthropic/claude-sonnet-4'),
      system: meetingPrompt,
      prompt: brief,
      tools: meetingTools,
      providerOptions: gatewayOptions,
      abortSignal: controller.signal,
    })
    clearTimeout(timeout)

    // Cost
    const inputTokens = result.usage?.inputTokens ?? 0
    const outputTokens = result.usage?.outputTokens ?? 0
    const costCents = Math.round((inputTokens * 0.3 + outputTokens * 1.5) / 100)

    // Record spend
    if (registry) {
      await recordAgentSpend(ctx.supabase, registry.id, costCents)
    }

    // Auto-save to output library
    void ctx.supabase.from('outputs').insert({
      user_id: ctx.userId,
      brand_id: ctx.brandId,
      conversation_id: ctx.conversationId,
      output_type: outputTypeMap[dept] ?? 'other',
      title: `[Meeting] ${AGENT_LABELS[dept as AgentType]}: ${brief.slice(0, 60)}`,
      content: result.text,
      metadata: { source: 'meeting', department: dept, tokensUsed: inputTokens + outputTokens, costCents },
    })

    // Audit log
    await logAudit({
      supabase: ctx.supabase,
      userId: ctx.userId,
      agentId: registry?.id,
      action: 'meeting_contribution',
      entityType: 'agent',
      entityId: dept,
      detail: { brief: brief.slice(0, 200), inputTokens, outputTokens, costCents },
      costCents,
    })

    return {
      department: dept,
      result: result.text,
      costCents,
      tokensUsed: inputTokens + outputTokens,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error(`[meeting] ${dept} failed:`, message)
    return { department: dept, result: '', costCents: 0, tokensUsed: 0, error: message }
  }
}

export function createConveneMeetingTool(ctx: MeetingContext) {
  return tool({
    description:
      'Convene a meeting with multiple department heads. Use this when a request requires input from 2 or more specialist departments. Each department will produce their expert analysis in parallel. After receiving results, you (the Director) should write a synthesis summary.',
    inputSchema: z.object({
      brief: z.string().describe('Clear meeting brief — what should all departments address'),
      departments: z.array(z.enum(DEPARTMENT_TYPES)).min(2).max(6)
        .describe('Which departments to include in the meeting'),
    }),
    execute: async ({ brief, departments }) => {
      console.log(`[meeting] Convening: ${departments.join(', ')} — "${brief.slice(0, 80)}"`)

      // Run all departments in parallel
      const results = await Promise.allSettled(
        departments.map(dept => runDepartment(dept, brief, departments, ctx))
      )

      // Collect results
      const departmentResults: { department: string; result: string; costCents: number; tokensUsed: number }[] = []
      const errors: { department: string; error: string }[] = []

      for (const res of results) {
        if (res.status === 'fulfilled') {
          if (res.value.error) {
            errors.push({ department: res.value.department, error: res.value.error })
          } else {
            departmentResults.push(res.value)
          }
        } else {
          errors.push({ department: 'unknown', error: res.reason?.message ?? 'Unknown failure' })
        }
      }

      const totalCostCents = departmentResults.reduce((sum, r) => sum + r.costCents, 0)
      const totalTokens = departmentResults.reduce((sum, r) => sum + r.tokensUsed, 0)

      // Audit the meeting as a whole
      await logAudit({
        supabase: ctx.supabase,
        userId: ctx.userId,
        action: 'meeting_completed',
        entityType: 'meeting',
        detail: {
          brief: brief.slice(0, 200),
          departments,
          departmentsCompleted: departmentResults.length,
          departmentsFailed: errors.length,
          totalTokens,
          totalCostCents,
        },
        costCents: totalCostCents,
      })

      return {
        type: 'meeting',
        brief,
        departments: departmentResults.map(r => ({
          department: r.department,
          name: AGENT_LABELS[r.department as AgentType] ?? r.department,
          result: r.result,
          costCents: r.costCents,
        })),
        errors: errors.length > 0 ? errors : undefined,
        totalCostCents,
        totalTokens,
      }
    },
  })
}

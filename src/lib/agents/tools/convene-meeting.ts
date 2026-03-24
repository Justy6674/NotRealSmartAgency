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

    const meetingPrompt = `${basePrompt}

---

## MEETING CONTEXT

You are in a **department meeting** chaired by the NRS Director.
Other departments in this meeting: ${otherDepts}

Your role: provide your **specialist expertise** as the ${AGENT_LABELS[dept as AgentType] ?? dept} department head.

Rules for this meeting:
- Focus on YOUR area of expertise — do not duplicate what other departments will cover
- Be thorough — produce a complete, actionable document (not a summary or outline)
- Include specific recommendations with rationale
- Flag any risks, compliance concerns, or dependencies on other departments
- Write in Australian English, publish-ready quality`

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

    // Run with 90s timeout
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 90000)

    const result = await generateText({
      model: gateway(registry?.model || 'anthropic/claude-sonnet-4'),
      system: meetingPrompt,
      prompt: brief,
      tools: departmentTools,
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

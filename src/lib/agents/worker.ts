/**
 * AgentWorker — Independent agent execution unit.
 *
 * Each worker is a genuinely separate agent with:
 * - Its own model (from agent_registry)
 * - Its own memory context (retrieved independently per namespace)
 * - Its own tool set (assembled per agent type)
 * - Its own budget tracking
 * - Its own audit trail
 *
 * Workers run independently and in parallel via Promise.allSettled().
 * The Director orchestrates by spawning workers, not by prompt-switching.
 */

import { generateText } from 'ai'
import { gateway } from '@ai-sdk/gateway'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { AgentType, Brand, AgentConfig } from '@/types/database'
import { AGENT_LABELS, AGENT_SUBTITLES } from '@/types/database'
import { buildSystemPromptWithMemory } from './prompt-builder'
import { getToolsForAgent } from './tools'
import { logAudit } from './audit'
import { getOrCreateAgentRegistry, recordAgentSpend, checkBudget } from './registry'

// ─── Types ──────────────────────────────────────────────────────────────────

export interface WorkerContext {
  supabase: SupabaseClient
  userId: string
  brandId: string
  brand: Brand
  conversationId: string | null
}

export interface WorkerResult {
  department: string
  departmentName: string
  result: string
  costCents: number
  tokensUsed: number
  model: string
  durationMs: number
  error?: string
}

export interface WorkerOptions {
  /** Additional context injected into the system prompt */
  contextOverride?: string
  /** Timeout in milliseconds (default: 120000 for delegation, 180000 for meetings) */
  timeoutMs?: number
  /** Whether to add web search tool (default: false) */
  withWebSearch?: boolean
  /** Meeting context: other departments in the meeting */
  meetingDepartments?: string[]
  /** Department-specific brief to append */
  departmentBrief?: string
}

// ─── Output type mapping ────────────────────────────────────────────────────

const OUTPUT_TYPE_MAP: Record<string, string> = {
  content: 'social_post', seo: 'seo_audit', paid_ads: 'ad_copy',
  strategy: 'strategy_doc', email: 'email_sequence', growth: 'strategy_doc',
  brand: 'brand_guide', competitor: 'competitor_report', website: 'landing_page',
  compliance: 'compliance_check', analytics: 'analytics_report',
  automation: 'automation_workflow', video: 'video_script',
}

// ─── Core Worker ────────────────────────────────────────────────────────────

/**
 * Execute a single agent worker independently.
 *
 * Each call is a genuinely separate agent execution:
 * - Fetches its own config from agent_configs
 * - Gets its own registry entry (model, budget)
 * - Retrieves its own memories via buildSystemPromptWithMemory
 * - Assembles its own tool set
 * - Runs generateText with its own model
 * - Tracks its own budget and audit trail
 */
export async function runAgentWorker(
  agentType: string,
  task: string,
  ctx: WorkerContext,
  options: WorkerOptions = {},
): Promise<WorkerResult> {
  const startTime = Date.now()
  const dept = agentType
  const deptName = AGENT_LABELS[dept as AgentType] ?? dept

  try {
    // 1. Fetch THIS agent's config (its own identity)
    const { data: agentConfig } = await ctx.supabase
      .from('agent_configs')
      .select('*')
      .eq('agent_type', dept)
      .single()

    if (!agentConfig) {
      return {
        department: dept, departmentName: deptName, result: '',
        costCents: 0, tokensUsed: 0, model: 'none',
        durationMs: Date.now() - startTime, error: `Agent ${dept} not configured`,
      }
    }

    // 2. Get THIS agent's registry entry (its own model + budget)
    const registry = await getOrCreateAgentRegistry(ctx.supabase, ctx.userId, dept as AgentType)
    const model = registry?.model || 'anthropic/claude-sonnet-4'

    // 3. Check THIS agent's budget independently
    if (registry) {
      const budget = await checkBudget(ctx.supabase, registry.id)
      if (!budget.allowed) {
        return {
          department: dept, departmentName: deptName, result: '',
          costCents: 0, tokensUsed: 0, model,
          durationMs: Date.now() - startTime,
          error: `${deptName} has exhausted its monthly budget (${budget.spent}/${budget.limit} cents)`,
        }
      }
    }

    // 4. Build THIS agent's system prompt with ITS OWN memory retrieval
    //    buildSystemPromptWithMemory searches the agent's namespace independently
    const { prompt: basePrompt, memoryCount } = await buildSystemPromptWithMemory(
      ctx.brand,
      agentConfig as AgentConfig,
      task,
    )

    // 5. Build final prompt with any context overrides
    let systemPrompt = basePrompt
    if (options.contextOverride) {
      systemPrompt += '\n\n---\n\n' + options.contextOverride
    }
    if (options.meetingDepartments?.length) {
      const otherDepts = options.meetingDepartments
        .filter(d => d !== dept)
        .map(d => AGENT_LABELS[d as AgentType] ?? d)
        .join(', ')

      systemPrompt += `\n\n---\n\n## MEETING CONTEXT

You are in a **department meeting** chaired by the NRS Director.
Other departments in this meeting: ${otherDepts}

Your role: provide your **deep specialist expertise** as the ${AGENT_SUBTITLES[dept as AgentType] ?? deptName} department head.

${options.departmentBrief ?? ''}

## OUTPUT REQUIREMENTS — READ CAREFULLY

You are producing a **FULL EXPERT DOCUMENT**, not a summary. Your output will be reviewed by the founder.

Rules:
- **DEPTH over breadth** — go deep on YOUR area
- **SPECIFICS over generics** — use actual numbers, real platform names, concrete examples
- **ACTIONABLE over advisory** — every recommendation says WHO does WHAT by WHEN
- **EVIDENCE-BASED** — cite benchmarks, regulations, data
- **INCLUDE ACTUAL DELIVERABLES** — sample copy, campaign structures, keyword lists
- Minimum 800 words. If you can write 1500+, do it.
- Write in Australian English, publish-ready quality
- Flag risks, compliance concerns, or dependencies on other departments`
    }

    // 6. Assemble THIS agent's tools independently
    const departmentTools = getToolsForAgent(dept as AgentType, {
      supabase: ctx.supabase,
      userId: ctx.userId,
      brandId: ctx.brandId,
      conversationId: ctx.conversationId,
    })

    // Add web search if requested
    const tools = options.withWebSearch
      ? {
          ...departmentTools,
          web_search: gateway.tools.perplexitySearch({
            maxResults: 5,
            searchLanguageFilter: ['en'],
            searchRecencyFilter: 'month',
          }),
        }
      : departmentTools

    // 7. Gateway options — THIS agent's tags
    const isHealthBrand = ctx.brand.compliance_flags?.ahpra || ctx.brand.compliance_flags?.tga
    const gatewayOptions = {
      gateway: {
        models: ['openai/gpt-4.1', 'google/gemini-2.5-flash'] as string[],
        user: ctx.userId,
        tags: [dept, ctx.brand.slug, options.meetingDepartments ? 'meeting' : 'delegation'],
        ...(isHealthBrand && { zeroDataRetention: true }),
      },
    }

    // 8. Execute THIS agent independently with ITS OWN model
    const controller = new AbortController()
    const timeoutMs = options.timeoutMs ?? (options.meetingDepartments ? 180000 : 120000)
    const timeout = setTimeout(() => controller.abort(), timeoutMs)

    const result = await generateText({
      model: gateway(model),
      system: systemPrompt,
      prompt: task,
      tools,
      providerOptions: gatewayOptions,
      abortSignal: controller.signal,
    })
    clearTimeout(timeout)

    // 9. Track THIS agent's spend independently
    const inputTokens = result.usage?.inputTokens ?? 0
    const outputTokens = result.usage?.outputTokens ?? 0
    const costCents = Math.round((inputTokens * 0.3 + outputTokens * 1.5) / 100)

    if (registry) {
      await recordAgentSpend(ctx.supabase, registry.id, costCents)
    }

    // 10. Save THIS agent's output independently
    const source = options.meetingDepartments ? 'meeting' : 'delegation'
    void ctx.supabase.from('outputs').insert({
      user_id: ctx.userId,
      brand_id: ctx.brandId,
      conversation_id: ctx.conversationId,
      output_type: OUTPUT_TYPE_MAP[dept] ?? 'other',
      title: `${source === 'meeting' ? '[Meeting] ' : ''}${deptName}: ${task.slice(0, 60)}`,
      content: result.text,
      metadata: { source, department: dept, model, tokensUsed: inputTokens + outputTokens, costCents, memoryCount },
    })

    // 11. Audit THIS agent's execution independently
    await logAudit({
      supabase: ctx.supabase,
      userId: ctx.userId,
      agentId: registry?.id,
      action: source === 'meeting' ? 'meeting_contribution' : 'delegation_completed',
      entityType: 'agent',
      entityId: dept,
      detail: {
        task: task.slice(0, 200),
        model,
        inputTokens,
        outputTokens,
        costCents,
        memoryCount,
        resultLength: result.text.length,
        durationMs: Date.now() - startTime,
      },
      costCents,
    })

    return {
      department: dept,
      departmentName: deptName,
      result: result.text,
      costCents,
      tokensUsed: inputTokens + outputTokens,
      model,
      durationMs: Date.now() - startTime,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error(`[worker:${dept}] Failed:`, message)
    return {
      department: dept,
      departmentName: deptName,
      result: '',
      costCents: 0,
      tokensUsed: 0,
      model: 'none',
      durationMs: Date.now() - startTime,
      error: message,
    }
  }
}

// ─── Parallel Execution ─────────────────────────────────────────────────────

/**
 * Run multiple agent workers in parallel.
 * Each agent runs genuinely independently — own model, memory, tools, budget.
 */
export async function runParallelAgents(
  agents: { agentType: string; task: string; options?: WorkerOptions }[],
  ctx: WorkerContext,
): Promise<{
  results: WorkerResult[]
  errors: WorkerResult[]
  totalCostCents: number
  totalTokens: number
  totalDurationMs: number
}> {
  const startTime = Date.now()

  const settled = await Promise.allSettled(
    agents.map(({ agentType, task, options }) =>
      runAgentWorker(agentType, task, ctx, options)
    )
  )

  const results: WorkerResult[] = []
  const errors: WorkerResult[] = []

  for (const res of settled) {
    if (res.status === 'fulfilled') {
      if (res.value.error) {
        errors.push(res.value)
      } else {
        results.push(res.value)
      }
    } else {
      errors.push({
        department: 'unknown',
        departmentName: 'Unknown',
        result: '',
        costCents: 0,
        tokensUsed: 0,
        model: 'none',
        durationMs: 0,
        error: res.reason?.message ?? 'Unknown failure',
      })
    }
  }

  return {
    results,
    errors,
    totalCostCents: results.reduce((sum, r) => sum + r.costCents, 0),
    totalTokens: results.reduce((sum, r) => sum + r.tokensUsed, 0),
    totalDurationMs: Date.now() - startTime,
  }
}

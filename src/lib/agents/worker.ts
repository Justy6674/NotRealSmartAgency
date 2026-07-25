/**
 * AgentWorker — Independent agent execution unit.
 *
 * Each worker is a genuinely separate agent with:
 * - Its own model (from agent_registry)
 * - Its own memory context (retrieved independently per namespace)
 * - Its own tool set (assembled per agent type)
 * - Its own budget tracking
 * - Its own audit trail
 * - Its own status tracking (working/idle in registry)
 *
 * Workers run independently and in parallel via Promise.allSettled().
 * The Director orchestrates by spawning workers, not by prompt-switching.
 *
 * Concurrency is limited to MAX_CONCURRENT_WORKERS to prevent rate limits.
 */

import { generateText, stepCountIs } from 'ai'
import { gateway } from '@ai-sdk/gateway'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { AgentType, Brand, AgentConfig } from '@/types/database'
import { AGENT_LABELS, AGENT_SUBTITLES } from '@/types/database'
import { buildSystemPromptWithMemory } from './prompt-builder'
import { getToolsForAgent } from './tools'
import { logAudit } from './audit'
import { getOrCreateAgentRegistry, recordAgentSpend, checkBudget, updateAgentStatus } from './registry'
import { extractAndStoreMemories } from '@/lib/ruflo/memory-extractor'
import { extractFacts } from '@/lib/memory/fact-extractor'
import { memoryStoreV2 } from '@/lib/memory/store'
import { getActiveGoal } from './goal-loop'

/** Maximum workers running simultaneously to prevent AI Gateway rate limit exhaustion.
 *  AI Gateway enforces per-user concurrency limits; 4 is conservative for most providers. */
const MAX_CONCURRENT_WORKERS = 4

/** Agents that should always get web_search during delegation */
const WEB_SEARCH_AGENTS = new Set<string>(['seo', 'competitor'])

/** Max tool-use steps per worker (each step = one tool call round-trip).
 *  Prevents infinite loops if a tool keeps returning results that trigger more calls. */
const MAX_WORKER_STEPS = 3

// ─── Types ──────────────────────────────────────────────────────────────────

export interface WorkerContext {
  supabase: SupabaseClient
  userId: string
  brandId: string
  brand: Brand
  conversationId: string | null
  /** The heartbeat task currently being executed, if any. */
  taskId?: string | null
}

export interface WorkerResult {
  department: string
  departmentName: string
  result: string
  costCents: number
  tokensUsed: number
  model: string
  durationMs: number
  /** Tools actually executed, used by code gates for autonomous workflows. */
  toolNames: string[]
  error?: string
}

export interface WorkerOptions {
  /** Additional context injected into the system prompt */
  contextOverride?: string
  /** Timeout in milliseconds (default: 120000 for delegation, 180000 for meetings) */
  timeoutMs?: number
  /** Whether to add web search tool (default: auto-detected based on agent type) */
  withWebSearch?: boolean
  /** Meeting context: other departments in the meeting */
  meetingDepartments?: string[]
  /** Department-specific brief to append */
  departmentBrief?: string
  /** Max tool-use steps (default: MAX_WORKER_STEPS) */
  maxSteps?: number
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
        durationMs: Date.now() - startTime, toolNames: [], error: `Agent ${dept} not configured`,
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
          toolNames: [],
          error: `${deptName} has exhausted its monthly budget (${budget.spent}/${budget.limit} cents)`,
        }
      }
    }

    // 4. Set THIS agent's status to 'working'
    if (registry) {
      await updateAgentStatus(ctx.supabase, registry.id, 'working')
        .catch((e) => console.warn(`[worker:${dept}] Failed to set working status:`, e))
    }

    // 5. Build THIS agent's system prompt with ITS OWN memory retrieval
    //    buildSystemPromptWithMemory searches the agent's namespace independently
    const activeGoal = await getActiveGoal(ctx.supabase, ctx.userId, ctx.brandId)
    const { prompt: basePrompt, memoryCount } = await buildSystemPromptWithMemory(
      ctx.brand,
      agentConfig as AgentConfig,
      task,
      { activeGoal },
      ctx.userId, // userId for v2 semantic search
    )

    // 6. Build final prompt with any context overrides
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

    // 7. Assemble THIS agent's tools independently
    const departmentTools = getToolsForAgent(dept as AgentType, {
      supabase: ctx.supabase,
      userId: ctx.userId,
      brandId: ctx.brandId,
      conversationId: ctx.conversationId,
      agentRegistryId: registry?.id ?? null,
      taskId: ctx.taskId ?? null,
    })

    // 8. Add web search — auto-detect if agent type needs it, or honour explicit option
    const shouldAddWebSearch = options.withWebSearch ?? WEB_SEARCH_AGENTS.has(dept)
    const tools = shouldAddWebSearch
      ? {
          ...departmentTools,
          web_search: gateway.tools.perplexitySearch({
            maxResults: 5,
            searchLanguageFilter: ['en'],
            searchRecencyFilter: 'month',
          }),
        }
      : departmentTools

    // 9. Gateway options — THIS agent's tags
    const isHealthBrand = ctx.brand.compliance_flags?.ahpra || ctx.brand.compliance_flags?.tga
    const gatewayOptions = {
      gateway: {
        models: ['openai/gpt-4.1', 'google/gemini-2.5-flash'] as string[],
        user: ctx.userId,
        tags: [dept, ctx.brand.slug, options.meetingDepartments ? 'meeting' : 'delegation'],
        ...(isHealthBrand && { zeroDataRetention: true }),
      },
    }

    // 10. Execute THIS agent independently with ITS OWN model + step limit
    const controller = new AbortController()
    const timeoutMs = options.timeoutMs ?? (options.meetingDepartments ? 180000 : 120000)
    const timeout = setTimeout(() => controller.abort(), timeoutMs)
    const maxSteps = options.maxSteps ?? MAX_WORKER_STEPS

    const result = await generateText({
      model: gateway(model),
      system: systemPrompt,
      prompt: task,
      tools,
      stopWhen: stepCountIs(maxSteps),
      providerOptions: gatewayOptions,
      abortSignal: controller.signal,
    })
    clearTimeout(timeout)
    const toolNames = (result.toolCalls ?? []).flatMap((call) => {
      const toolName = (call as { toolName?: unknown }).toolName
      return typeof toolName === 'string' ? [toolName] : []
    })

    // 11. Set THIS agent's status back to 'idle'
    if (registry) {
      await updateAgentStatus(ctx.supabase, registry.id, 'idle')
        .catch((e) => console.warn(`[worker:${dept}] Failed to set idle status:`, e))
    }

    // 12. Track THIS agent's spend independently
    const inputTokens = result.usage?.inputTokens ?? 0
    const outputTokens = result.usage?.outputTokens ?? 0
    const costCents = Math.round((inputTokens * 0.3 + outputTokens * 1.5) / 100)

    if (registry) {
      await recordAgentSpend(ctx.supabase, registry.id, costCents)
    }

    // 13. Save THIS agent's output independently
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

    // 14. Audit THIS agent's execution independently
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
        maxSteps,
        resultLength: result.text.length,
        durationMs: Date.now() - startTime,
      },
      costCents,
    })

    // 15. Memory extraction — THIS agent learns from its own work.
    //     Architectural: every delegated worker now writes to its own memory
    //     namespace (nrs-{brandSlug}-{dept}) via both v1 (regex) and v2 (Haiku)
    //     extractors. Fire-and-forget so latency stays the same.
    //     Without this, agents repeat the same generic output forever.
    if (result.text && result.text.length > 20) {
      // v1: regex extraction (fast, catches common patterns)
      extractAndStoreMemories({
        brandId: ctx.brand.id,
        userId: ctx.userId,
        brandSlug: ctx.brand.slug,
        agentType: dept as AgentType,
        userMessage: task,
        assistantResponse: result.text,
        conversationId: ctx.conversationId,
      }).catch((err) => console.error(`[worker:${dept}] Memory v1 extraction failed:`, err))

      // v2: LLM extraction (Haiku — deeper, structured facts) → semantic store
      extractFacts(task, result.text, ctx.brand.name)
        .then(async (facts) => {
          if (facts.length === 0) return
          const ns = `nrs-${ctx.brand.slug}-${dept}`
          for (const fact of facts) {
            await memoryStoreV2(fact, ns, ctx.userId, ctx.brand.id, ctx.conversationId ?? undefined)
              .catch((err) => console.error(`[worker:${dept}] Memory v2 store failed:`, err))
          }
        })
        .catch((err) => console.error(`[worker:${dept}] Memory v2 extraction failed:`, err))
    }

    return {
      department: dept,
      departmentName: deptName,
      result: result.text,
      costCents,
      tokensUsed: inputTokens + outputTokens,
      model,
      durationMs: Date.now() - startTime,
      toolNames,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error(`[worker:${dept}] Failed:`, message)

    // Ensure status is reset to idle on failure
    try {
      const registry = await getOrCreateAgentRegistry(ctx.supabase, ctx.userId, dept as AgentType)
      if (registry) {
        await updateAgentStatus(ctx.supabase, registry.id, 'idle')
      }
    } catch (resetErr) { console.warn(`[worker:${dept}] Failed to reset status on error:`, resetErr) }

    return {
      department: dept,
      departmentName: deptName,
      result: '',
      costCents: 0,
      tokensUsed: 0,
      model: 'none',
      durationMs: Date.now() - startTime,
      toolNames: [],
      error: message,
    }
  }
}

// ─── Parallel Execution with Concurrency Control ─────────────────────────────

/**
 * Run multiple agent workers in parallel with concurrency limiting.
 * Each agent runs genuinely independently — own model, memory, tools, budget.
 * Concurrency is capped at MAX_CONCURRENT_WORKERS to prevent rate limit exhaustion.
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

  // Concurrency-limited execution — run at most MAX_CONCURRENT_WORKERS at a time
  const allResults: WorkerResult[] = []
  const pending = [...agents]

  while (pending.length > 0) {
    const batch = pending.splice(0, MAX_CONCURRENT_WORKERS)
    const settled = await Promise.allSettled(
      batch.map(({ agentType, task, options }) =>
        runAgentWorker(agentType, task, ctx, options)
      )
    )

    for (const res of settled) {
      if (res.status === 'fulfilled') {
        allResults.push(res.value)
      } else {
        allResults.push({
          department: 'unknown',
          departmentName: 'Unknown',
          result: '',
          costCents: 0,
          tokensUsed: 0,
          model: 'none',
          durationMs: 0,
          toolNames: [],
          error: res.reason?.message ?? 'Unknown failure',
        })
      }
    }
  }

  const results = allResults.filter(r => !r.error)
  const errors = allResults.filter(r => !!r.error)

  return {
    results,
    errors,
    totalCostCents: results.reduce((sum, r) => sum + r.costCents, 0),
    totalTokens: results.reduce((sum, r) => sum + r.tokensUsed, 0),
    totalDurationMs: Date.now() - startTime,
  }
}

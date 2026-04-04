/**
 * delegate_to_agent — Spawn an independent agent worker for a department.
 *
 * Each delegation creates a genuinely separate agent with its own:
 * - Model (from agent_registry — can differ per department)
 * - Memory context (retrieved independently per namespace)
 * - Tool set (assembled per agent type)
 * - Budget tracking
 * - Audit trail
 */

import { tool } from 'ai'
import { z } from 'zod/v3'
import type { Brand } from '@/types/database'
import type { SupabaseClient } from '@supabase/supabase-js'
import { runAgentWorker, runParallelAgents, type WorkerContext } from '@/lib/agents/worker'

interface DelegateContext {
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

export function createDelegateTool(ctx: DelegateContext) {
  const workerCtx: WorkerContext = {
    supabase: ctx.supabase,
    userId: ctx.userId,
    brandId: ctx.brandId,
    brand: ctx.brand,
    conversationId: ctx.conversationId,
  }

  return tool({
    description:
      'Delegate a task to one or more specialist departments. Each department runs as an INDEPENDENT agent with its own model, memory, and tools. When multiple departments are specified, they run in PARALLEL — not sequentially. Use this for any work that needs specialist expertise.',
    inputSchema: z.object({
      agentType: z.enum(DEPARTMENT_TYPES).describe('Primary department to handle this task'),
      task: z.string().describe('Clear brief of what the department should produce'),
      parallel: z.array(z.enum(DEPARTMENT_TYPES)).optional()
        .describe('Additional departments to run in parallel with the primary. Each runs independently with its own model and tools.'),
    }),
    execute: async ({ agentType, task, parallel }) => {
      // If parallel departments specified, run ALL in parallel (including primary)
      if (parallel?.length) {
        const allDepts = [agentType, ...parallel.filter(d => d !== agentType)]
        console.log(`[delegate] Parallel execution: ${allDepts.join(', ')} — "${task.slice(0, 80)}"`)

        const { results, errors, totalCostCents, totalTokens, totalDurationMs } = await runParallelAgents(
          allDepts.map(dept => ({ agentType: dept, task })),
          workerCtx,
        )

        return {
          type: 'parallel_delegation',
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
      }

      // Single department delegation — still a genuinely independent agent
      console.log(`[delegate] ${agentType} — "${task.slice(0, 80)}"`)
      const result = await runAgentWorker(agentType, task, workerCtx)

      if (result.error) {
        return { error: result.error, department: result.department }
      }

      return {
        department: result.department,
        result: result.result,
        model: result.model,
        tokensUsed: result.tokensUsed,
        costCents: result.costCents,
        durationMs: result.durationMs,
      }
    },
  })
}

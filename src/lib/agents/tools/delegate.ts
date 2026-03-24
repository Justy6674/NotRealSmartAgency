import { tool, ToolLoopAgent, stepCountIs, generateText } from 'ai'
import { gateway } from '@ai-sdk/gateway'
import { z } from 'zod/v3'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { AgentType, Brand, AgentConfig } from '@/types/database'
import { buildSystemPromptWithMemory } from '@/lib/agents/prompt-builder'
import { getToolsForAgent } from './index'
import { logAudit } from '@/lib/agents/audit'
import { getOrCreateAgentRegistry, recordAgentSpend } from '@/lib/agents/registry'

interface DelegateContext {
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

export function createDelegateTool(ctx: DelegateContext) {
  return tool({
    description:
      'Delegate a task to a specialist department. Use when the user needs work done by a specific team. The department agent will execute the task and return the result.',
    inputSchema: z.object({
      agentType: z.enum(DEPARTMENT_TYPES).describe('Which department should handle this'),
      task: z.string().describe('Clear brief of what the department should produce'),
    }),
    execute: async ({ agentType, task }) => {
      try {
        // Fetch department agent config
        const { data: agentConfig } = await ctx.supabase
          .from('agent_configs')
          .select('*')
          .eq('agent_type', agentType)
          .single()

        if (!agentConfig) {
          return { error: `Department ${agentType} not found`, department: agentType }
        }

        // Get/create registry entry for budget tracking
        const registry = await getOrCreateAgentRegistry(ctx.supabase, ctx.userId, agentType as AgentType)

        // Build department system prompt with memory
        const { prompt: departmentPrompt } = await buildSystemPromptWithMemory(
          ctx.brand,
          agentConfig as AgentConfig,
          task
        )

        // Get department tools
        const departmentTools = getToolsForAgent(agentType as AgentType, {
          supabase: ctx.supabase,
          userId: ctx.userId,
          brandId: ctx.brandId,
          conversationId: ctx.conversationId,
        })

        // Gateway options — fallback, tracking, compliance
        const isHealthBrand = ctx.brand.compliance_flags?.ahpra || ctx.brand.compliance_flags?.tga
        const gatewayOptions = {
          gateway: {
            models: ['openai/gpt-4.1', 'google/gemini-2.5-flash'] as string[],
            user: ctx.userId,
            tags: [agentType, ctx.brand.slug, 'delegation'],
            ...(isHealthBrand && { zeroDataRetention: true }),
          },
        }

        // Run subagent with 120s timeout
        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), 120000)

        const result = await generateText({
          model: gateway(registry?.model || 'anthropic/claude-sonnet-4'),
          system: departmentPrompt,
          prompt: task,
          tools: departmentTools,
          providerOptions: gatewayOptions,
          abortSignal: controller.signal,
        })
        clearTimeout(timeout)

        // Calculate cost
        const inputTokens = result.usage?.inputTokens ?? 0
        const outputTokens = result.usage?.outputTokens ?? 0
        const costCents = Math.round((inputTokens * 0.3 + outputTokens * 1.5) / 100)

        // Record spend
        if (registry) {
          await recordAgentSpend(ctx.supabase, registry.id, costCents)
        }

        // Auto-save delegation result to output library
        const outputTypeMap: Record<string, string> = {
          content: 'social_post', seo: 'seo_audit', paid_ads: 'ad_copy',
          strategy: 'strategy_doc', email: 'email_sequence', growth: 'strategy_doc',
          brand: 'brand_guide', competitor: 'competitor_report', website: 'landing_page',
          compliance: 'compliance_check', analytics: 'analytics_report', automation: 'automation_workflow',
        }
        // Auto-save to output library (fire and forget)
        void ctx.supabase.from('outputs').insert({
          user_id: ctx.userId,
          brand_id: ctx.brandId,
          conversation_id: ctx.conversationId,
          output_type: outputTypeMap[agentType] ?? 'other',
          title: `${agentType}: ${task.slice(0, 80)}`,
          content: result.text,
          metadata: { source: 'delegation', department: agentType, tokensUsed: inputTokens + outputTokens, costCents },
        })

        // Audit log
        await logAudit({
          supabase: ctx.supabase,
          userId: ctx.userId,
          agentId: registry?.id,
          action: 'delegation_completed',
          entityType: 'agent',
          entityId: agentType,
          detail: {
            task: task.slice(0, 200),
            inputTokens,
            outputTokens,
            costCents,
            resultLength: result.text.length,
          },
          costCents,
        })

        return {
          department: agentType,
          result: result.text,
          tokensUsed: inputTokens + outputTokens,
          costCents,
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error'
        console.error(`[delegate] ${agentType} failed:`, message)
        return { error: message, department: agentType }
      }
    },
  })
}

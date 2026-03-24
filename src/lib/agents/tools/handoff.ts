import { tool } from 'ai'
import { z } from 'zod/v3'
import type { SupabaseClient } from '@supabase/supabase-js'
import { logAudit } from '@/lib/agents/audit'

interface HandoffContext {
  supabase: SupabaseClient
  userId: string
  brandId: string
  agentRegistryId: string | null
}

const DEPARTMENT_TYPES = [
  'overall', 'content', 'seo', 'paid_ads', 'strategy', 'email', 'growth',
  'brand', 'competitor', 'website', 'compliance', 'analytics', 'automation',
] as const

export function createHandoffTool(ctx: HandoffContext) {
  return tool({
    description:
      'Hand off work to another department when the task falls outside your expertise. Creates a task assigned to the target department with your brief.',
    inputSchema: z.object({
      targetDepartment: z.enum(DEPARTMENT_TYPES).describe('Which department should take over'),
      reason: z.string().describe('Why you are handing off'),
      brief: z.string().describe('Detailed brief for the target department'),
      priority: z.enum(['critical', 'high', 'medium', 'low']).default('medium'),
    }),
    execute: async ({ targetDepartment, reason, brief, priority }) => {
      // Find the target agent's registry ID
      const { data: targetAgent } = await ctx.supabase
        .from('agent_registry')
        .select('id')
        .eq('user_id', ctx.userId)
        .eq('agent_type', targetDepartment)
        .single()

      // Create task assigned to target department
      const { data: task, error } = await ctx.supabase
        .from('tasks')
        .insert({
          user_id: ctx.userId,
          brand_id: ctx.brandId,
          created_by_agent_id: ctx.agentRegistryId,
          assigned_agent_id: targetAgent?.id ?? null,
          title: `Handoff: ${brief.slice(0, 80)}`,
          description: `**Handed off from another department**\n\n**Reason:** ${reason}\n\n**Brief:** ${brief}`,
          priority,
          status: targetAgent ? 'assigned' : 'backlog',
          context: { handoff: true, from_agent_id: ctx.agentRegistryId, reason },
        })
        .select('id, title, status')
        .single()

      if (error) {
        return { handed_off: false, error: error.message }
      }

      // Audit
      await logAudit({
        supabase: ctx.supabase,
        userId: ctx.userId,
        agentId: ctx.agentRegistryId ?? undefined,
        taskId: task.id,
        action: 'handoff',
        entityType: 'task',
        entityId: task.id,
        detail: { targetDepartment, reason, priority },
      })

      return {
        handed_off: true,
        taskId: task.id,
        targetDepartment,
        message: `Handed off to ${targetDepartment}. Task created and ${targetAgent ? 'assigned — it will be picked up in the next heartbeat.' : 'added to backlog.'}`,
      }
    },
  })
}

import { tool } from 'ai'
import { z } from 'zod/v3'
import type { SupabaseClient } from '@supabase/supabase-js'
import { getActiveGoal } from '@/lib/agents/goal-loop'

interface CreateTaskContext {
  supabase: SupabaseClient
  userId: string
  brandId: string
  agentRegistryId: string | null
}

export function createCreateTaskTool(ctx: CreateTaskContext) {
  return tool({
    description:
      'Create a task on the work board. Use when there is follow-up work to be done, a deliverable to track, or a subtask to assign.',
    inputSchema: z.object({
      title: z.string().describe('Clear, concise task title'),
      description: z.string().optional().describe('Detailed task description'),
      priority: z.enum(['critical', 'high', 'medium', 'low']).default('medium'),
      assignToSelf: z.boolean().default(true).describe('Assign this task to yourself so the goal loop can execute it'),
    }),
    execute: async ({ title, description, priority, assignToSelf }) => {
      const activeGoal = await getActiveGoal(ctx.supabase, ctx.userId, ctx.brandId)
      if (!activeGoal) {
        return {
          created: false,
          error: 'No active end-user outcome exists for this brand. Establish the owner\'s goal before creating ongoing work.',
        }
      }

      const assignToCurrentAgent = assignToSelf && Boolean(ctx.agentRegistryId)
      const { data, error } = await ctx.supabase
        .from('tasks')
        .insert({
          user_id: ctx.userId,
          brand_id: ctx.brandId,
          goal_id: activeGoal.id,
          created_by_agent_id: ctx.agentRegistryId,
          assigned_agent_id: assignToCurrentAgent ? ctx.agentRegistryId : null,
          title,
          description: description ?? null,
          priority,
          status: assignToCurrentAgent ? 'assigned' : 'backlog',
        })
        .select('id, title, status, priority')
        .single()

      if (error) {
        return { created: false, error: error.message }
      }

      return {
        created: true,
        taskId: data.id,
        title: data.title,
        status: data.status,
        priority: data.priority,
      }
    },
  })
}

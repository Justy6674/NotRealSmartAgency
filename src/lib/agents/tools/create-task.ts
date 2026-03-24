import { tool } from 'ai'
import { z } from 'zod/v3'
import type { SupabaseClient } from '@supabase/supabase-js'

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
      assignToSelf: z.boolean().default(false).describe('Assign this task to yourself'),
    }),
    execute: async ({ title, description, priority, assignToSelf }) => {
      const { data, error } = await ctx.supabase
        .from('tasks')
        .insert({
          user_id: ctx.userId,
          brand_id: ctx.brandId,
          created_by_agent_id: ctx.agentRegistryId,
          assigned_agent_id: assignToSelf ? ctx.agentRegistryId : null,
          title,
          description: description ?? null,
          priority,
          status: assignToSelf ? 'assigned' : 'backlog',
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

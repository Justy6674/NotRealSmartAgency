import { tool } from 'ai'
import { z } from 'zod/v3'
import type { SupabaseClient } from '@supabase/supabase-js'

interface ApprovalContext {
  supabase: SupabaseClient
  userId: string
  agentRegistryId: string | null
}

export function createRequestApprovalTool(ctx: ApprovalContext) {
  return tool({
    description:
      'Request human approval before proceeding with a significant action. Use for strategy changes, publishing content, or spend decisions.',
    inputSchema: z.object({
      actionType: z.string().describe('Type of action needing approval (e.g., "publish", "strategy", "spend")'),
      description: z.string().describe('What you want to do and why'),
      payload: z.record(z.unknown()).optional().describe('Additional data for the reviewer'),
    }),
    execute: async ({ actionType, description, payload }) => {
      const { data, error } = await ctx.supabase
        .from('approval_queue')
        .insert({
          user_id: ctx.userId,
          agent_id: ctx.agentRegistryId,
          action_type: actionType,
          payload: {
            description,
            ...(payload ?? {}),
          },
          status: 'pending',
        })
        .select('id, action_type, status')
        .single()

      if (error) {
        return { requested: false, error: error.message }
      }

      return {
        requested: true,
        approvalId: data.id,
        message: `Approval requested for "${actionType}". You will need to approve this before I can proceed.`,
      }
    },
  })
}

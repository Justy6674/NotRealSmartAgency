import { tool } from 'ai'
import { z } from 'zod/v3'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  getActiveGoal,
  nextGoalReviewAt,
  validateGoalProgressUpdate,
} from '@/lib/agents/goal-loop'

interface ManageGoalContext {
  supabase: SupabaseClient
  userId: string
  brandId: string
  agentRegistryId: string | null
}

const successCriteriaSchema = z.object({
  outcome: z.string().min(1).describe('The user-facing result this goal is meant to achieve'),
  metric: z.string().optional().describe('How progress will be measured, if known'),
  target: z.string().optional().describe('The success threshold, if known'),
  baseline: z.string().optional().describe('The current starting point, if known'),
  review_cadence: z.string().optional().describe('How often the outcome should be reviewed'),
})

export function createSetActiveGoalTool(ctx: ManageGoalContext) {
  return tool({
    description: 'Set or refine the single active end-user outcome for this brand. Use only after the owner has stated the outcome in plain language. This establishes the North Star for all autonomous NRS work.',
    inputSchema: z.object({
      title: z.string().min(3).max(180).describe('A concise outcome title in the owner\'s language'),
      description: z.string().min(3).max(1000).describe('What the owner wants and why it matters'),
      successCriteria: successCriteriaSchema,
      deadline: z.string().datetime().optional().describe('ISO target date only when the owner gave one'),
    }),
    execute: async ({ title, description, successCriteria, deadline }) => {
      const existing = await getActiveGoal(ctx.supabase, ctx.userId, ctx.brandId)
      const updates = {
        title,
        description,
        // Merge, never replace. A refinement supplies the fields the model was
        // asked for; replacing wholesale silently discarded the owner's
        // per-platform targets, which he set by hand and no model knows to
        // restate. The heartbeat's goal review did exactly that within
        // fifteen minutes of them being set.
        success_criteria: {
          ...(existing?.success_criteria ?? {}),
          ...successCriteria,
        },
        // A refinement without a new date must not silently discard a deadline
        // the owner previously supplied.
        deadline: deadline ?? existing?.deadline ?? null,
        owner_agent_id: ctx.agentRegistryId,
        status: 'active' as const,
        next_review_at: new Date().toISOString(),
      }

      const query = existing
        ? ctx.supabase.from('goals').update(updates).eq('id', existing.id).eq('user_id', ctx.userId)
        : ctx.supabase.from('goals').insert({
            ...updates,
            user_id: ctx.userId,
            brand_id: ctx.brandId,
            level: 'objective',
            progress: { percent: 0, summary: 'Goal recorded; first review is queued.', evidence: [] },
          })

      const { data, error } = await query.select('id, title, next_review_at').single()
      if (error || !data) return { updated: false, error: error?.message ?? 'Unable to save the active goal.' }

      return {
        updated: true,
        goalId: data.id,
        title: data.title,
        message: 'The active outcome is saved. Create the next goal-linked task now if there is a safe action to take; otherwise the Director review will pick it up.',
      }
    },
  })
}

export function createUpdateGoalProgressTool(ctx: ManageGoalContext) {
  return tool({
    description: 'Record evidence-based progress for the active end-user outcome. Use after a goal review or a completed goal-linked task. Never mark completion without evidence.',
    inputSchema: z.object({
      percent: z.number().min(0).max(100).describe('Verified progress from 0 to 100'),
      summary: z.string().min(3).max(1000).describe('Concise evidence-based progress summary'),
      evidence: z.array(z.string().min(1)).max(10).default([]).describe('Specific evidence such as analytics, a saved output, or a completed task'),
      status: z.enum(['active', 'paused', 'completed']).default('active'),
      nextReviewHours: z.number().int().min(1).max(168).default(24).describe('Hours until the next review when the goal remains active'),
    }),
    execute: async ({ percent, summary, evidence, status, nextReviewHours }) => {
      const validationError = validateGoalProgressUpdate({ percent, summary, evidence, status })
      if (validationError) return { updated: false, error: validationError }

      const activeGoal = await getActiveGoal(ctx.supabase, ctx.userId, ctx.brandId)
      if (!activeGoal) return { updated: false, error: 'There is no active end-user outcome for this brand.' }

      const { data, error } = await ctx.supabase
        .from('goals')
        .update({
          progress: { percent, summary, evidence, updated_at: new Date().toISOString() },
          status,
          last_reviewed_at: new Date().toISOString(),
          next_review_at: status === 'active' ? nextGoalReviewAt(nextReviewHours) : null,
          review_claimed_at: null,
          review_claim_expires_at: null,
        })
        .eq('id', activeGoal.id)
        .eq('user_id', ctx.userId)
        .select('id, status, next_review_at')
        .single()

      if (error || !data) return { updated: false, error: error?.message ?? 'Unable to record goal progress.' }
      return { updated: true, goalId: data.id, status: data.status, nextReviewAt: data.next_review_at }
    },
  })
}

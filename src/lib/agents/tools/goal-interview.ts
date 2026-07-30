import { tool } from 'ai'
import { z } from 'zod/v3'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  buildInterviewDirective,
  draftGoalFromAnswers,
  goalInterviewProgress,
  nextGoalQuestion,
  type GoalAnswers,
  type GoalField,
} from '@/lib/goals/goal-interview'

const FIELDS = [
  'outcome', 'audience', 'action', 'barrier', 'channels',
  'metric', 'baseline', 'deadline', 'guardrail',
] as const

/**
 * Conduct the goal interview, one question at a time.
 *
 * The answers are held on the goal row rather than in the conversation, so the
 * interview survives a closed tab, a new chat, or being started in the web
 * Director and finished from a plugged-in client. An interview that forgets
 * what he already told it is worse than a form.
 */
export function createGoalInterviewTool(
  supabase: SupabaseClient,
  userId: string,
  brandId: string,
) {
  return tool({
    description:
      'Run the goal-setting interview for a project. Call with no answer to get the next question to ask; call with an answer to record what the owner just said and get the next question. Ask exactly one question per turn and wait. When the essentials are answered, read the goal back and save it only once he agrees.',
    inputSchema: z.object({
      field: z.enum(FIELDS).optional().describe('Which question the owner just answered.'),
      answer: z.string().min(1).optional().describe("The owner's answer, in his own words. Never paraphrase into marketing language."),
      save: z.boolean().optional().describe('Set true only after he has agreed the wording read back to him.'),
    }),
    execute: async ({ field, answer, save }) => {
      const { data: brand } = await supabase
        .from('brands')
        .select('id, name')
        .eq('id', brandId)
        .maybeSingle()

      if (!brand) return { error: 'That project could not be found.' }

      const { data: existing } = await supabase
        .from('goals')
        .select('id, title, success_criteria, status')
        .eq('user_id', userId)
        .eq('brand_id', brandId)
        .eq('level', 'objective')
        .in('status', ['planned', 'active'])
        .order('created_at', { ascending: false })
        .maybeSingle()

      const criteria = (existing?.success_criteria ?? {}) as Record<string, unknown>
      const answers: GoalAnswers = { ...((criteria.interview ?? {}) as GoalAnswers) }

      if (field && answer) answers[field as GoalField] = answer

      const draft = draftGoalFromAnswers(answers)
      const progress = goalInterviewProgress(answers)
      const now = new Date().toISOString()

      // Answers are kept as they arrive, on a goal that stays 'planned' until
      // he agrees. A half-finished interview is not a goal, but losing his
      // answers because he closed the tab is worse.
      const payload = {
        user_id: userId,
        brand_id: brandId,
        level: 'objective' as const,
        status: (save && progress.usable ? 'active' : 'planned') as 'active' | 'planned',
        title: draft?.title ?? `Goal for ${brand.name} — being set`,
        description: draft?.description ?? null,
        success_criteria: {
          ...criteria,
          outcome: answers.outcome ?? criteria.outcome,
          interview: answers,
        },
        last_reviewed_at: now,
      }

      if (existing) {
        await supabase.from('goals').update(payload).eq('id', existing.id).eq('user_id', userId)
      } else {
        await supabase.from('goals').insert({
          ...payload,
          progress: { percent: 0, summary: 'Being set with the owner.', evidence: [] },
        })
      }

      if (save && progress.usable) {
        return {
          saved: true,
          title: draft?.title,
          message: `Saved. ${brand.name} is now aiming at: "${draft?.title}". Every post written for it will be aimed at this.`,
          next_step: 'Ask whether he wants to set how often to post on each channel, or leave that for now.',
        }
      }

      const next = nextGoalQuestion(answers)
      return {
        saved: false,
        answered: progress.answeredRequired,
        of: progress.totalRequired,
        ready_to_save: progress.usable,
        ask_now: next?.question ?? null,
        directive: buildInterviewDirective(brand.name, answers),
      }
    },
  })
}

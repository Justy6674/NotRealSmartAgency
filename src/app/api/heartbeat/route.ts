import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { runAgentWorker, type WorkerContext } from '@/lib/agents/worker'
import { checkBudget, getOrCreateAgentRegistry } from '@/lib/agents/registry'
import { logAudit } from '@/lib/agents/audit'
import type { Brand, AgentRegistryEntry, Task } from '@/types/database'
import {
  buildGoalReviewBrief,
  claimDueGoalReview,
  markGoalReadyForReview,
  nextGoalReviewAt,
  releaseGoalReviewClaim,
} from '@/lib/agents/goal-loop'
import {
  describeGoalReviewOwnerReview,
  resolveGoalReviewOutcome,
  type GoalReviewOwnerReviewCode,
} from '@/lib/agents/goal-review-controller'

// Fluid Compute — allow up to 5 minutes for processing multiple agents
export const maxDuration = 300

const GOAL_REVIEW_DEFER_HOURS = 4
const GOAL_REVIEW_TOOL_NAMES = [
  'query_outputs',
  'query_calendar',
  'query_analytics',
  'query_social_analytics',
  'query_media',
  'read_proforma',
  'project_brief',
  'inspect_project_marketing_backend',
  'search_brain',
  'update_goal_progress',
  'create_task',
  'request_approval',
] as const

interface GoalReviewState {
  goalStatus: string | null
  followUpTaskCount: number
  reviewApprovalCount: number
}

async function readGoalReviewState(
  supabase: ReturnType<typeof createAdminClient>,
  task: Task,
): Promise<GoalReviewState> {
  if (!task.goal_id) throw new Error('Goal review is missing its parent goal.')

  const [goalStateResult, followUpTasksResult, approvalResult] = await Promise.all([
    supabase
      .from('goals')
      .select('status')
      .eq('id', task.goal_id)
      .eq('user_id', task.user_id)
      .maybeSingle(),
    supabase
      .from('tasks')
      .select('id')
      .eq('goal_id', task.goal_id)
      .neq('id', task.id)
      .in('status', ['assigned', 'in_progress', 'review']),
    supabase
      .from('approval_queue')
      .select('id')
      .eq('task_id', task.id)
      .eq('status', 'pending'),
  ])

  if (goalStateResult.error || !goalStateResult.data) {
    throw new Error(goalStateResult.error?.message ?? 'Goal review could not confirm the parent outcome.')
  }
  if (followUpTasksResult.error) throw new Error(followUpTasksResult.error.message)
  if (approvalResult.error) throw new Error(approvalResult.error.message)

  return {
    goalStatus: goalStateResult.data.status,
    followUpTaskCount: followUpTasksResult.data?.length ?? 0,
    reviewApprovalCount: approvalResult.data?.length ?? 0,
  }
}

async function moveGoalReviewToOwner(
  supabase: ReturnType<typeof createAdminClient>,
  task: Task,
  registry: AgentRegistryEntry,
  result: Awaited<ReturnType<typeof runAgentWorker>>,
  code: GoalReviewOwnerReviewCode,
): Promise<void> {
  const ownerMessage = describeGoalReviewOwnerReview(code)
  const { error } = await supabase
    .from('tasks')
    .update({
      status: 'review',
      description: ownerMessage,
      result: {
        text: result.result,
        goal_review: {
          state: 'needs_owner_direction',
          code,
          recorded_at: new Date().toISOString(),
        },
      },
      tokens_used: result.tokensUsed,
      cost_cents: result.costCents,
    })
    .eq('id', task.id)

  if (error) throw new Error(error.message)

  await logAudit({
    supabase,
    userId: task.user_id,
    agentId: registry.id,
    taskId: task.id,
    action: 'heartbeat_goal_review_needs_owner',
    entityType: 'task',
    entityId: task.id,
    detail: {
      code,
      model: result.model,
      tokensUsed: result.tokensUsed,
      costCents: result.costCents,
      durationMs: result.durationMs,
      toolsUsed: result.toolNames,
      successfulTools: result.successfulToolNames ?? [],
    },
    costCents: result.costCents,
  })
}

/**
 * Prior versions marked an incomplete review as blocked and immediately made
 * the same goal due again. Cancel only those null-result rows from that known
 * failure mode; task history remains intact and new failures keep diagnostics.
 */
async function reconcileHistoricalGoalReviewLoop(
  supabase: ReturnType<typeof createAdminClient>,
  userId: string,
  goalId: string,
): Promise<number> {
  let recovered = 0
  const now = new Date().toISOString()

  for (let batch = 0; batch < 20; batch++) {
    const { data, error } = await supabase
      .from('tasks')
      .select('id')
      .eq('user_id', userId)
      .eq('goal_id', goalId)
      .eq('status', 'blocked')
      .contains('context', { kind: 'goal_review' })
      .is('result', null)
      .limit(500)

    if (error) throw new Error(error.message)
    const ids = (data ?? []).map((task) => task.id)
    if (ids.length === 0) return recovered

    const { data: recoveredRows, error: updateError } = await supabase
      .from('tasks')
      .update({ status: 'cancelled', completed_at: now })
      .in('id', ids)
      .eq('status', 'blocked')
      .select('id')
    if (updateError) throw new Error(updateError.message)

    const recoveredThisBatch = recoveredRows?.length ?? 0
    recovered += recoveredThisBatch
    if (ids.length < 500) return recovered
    if (recoveredThisBatch === 0) return recovered
  }

  throw new Error('Goal review recovery exceeded its bounded batch limit.')
}

/**
 * A goal review is the bridge between completed activity and the next useful
 * action. Claiming the goal first makes this safe when Vercel overlaps cron
 * invocations; the claim expires automatically if a process dies mid-run.
 */
async function enqueueDueGoalReviews(
  supabase: ReturnType<typeof createAdminClient>,
): Promise<number> {
  const now = new Date().toISOString()
  const { data: dueGoals, error } = await supabase
    .from('goals')
    .select('id, user_id, brand_id')
    .eq('level', 'objective')
    .eq('status', 'active')
    .not('brand_id', 'is', null)
    .lte('next_review_at', now)
    .limit(20)

  if (error) {
    console.error('[heartbeat] Failed to find due goal reviews:', error.message)
    return 0
  }

  let queued = 0
  for (const candidate of dueGoals ?? []) {
    if (!candidate.brand_id) continue

    const goal = await claimDueGoalReview(supabase, candidate.id)
    if (!goal) continue

    let recoveredLoopTasks = 0
    try {
      recoveredLoopTasks = await reconcileHistoricalGoalReviewLoop(supabase, candidate.user_id, goal.id)
    } catch (recoveryError) {
      console.error('[heartbeat] Failed to reconcile historical goal reviews:', recoveryError)
      await releaseGoalReviewClaim(supabase, goal.id, nextGoalReviewAt(GOAL_REVIEW_DEFER_HOURS))
      continue
    }

    const { data: openWork, error: openWorkError } = await supabase
      .from('tasks')
      .select('id')
      .eq('goal_id', goal.id)
      .in('status', ['assigned', 'in_progress', 'review'])
      .limit(1)

    if (openWorkError) {
      console.error('[heartbeat] Failed to inspect goal work:', openWorkError.message)
      await releaseGoalReviewClaim(supabase, goal.id, nextGoalReviewAt(1))
      continue
    }

    if (openWork && openWork.length > 0) {
      await releaseGoalReviewClaim(supabase, goal.id, nextGoalReviewAt(GOAL_REVIEW_DEFER_HOURS))
      continue
    }

    const director = await getOrCreateAgentRegistry(supabase, candidate.user_id, 'overall')
    if (!director) {
      await releaseGoalReviewClaim(supabase, goal.id, nextGoalReviewAt(1))
      continue
    }

    if (recoveredLoopTasks > 0) {
      await logAudit({
        supabase,
        userId: candidate.user_id,
        agentId: director.id,
        action: 'goal_review_loop_recovered',
        entityType: 'goal',
        entityId: goal.id,
        detail: { recoveredTaskCount: recoveredLoopTasks },
      })
    }

    const { error: taskError } = await supabase
      .from('tasks')
      .insert({
        user_id: candidate.user_id,
        brand_id: candidate.brand_id,
        goal_id: goal.id,
        created_by_agent_id: director.id,
        assigned_agent_id: director.id,
        title: `Goal review: ${goal.title}`,
        description: buildGoalReviewBrief(goal),
        priority: 'high',
        status: 'assigned',
        context: { kind: 'goal_review', goal_id: goal.id, triggered_by: 'heartbeat' },
      })

    if (taskError) {
      console.error('[heartbeat] Failed to queue goal review:', taskError.message)
      await releaseGoalReviewClaim(supabase, goal.id, nextGoalReviewAt(1))
      continue
    }

    await releaseGoalReviewClaim(supabase, goal.id, nextGoalReviewAt())
    queued++
  }

  return queued
}

export async function GET(request: Request) {
  // Verify cron secret (Vercel injects this)
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorised', { status: 401 })
  }

  const supabase = createAdminClient()
  const startTime = Date.now()
  let totalChecked = 0
  let totalActioned = 0
  let goalReviewsQueued = 0

  try {
    // Monthly budget reset on 1st of month
    const today = new Date()
    if (today.getDate() === 1 && today.getHours() < 1) {
      await supabase
        .from('agent_registry')
        .update({ spent_monthly_cents: 0 })
        .neq('spent_monthly_cents', 0)
    }

    // Establish the next safe action for any active outcome with no open work
    // before fetching the assigned queue, so newly-created reviews can run in
    // this heartbeat.
    goalReviewsQueued = await enqueueDueGoalReviews(supabase)

    // Only outcome-linked work may execute autonomously. Legacy unscoped tasks
    // stay visible for the owner but cannot create background activity.
    const { data: assignedTasks, error: taskError } = await supabase
      .from('tasks')
      .select(`
        *,
        agent_registry:assigned_agent_id (*),
        goals!inner(status, level)
      `)
      .eq('status', 'assigned')
      .not('assigned_agent_id', 'is', null)
      .not('goal_id', 'is', null)
      .eq('goals.status', 'active')
      .eq('goals.level', 'objective')

    if (taskError || !assignedTasks) {
      return NextResponse.json({
        status: 'error',
        error: taskError?.message ?? 'No tasks found',
      })
    }

    totalChecked = assignedTasks.length

    for (const taskRow of assignedTasks) {
      const task = taskRow as Task & { agent_registry: AgentRegistryEntry }
      const registry = task.agent_registry
      const isGoalReview = task.context?.kind === 'goal_review'

      if (!registry || !registry.is_active || registry.status === 'paused') continue

      // Check budget
      const budget = await checkBudget(supabase, registry.id)
      if (!budget.allowed) {
        await supabase
          .from('agent_registry')
          .update({ status: 'paused' })
          .eq('id', registry.id)
        continue
      }

      // Create heartbeat record
      const { data: heartbeat } = await supabase
        .from('heartbeats')
        .insert({
          user_id: task.user_id,
          agent_id: registry.id,
          triggered_by: 'cron',
          status: 'running',
          started_at: new Date().toISOString(),
        })
        .select('id')
        .single()

      try {
        // Fetch brand for context
        const { data: brand } = task.brand_id
          ? await supabase.from('brands').select('*').eq('id', task.brand_id).single()
          : { data: null }

        const taskPrompt = [
          task.title,
          task.description,
          task.context ? `Context: ${JSON.stringify(task.context)}` : '',
        ].filter(Boolean).join('\n\n')

        // Update task status
        await supabase
          .from('tasks')
          .update({ status: 'in_progress', started_at: new Date().toISOString() })
          .eq('id', task.id)

        // Execute using the shared AgentWorker — same independent execution as delegation
        const workerCtx: WorkerContext = {
          supabase,
          userId: task.user_id,
          brandId: task.brand_id ?? '',
          brand: (brand ?? { slug: 'unknown', name: 'Unknown', niche: '', compliance_flags: { ahpra: false, tga: false, tga_categories: [] } }) as Brand,
          conversationId: null,
          taskId: task.id,
        }

        const result = await runAgentWorker(registry.agent_type, taskPrompt, workerCtx, {
          timeoutMs: 240000, // Allow more time for heartbeat tasks
          maxSteps: 5, // Heartbeat tasks may need more tool iterations (e.g., scan + save + create_task)
          ...(isGoalReview ? {
            allowedToolNames: GOAL_REVIEW_TOOL_NAMES,
            requiredAllToolNames: ['update_goal_progress'],
          } : {}),
        })

        if (isGoalReview) {
          const reviewState = await readGoalReviewState(supabase, task)
          const outcome = resolveGoalReviewOutcome({
            workerError: result.error ?? null,
            progressRecorded: (result.successfulToolNames ?? []).includes('update_goal_progress'),
            ...reviewState,
          })

          if (outcome.kind === 'needs_owner_review') {
            await moveGoalReviewToOwner(supabase, task, registry, result, outcome.code)
            if (heartbeat) {
              await supabase
                .from('heartbeats')
                .update({
                  status: 'succeeded',
                  tasks_actioned: 1,
                  tasks_checked: 1,
                  duration_ms: Date.now() - startTime,
                  finished_at: new Date().toISOString(),
                })
                .eq('id', heartbeat.id)
            }
            totalActioned++
            continue
          }
        }

        if (result.error) {
          throw new Error(result.error)
        }

        // Update task as done
        await supabase
          .from('tasks')
          .update({
            status: 'done',
            result: { text: result.result },
            tokens_used: result.tokensUsed,
            cost_cents: result.costCents,
            completed_at: new Date().toISOString(),
          })
          .eq('id', task.id)

        // Audit — worker already logs its own audit, but log the task completion too
        await logAudit({
          supabase,
          userId: task.user_id,
          agentId: registry.id,
          taskId: task.id,
          action: 'heartbeat_task_completed',
          entityType: 'task',
          entityId: task.id,
          detail: {
            model: result.model,
            tokensUsed: result.tokensUsed,
            costCents: result.costCents,
            durationMs: result.durationMs,
          },
          costCents: result.costCents,
        })

        // A completed delivery makes its parent outcome immediately eligible
        // for the Director's next evidence-based review. Goal-review tasks
        // schedule themselves through update_goal_progress instead.
        if (task.goal_id && !isGoalReview) {
          await markGoalReadyForReview(supabase, task.user_id, task.goal_id)
        }

        // Update heartbeat
        if (heartbeat) {
          await supabase
            .from('heartbeats')
            .update({
              status: 'succeeded',
              tasks_actioned: 1,
              tasks_checked: 1,
              duration_ms: Date.now() - startTime,
              finished_at: new Date().toISOString(),
            })
            .eq('id', heartbeat.id)
        }

        totalActioned++
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error'

        // A genuine system failure remains visible. Goal-review failures defer
        // before retrying; they never recreate the former immediate loop.
        await supabase
          .from('tasks')
          .update({
            status: 'blocked',
            result: { heartbeat_error: message, recorded_at: new Date().toISOString() },
          })
          .eq('id', task.id)

        if (task.goal_id) {
          if (isGoalReview) {
            await supabase
              .from('goals')
              .update({ next_review_at: nextGoalReviewAt(GOAL_REVIEW_DEFER_HOURS) })
              .eq('id', task.goal_id)
              .eq('user_id', task.user_id)
              .eq('status', 'active')
          } else {
            await markGoalReadyForReview(supabase, task.user_id, task.goal_id)
          }
        }

        // Update heartbeat as failed
        if (heartbeat) {
          await supabase
            .from('heartbeats')
            .update({
              status: 'failed',
              error: message,
              duration_ms: Date.now() - startTime,
              finished_at: new Date().toISOString(),
            })
            .eq('id', heartbeat.id)
        }

        console.error(`[heartbeat] Task ${task.id} failed:`, message)
      }
    }
  } catch (error) {
    console.error('[heartbeat] Fatal error:', error)
    return NextResponse.json({
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 })
  }

  return NextResponse.json({
    status: 'ok',
    tasksChecked: totalChecked,
    tasksActioned: totalActioned,
    goalReviewsQueued,
    durationMs: Date.now() - startTime,
  })
}

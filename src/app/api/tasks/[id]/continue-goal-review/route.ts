import { NextResponse } from 'next/server'
import { logAudit } from '@/lib/agents/audit'
import { markGoalReadyForReview } from '@/lib/agents/goal-loop'
import { createClient } from '@/lib/supabase/server'

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
}

/**
 * An owner explicitly continues a review that the heartbeat could not finish.
 * This never publishes or makes an external change: it records the decision,
 * closes the visible review task, and schedules one fresh evidence review.
 */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorised', { status: 401 })

  const { data: task, error: taskError } = await supabase
    .from('tasks')
    .select('id, user_id, goal_id, brand_id, assigned_agent_id, title, status, context, result')
    .eq('id', id)
    .eq('user_id', user.id)
    .maybeSingle()

  if (taskError) return NextResponse.json({ error: taskError.message }, { status: 400 })
  if (!task) return NextResponse.json({ error: 'Task not found.' }, { status: 404 })
  if (task.status !== 'review' || asRecord(task.context).kind !== 'goal_review' || !task.goal_id) {
    return NextResponse.json({ error: 'Only an active goal-review task can be continued.' }, { status: 409 })
  }

  const now = new Date().toISOString()
  const previousResult = asRecord(task.result)
  const previousReview = asRecord(previousResult.goal_review)
  const { data: updatedTask, error: updateError } = await supabase
    .from('tasks')
    .update({
      status: 'done',
      completed_at: now,
      result: {
        ...previousResult,
        goal_review: {
          ...previousReview,
          state: 'owner_continued',
          owner_continued_at: now,
        },
      },
    })
    .eq('id', task.id)
    .eq('user_id', user.id)
    .eq('status', 'review')
    .select('*')
    .maybeSingle()

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 400 })
  if (!updatedTask) {
    return NextResponse.json({ error: 'This review was already resolved. Refresh the task list.' }, { status: 409 })
  }

  await markGoalReadyForReview(supabase, user.id, task.goal_id)
  await logAudit({
    supabase,
    userId: user.id,
    agentId: task.assigned_agent_id,
    taskId: task.id,
    action: 'goal_review_owner_continued',
    entityType: 'task',
    entityId: task.id,
    detail: { goalId: task.goal_id },
  })

  return NextResponse.json({
    task: updatedTask,
    directorPrompt: `I have chosen to continue the goal review for “${task.title}”. Show me the verified evidence and one safe next action. Do not publish, send, spend, or make an external change unless I explicitly approve it.`,
  })
}

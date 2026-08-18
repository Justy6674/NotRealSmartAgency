import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { runDirectorJob } from '@/lib/mcp/director-job'
import {
  DIRECTOR_JOB_QUEUE_GRACE_MS,
  DIRECTOR_JOB_RUNNING_GRACE_MS,
  isQueuedLongEnough,
  isRunningTooLong,
  recoverDirectorJob,
  type RecoverableDirectorJobRow,
  withRecoveryAttempt,
} from '@/lib/mcp/director-job-recovery'
import { logAudit } from '@/lib/agents/audit'
import { isCronAuthorised, CRON_UNAUTHORISED_BODY } from '@/lib/security/cron-auth'

export const runtime = 'nodejs'
export const maxDuration = 300

const MAX_RECOVERY_ATTEMPTS = 2

type Candidate = RecoverableDirectorJobRow

function recoveryAttempts(input: unknown): number {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return 0
  const recovery = (input as Record<string, unknown>).recovery
  if (!recovery || typeof recovery !== 'object' || Array.isArray(recovery)) return 0
  const attempts = (recovery as Record<string, unknown>).attempts
  return typeof attempts === 'number' && Number.isSafeInteger(attempts) ? attempts : 0
}

async function oldestRecoverableJob(
  supabase: ReturnType<typeof createAdminClient>,
  now: number,
): Promise<{ job: Candidate; priorStatus: 'queued' | 'running' } | null> {
  const select = 'id, user_id, brand_id, channel, api_key_id, project_access_grant_id, policy_version, status, input, created_at, started_at'
  const [queuedResult, runningResult] = await Promise.all([
    supabase
      .from('mcp_jobs')
      .select(select)
      .eq('status', 'queued')
      .lt('created_at', new Date(now - DIRECTOR_JOB_QUEUE_GRACE_MS).toISOString())
      .order('created_at', { ascending: true })
      .limit(1),
    supabase
      .from('mcp_jobs')
      .select(select)
      .eq('status', 'running')
      .not('started_at', 'is', null)
      .lt('started_at', new Date(now - DIRECTOR_JOB_RUNNING_GRACE_MS).toISOString())
      .order('started_at', { ascending: true })
      .limit(1),
  ])

  if (queuedResult.error) console.error('[recover-director-jobs] queued lookup:', queuedResult.error.message)
  if (runningResult.error) console.error('[recover-director-jobs] running lookup:', runningResult.error.message)

  const queued = queuedResult.data?.[0] as Candidate | undefined
  const running = runningResult.data?.[0] as Candidate | undefined
  const candidates = [
    queued && isQueuedLongEnough(queued, now) ? { job: queued, priorStatus: 'queued' as const } : null,
    running && isRunningTooLong(running, now) ? { job: running, priorStatus: 'running' as const } : null,
  ].filter((candidate): candidate is { job: Candidate; priorStatus: 'queued' | 'running' } => !!candidate)

  return candidates.sort((a, b) => new Date(a.job.created_at).getTime() - new Date(b.job.created_at).getTime())[0] ?? null
}

export async function GET(request: Request) {
  // Fail closed: with CRON_SECRET unset the old inline compare matched the
  // literal string 'Bearer undefined', so anyone sending it got in.
  if (!isCronAuthorised(request)) {
    return NextResponse.json(CRON_UNAUTHORISED_BODY, { status: 401 })
  }

  const supabase = createAdminClient()
  const now = Date.now()
  const candidate = await oldestRecoverableJob(supabase, now)
  if (!candidate) return NextResponse.json({ recovered: 0, message: 'No stranded Director jobs.' })

  const { job, priorStatus } = candidate
  const recovered = recoverDirectorJob(job)
  if (!recovered) {
    // A row without an immutable delivery/scope contract cannot be safely
    // replayed. Make the state visible instead of fabricating a destination.
    await supabase
      .from('mcp_jobs')
      .update({
        status: 'error',
        error: 'This interrupted request cannot be safely recovered. Please send it again.',
        completed_at: new Date().toISOString(),
      })
      .eq('id', job.id)
      .eq('status', priorStatus)
    return NextResponse.json({ recovered: 0, marked_error: 1, job_id: job.id })
  }

  if (recoveryAttempts(job.input) >= MAX_RECOVERY_ATTEMPTS) {
    await supabase
      .from('mcp_jobs')
      .update({
        status: 'error',
        error: 'This request was interrupted more than once. Nothing was published; please send it again.',
        completed_at: new Date().toISOString(),
      })
      .eq('id', job.id)
      .eq('status', priorStatus)
    return NextResponse.json({ recovered: 0, marked_error: 1, job_id: job.id, reason: 'recovery_limit' })
  }

  // Compare-and-set claim: overlapping cron invocations cannot both replay
  // the same Director job. A stale running invocation is beyond the ten-minute
  // grace period, well past the route's five-minute maximum duration.
  const { data: claimed, error: claimError } = await supabase
    .from('mcp_jobs')
    .update({
      status: 'running',
      started_at: new Date().toISOString(),
      completed_at: null,
      error: null,
      input: withRecoveryAttempt(job.input),
    })
    .eq('id', job.id)
    .eq('status', priorStatus)
    .select('id')
    .maybeSingle()

  if (claimError) {
    console.error('[recover-director-jobs] claim failed:', claimError.message)
    return NextResponse.json({ recovered: 0, error: 'Could not claim Director job.' }, { status: 500 })
  }
  if (!claimed) return NextResponse.json({ recovered: 0, message: 'Job was claimed by another runner.' })

  await logAudit({
    supabase,
    userId: job.user_id,
    action: 'director_job_recovered',
    entityType: 'director_job',
    entityId: job.id,
    detail: { channel: job.channel, priorStatus, recoveryAttempt: recoveryAttempts(job.input) + 1 },
  })

  await runDirectorJob(job.id, recovered.execution, recovered.input)
  return NextResponse.json({ recovered: 1, job_id: job.id, channel: job.channel, prior_status: priorStatus })
}

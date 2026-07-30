import type { SupabaseClient } from '@supabase/supabase-js'

export type GoalLifecycleStatus = 'active' | 'paused' | 'completed'

export interface GoalSuccessCriteria {
  outcome?: string
  metric?: string
  target?: string
  baseline?: string
  review_cadence?: string
  /** Per-platform numbers the owner set. Shape validated in @/lib/goals. */
  social_targets?: unknown[]
}

export interface GoalProgress {
  percent: number
  summary: string
  evidence: string[]
  updated_at?: string
}

export interface ActiveGoal {
  id: string
  title: string
  description: string | null
  success_criteria: GoalSuccessCriteria
  progress: GoalProgress
  deadline: string | null
  next_review_at: string | null
}

export interface GoalProgressUpdate {
  percent: number
  summary: string
  evidence: string[]
  status: GoalLifecycleStatus
}

const DEFAULT_REVIEW_HOURS = 24

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
}

function asFinitePercent(value: unknown): number {
  const numeric = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(numeric) ? Math.max(0, Math.min(100, numeric)) : 0
}

export function toActiveGoal(row: Record<string, unknown>): ActiveGoal | null {
  if (typeof row.id !== 'string' || typeof row.title !== 'string') return null

  const criteria = asRecord(row.success_criteria)
  const progress = asRecord(row.progress)
  return {
    id: row.id,
    title: row.title,
    description: typeof row.description === 'string' ? row.description : null,
    success_criteria: {
      outcome: typeof criteria.outcome === 'string' ? criteria.outcome : undefined,
      metric: typeof criteria.metric === 'string' ? criteria.metric : undefined,
      target: typeof criteria.target === 'string' ? criteria.target : undefined,
      baseline: typeof criteria.baseline === 'string' ? criteria.baseline : undefined,
      review_cadence: typeof criteria.review_cadence === 'string' ? criteria.review_cadence : undefined,
      // The owner's per-platform numbers. Dropped here, they could never
      // reach the agent writing the post no matter what was stored.
      social_targets: Array.isArray(criteria.social_targets) ? criteria.social_targets : undefined,
    },
    progress: {
      percent: asFinitePercent(progress.percent),
      summary: typeof progress.summary === 'string' ? progress.summary : 'No verified progress recorded yet.',
      evidence: asStringArray(progress.evidence),
      updated_at: typeof progress.updated_at === 'string' ? progress.updated_at : undefined,
    },
    deadline: typeof row.deadline === 'string' ? row.deadline : null,
    next_review_at: typeof row.next_review_at === 'string' ? row.next_review_at : null,
  }
}

export async function getActiveGoal(
  supabase: SupabaseClient,
  userId: string,
  brandId: string,
): Promise<ActiveGoal | null> {
  const { data, error } = await supabase
    .from('goals')
    .select('id, title, description, success_criteria, progress, deadline, next_review_at')
    .eq('user_id', userId)
    .eq('brand_id', brandId)
    .eq('level', 'objective')
    .eq('status', 'active')
    .maybeSingle()

  if (error) {
    console.error('[goal-loop] Failed to load active goal:', error.message)
    return null
  }

  return data ? toActiveGoal(data as Record<string, unknown>) : null
}

/**
 * Read the owner's stored social targets defensively.
 *
 * Kept here rather than importing the goals module so the prompt layer has no
 * dependency on it — a malformed target is dropped, because a half-read one
 * renders as a confident number that was never set.
 */
function readSocialTargets(raw: unknown): Array<{
  platform: string
  metric: string
  current: number | null
  target: number
  by?: string | null
}> {
  if (!Array.isArray(raw)) return []
  const out: Array<{ platform: string; metric: string; current: number | null; target: number; by?: string | null }> = []
  for (const item of raw) {
    const t = item as Record<string, unknown>
    if (typeof t?.platform !== 'string' || typeof t?.metric !== 'string') continue
    if (typeof t.target !== 'number' || !Number.isFinite(t.target)) continue
    out.push({
      platform: t.platform,
      metric: t.metric,
      target: t.target,
      current: typeof t.current === 'number' && Number.isFinite(t.current) ? t.current : null,
      by: typeof t.by === 'string' ? t.by : null,
    })
  }
  return out
}

/** Platforms whose names are not simply capitalised. */
const PLATFORM_WORDS: Record<string, string> = {
  youtube: 'YouTube',
  tiktok: 'TikTok',
  linkedin: 'LinkedIn',
  x: 'X',
}

/** Read aloud, "1 posts a week" is the kind of slip that makes a system look careless. */
const METRIC_SINGULAR: Record<string, string> = {
  posts_per_week: 'post a week',
  leads: 'enquiry',
}

const METRIC_WORDS: Record<string, string> = {
  followers: 'followers',
  posts_per_week: 'posts a week',
  engagement_rate: 'engagement rate',
  reach: 'people reached',
  leads: 'enquiries',
}

function describeTarget(t: { platform: string; metric: string; current: number | null; target: number; by?: string | null }): string {
  const where = PLATFORM_WORDS[t.platform] ?? t.platform.charAt(0).toUpperCase() + t.platform.slice(1)
  const metric = t.target === 1 && METRIC_SINGULAR[t.metric] ? METRIC_SINGULAR[t.metric] : (METRIC_WORDS[t.metric] ?? t.metric)
  const by = t.by ? ` by ${new Date(t.by).toLocaleDateString('en-AU')}` : ''
  return t.current === null
    ? `${where}: reach ${t.target} ${metric}${by} — not measured yet`
    : `${where}: ${t.current} now, aiming for ${t.target} ${metric}${by}`
}

export function buildGoalDirective(goal: ActiveGoal | null, brandName: string): string {
  if (!goal) {
    return `## NO ACTIVE END-USER OUTCOME — REQUIRED DISCOVERY

${brandName} has no recorded active marketing outcome. Before starting autonomous, delegated, or ongoing work, ask the owner one concise question that establishes the outcome they want most. If their current message already gives a clear outcome, use set_active_goal in this turn, then create one safe goal-linked next task.

- Do not invent a goal, metric, deadline, or success claim for the owner.
- Do not create or delegate ongoing work until an active goal exists.
- Keep helping with a small direct answer when it is safe, but do not turn it into an autonomous workstream until the outcome is recorded.
- Phrase the question in plain language, for example: "What result would make the next 90 days a win for ${brandName}?"`
  }

  const criteria = [
    goal.success_criteria.outcome && `Outcome: ${goal.success_criteria.outcome}`,
    goal.success_criteria.metric && `Measure: ${goal.success_criteria.metric}`,
    goal.success_criteria.target && `Target: ${goal.success_criteria.target}`,
    goal.success_criteria.baseline && `Starting point: ${goal.success_criteria.baseline}`,
    goal.deadline && `Target date: ${new Date(goal.deadline).toLocaleDateString('en-AU')}`,
  ].filter(Boolean)

  // The owner's per-platform numbers, named platform by platform. A goal that
  // says only "grow social" gives an agent writing an Instagram post nothing
  // to aim at; the numbers are the direction, and they are his, not invented.
  const socialTargets = readSocialTargets(goal.success_criteria.social_targets)
  const socialBlock = socialTargets.length > 0
    ? `\n**What each channel is aiming at — set by the owner:**\n${socialTargets.map((t) => `- ${describeTarget(t)}`).join('\n')}\n\nWhen writing for one of these channels, write towards its number. Say which target a piece of work serves. Where a target has never been measured, find where it stands before claiming movement towards it.`
    : ''

  const progressEvidence = goal.progress.evidence.length > 0
    ? `Evidence: ${goal.progress.evidence.join('; ')}`
    : 'Evidence: none recorded yet.'

  return `## ACTIVE END-USER OUTCOME — THE WORKING NORTH STAR

**${goal.title}**
${goal.description ? `${goal.description}\n` : ''}${criteria.join('\n')}
${socialBlock}

Current verified progress: ${goal.progress.percent}% — ${goal.progress.summary}
${progressEvidence}

Every recommendation, task, delegation, and review must advance this outcome or explicitly explain why it does not. Do not mistake busy work for progress. Never claim progress without evidence, and never publish, spend, or make an external commitment without the owner's explicit approval.`
}

export function buildGoalReviewBrief(goal: ActiveGoal): string {
  return `GOAL REVIEW — ${goal.title}

Review the current goal against saved outputs, current analytics, approved project evidence, and completed goal-linked tasks. Do not use generic marketing theory as proof.

You must:
1. Record a progress update with update_goal_progress, including a percentage, concise summary, and evidence.
2. If the goal is not complete, create exactly one next goal-linked task that is the highest-leverage safe action. If evidence is missing or the next action needs a founder choice, request approval instead of guessing.
3. You must not publish, send, spend, or change an external platform during this review without explicit owner approval.

Current recorded progress: ${goal.progress.percent}% — ${goal.progress.summary}`
}

export function validateGoalProgressUpdate(input: GoalProgressUpdate): string | null {
  if (!Number.isFinite(input.percent) || input.percent < 0 || input.percent > 100) {
    return 'Goal progress must be a number from 0 to 100.'
  }
  if (!input.summary.trim()) return 'A goal progress update requires a summary.'
  if (input.status === 'completed' && input.evidence.length === 0) {
    return 'A completed goal requires at least one evidence item.'
  }
  if (input.status === 'completed' && input.percent !== 100) {
    return 'A completed goal must have 100% recorded progress.'
  }
  return null
}

/**
 * A review may either schedule one executable task or surface one owner
 * decision. The heartbeat uses this after the worker has written its records,
 * so a model cannot claim that it advanced an active outcome without leaving
 * an auditable next action behind.
 */
export function validateGoalReviewFollowUp(
  goalStatus: string | null,
  followUpTaskCount: number,
  reviewApprovalCount: number,
): string | null {
  if (goalStatus !== 'active') return null

  const nextActionCount = followUpTaskCount + reviewApprovalCount
  if (nextActionCount === 0) {
    return 'An active goal review must create exactly one goal-linked task or one review-linked approval request.'
  }
  if (nextActionCount > 1) {
    return 'An active goal review created more than one next action; keep exactly one path active.'
  }
  return null
}

export function nextGoalReviewAt(hours = DEFAULT_REVIEW_HOURS): string {
  return new Date(Date.now() + hours * 60 * 60 * 1000).toISOString()
}

export async function markGoalReadyForReview(
  supabase: SupabaseClient,
  userId: string,
  goalId: string,
): Promise<void> {
  const { error } = await supabase
    .from('goals')
    .update({ next_review_at: new Date().toISOString() })
    .eq('id', goalId)
    .eq('user_id', userId)
    .eq('status', 'active')

  if (error) console.error('[goal-loop] Failed to schedule a goal review:', error.message)
}

export async function releaseGoalReviewClaim(
  supabase: SupabaseClient,
  goalId: string,
  nextReviewAt: string,
): Promise<void> {
  const { error } = await supabase
    .from('goals')
    .update({
      review_claimed_at: null,
      review_claim_expires_at: null,
      next_review_at: nextReviewAt,
    })
    .eq('id', goalId)

  if (error) console.error('[goal-loop] Failed to release goal review claim:', error.message)
}

/** Atomically reserves one due review so concurrent cron invocations cannot duplicate it. */
export async function claimDueGoalReview(
  supabase: SupabaseClient,
  goalId: string,
): Promise<ActiveGoal | null> {
  const now = new Date()
  const claimExpiresAt = new Date(now.getTime() + 5 * 60 * 1000).toISOString()
  const { data, error } = await supabase
    .from('goals')
    .update({
      review_claimed_at: now.toISOString(),
      review_claim_expires_at: claimExpiresAt,
    })
    .eq('id', goalId)
    .eq('level', 'objective')
    .eq('status', 'active')
    .lte('next_review_at', now.toISOString())
    .or(`review_claim_expires_at.is.null,review_claim_expires_at.lt.${now.toISOString()}`)
    .select('id, title, description, success_criteria, progress, deadline, next_review_at')
    .maybeSingle()

  if (error) {
    console.error('[goal-loop] Failed to claim due goal review:', error.message)
    return null
  }
  return data ? toActiveGoal(data as Record<string, unknown>) : null
}

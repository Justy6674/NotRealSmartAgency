/**
 * What each project is actually trying to achieve, and how its social channels
 * are meant to get there.
 *
 * Two of the twenty-one plan sections — business goals and the 90-day plan —
 * record the owner's own choices and cannot be researched. The nightly run
 * correctly refuses to invent them, which left them permanently empty because
 * there was nowhere to set them: the goals table exists, the tools exist, and
 * not one row had ever been written.
 *
 * A goal is not a static field. It is set, worked towards, measured, and
 * replaced by a better-informed version — so superseding one keeps the old,
 * rather than overwriting it. Without that the history that shows whether a
 * target was ever met is destroyed by the act of setting the next one.
 */

/** Platforms a social target can be set against. */
export const SOCIAL_PLATFORMS = [
  'instagram',
  'facebook',
  'linkedin',
  'tiktok',
  'youtube',
  'x',
] as const
export type SocialPlatform = (typeof SOCIAL_PLATFORMS)[number]

/** What can be counted. Deliberately short — a metric nobody measures is noise. */
export const SOCIAL_METRICS = [
  'followers',
  'posts_per_week',
  'engagement_rate',
  'reach',
  'leads',
] as const
export type SocialMetric = (typeof SOCIAL_METRICS)[number]

export const METRIC_LABELS: Record<SocialMetric, string> = {
  followers: 'followers',
  posts_per_week: 'posts a week',
  engagement_rate: 'engagement rate',
  reach: 'people reached',
  leads: 'enquiries',
}

export interface SocialTarget {
  platform: SocialPlatform
  metric: SocialMetric
  /** Where it stands now. Null means it has not been measured yet. */
  current: number | null
  target: number
  /** ISO date the target is meant to be met by, when one was given. */
  by?: string | null
}

export interface MarketingGoal {
  id: string
  brandId: string
  /** The outcome in the owner's own words. */
  title: string
  description: string | null
  status: string
  /** Social targets under this goal. */
  targets: SocialTarget[]
  deadline: string | null
  lastReviewedAt: string | null
  nextReviewAt: string | null
  createdAt: string
  /** The goal this one replaced, so the history is walkable. */
  supersedes: string | null
}

/** How long a goal may go unreviewed before it needs looking at. */
export const GOAL_REVIEW_DAYS = 30

// ---------------------------------------------------------------------------

function daysBetween(iso: string, now: Date): number {
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return 0
  return Math.floor((now.getTime() - then) / (24 * 60 * 60 * 1000))
}

/**
 * How far along a target is, as a fraction.
 *
 * An unmeasured target reports null rather than zero. Zero says "no progress",
 * which is a claim; null says "not measured", which is the truth — and the two
 * lead to different decisions.
 */
export function targetProgress(target: SocialTarget): number | null {
  if (target.current === null) return null
  if (target.target <= 0) return null
  return Math.min(1, Math.max(0, target.current / target.target))
}

/**
 * Overall progress across a goal's targets.
 *
 * Unmeasured targets are excluded rather than counted as zero, so a goal with
 * one measured target at 80% does not read as 20% because three others have
 * never been counted.
 */
export function goalProgress(goal: Pick<MarketingGoal, 'targets'>): {
  percent: number | null
  measured: number
  total: number
} {
  const total = goal.targets.length
  const scores = goal.targets.map(targetProgress).filter((p): p is number => p !== null)

  return {
    percent: scores.length === 0 ? null : Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 100),
    measured: scores.length,
    total,
  }
}

export type GoalAttention =
  | { kind: 'none' }
  | { kind: 'not_set' }
  | { kind: 'never_measured' }
  | { kind: 'due_for_review'; daysOverdue: number }
  | { kind: 'deadline_passed'; daysPast: number }

/**
 * Whether a project's goal needs the owner.
 *
 * Ordered by consequence: no goal at all outranks an unmeasured one, which
 * outranks a passed deadline, which outranks a routine review.
 */
export function goalAttention(goal: MarketingGoal | null, now: Date): GoalAttention {
  if (!goal) return { kind: 'not_set' }

  const progress = goalProgress(goal)
  if (goal.targets.length > 0 && progress.measured === 0) return { kind: 'never_measured' }

  if (goal.deadline) {
    const past = daysBetween(goal.deadline, now)
    if (past > 0) return { kind: 'deadline_passed', daysPast: past }
  }

  const reviewAnchor = goal.lastReviewedAt ?? goal.createdAt
  const age = daysBetween(reviewAnchor, now)
  if (age > GOAL_REVIEW_DAYS) {
    return { kind: 'due_for_review', daysOverdue: age - GOAL_REVIEW_DAYS }
  }

  return { kind: 'none' }
}

/** One line for a project tile. Plain language, no jargon. */
export function summariseGoal(goal: MarketingGoal | null): string {
  if (!goal) return 'No goal set'

  const progress = goalProgress(goal)
  if (goal.targets.length === 0) return goal.title
  if (progress.percent === null) return `${goal.title} — not measured yet`
  return `${goal.title} — ${progress.percent}% there`
}

/** A social target as a sentence, for the tile and for an AI reading the brief. */
export function describeTarget(target: SocialTarget): string {
  const metric = METRIC_LABELS[target.metric]
  const where = target.platform.charAt(0).toUpperCase() + target.platform.slice(1)
  const by = target.by ? ` by ${new Date(target.by).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}` : ''

  return target.current === null
    ? `${where}: ${target.target} ${metric}${by} — not measured yet`
    : `${where}: ${target.current} of ${target.target} ${metric}${by}`
}

/**
 * What to say to the Director about a goal needing attention.
 *
 * Written as something the owner would say, because it is handed to the
 * Director as his words when he clicks the row.
 */
export function attentionAction(
  attention: GoalAttention,
  projectName: string,
  goal: MarketingGoal | null,
): string | null {
  switch (attention.kind) {
    case 'not_set':
      return `${projectName} has no marketing goal set. Ask me what I want this business to achieve, suggest what good social media targets would look like for it, and save them once I agree.`
    case 'never_measured':
      return `${projectName}'s goal is "${goal?.title}" but none of its targets have ever been measured. Find where each one stands now and record it.`
    case 'deadline_passed':
      return `${projectName}'s goal "${goal?.title}" passed its date ${attention.daysPast} days ago. Tell me honestly whether it was met, then help me set the next one.`
    case 'due_for_review':
      return `${projectName}'s goal "${goal?.title}" has not been looked at in over a month. Show me where the targets stand and whether the goal is still the right one.`
    case 'none':
      return null
  }
}

/**
 * Read a stored goal row into the shape used everywhere else.
 *
 * Targets live in `success_criteria.social_targets`. Anything malformed is
 * dropped rather than shown, because a half-read target renders as a
 * confident number that is not real.
 */
export function readGoalRow(row: {
  id: string
  brand_id: string | null
  title: string
  description: string | null
  status: string
  success_criteria?: Record<string, unknown> | null
  deadline: string | null
  last_reviewed_at: string | null
  next_review_at: string | null
  created_at: string
  parent_id: string | null
}): MarketingGoal {
  const raw = (row.success_criteria?.social_targets ?? []) as unknown[]

  const targets: SocialTarget[] = []
  for (const item of Array.isArray(raw) ? raw : []) {
    const t = item as Record<string, unknown>
    if (!SOCIAL_PLATFORMS.includes(t.platform as SocialPlatform)) continue
    if (!SOCIAL_METRICS.includes(t.metric as SocialMetric)) continue
    if (typeof t.target !== 'number' || !Number.isFinite(t.target)) continue

    targets.push({
      platform: t.platform as SocialPlatform,
      metric: t.metric as SocialMetric,
      target: t.target,
      current: typeof t.current === 'number' && Number.isFinite(t.current) ? t.current : null,
      by: typeof t.by === 'string' ? t.by : null,
    })
  }

  return {
    id: row.id,
    brandId: row.brand_id ?? '',
    title: row.title,
    description: row.description,
    status: row.status,
    targets,
    deadline: row.deadline,
    lastReviewedAt: row.last_reviewed_at,
    nextReviewAt: row.next_review_at,
    createdAt: row.created_at,
    supersedes: row.parent_id,
  }
}

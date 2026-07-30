'use client'

import { useState } from 'react'
import { Plus, Target, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  METRIC_LABELS,
  SOCIAL_METRICS,
  SOCIAL_PLATFORMS,
  describeTarget,
  goalProgress,
  type MarketingGoal,
  type SocialMetric,
  type SocialPlatform,
  type SocialTarget,
} from '@/lib/goals/marketing-goals'

const PLATFORM_LABELS: Record<SocialPlatform, string> = {
  instagram: 'Instagram',
  facebook: 'Facebook',
  linkedin: 'LinkedIn',
  tiktok: 'TikTok',
  youtube: 'YouTube',
  x: 'X',
}

/**
 * Setting and reading one project's marketing goal.
 *
 * Deliberately a form rather than a conversation. The goal is the one thing
 * that is genuinely the owner's to state, and asking him to negotiate it
 * through chat every time he wants to change a number would be slower than
 * typing the number.
 */
export function GoalCard({
  projectId,
  projectName,
  goal,
  onSaved,
  onAskDirector,
}: {
  projectId: string
  projectName: string
  goal: MarketingGoal | null
  onSaved: () => void
  onAskDirector: (text: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const [title, setTitle] = useState(goal?.title ?? '')
  const [deadline, setDeadline] = useState(goal?.deadline?.slice(0, 10) ?? '')
  const [targets, setTargets] = useState<SocialTarget[]>(goal?.targets ?? [])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const progress = goal ? goalProgress(goal) : null

  const save = async () => {
    if (title.trim().length < 3) {
      setError('Give the goal a name first — what would make this a win?')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/goals/marketing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brandId: projectId,
          title: title.trim(),
          deadline: deadline || null,
          targets: targets.filter((t) => t.target > 0),
        }),
      })
      if (!res.ok) throw new Error('save failed')
      setEditing(false)
      onSaved()
    } catch {
      setError('That did not save. Try again in a moment.')
    } finally {
      setSaving(false)
    }
  }

  if (!editing) {
    return (
      <div className="rounded-lg border bg-card p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              <Target className="h-3.5 w-3.5" /> What {projectName} is aiming at
            </p>
            {goal ? (
              <p className="mt-1.5 text-sm font-medium text-foreground">{goal.title}</p>
            ) : (
              <p className="mt-1.5 text-sm text-muted-foreground">
                Nothing set yet — so nothing written for this project is aimed anywhere.
              </p>
            )}
          </div>
          <button
            onClick={() => setEditing(true)}
            className="shrink-0 rounded-md border px-2.5 py-1 text-xs hover:bg-accent"
          >
            {goal ? 'Change' : 'Set a goal'}
          </button>
        </div>

        {goal && goal.targets.length > 0 && (
          <ul className="mt-3 space-y-1.5">
            {goal.targets.map((t, i) => (
              <li key={i} className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="h-1 w-1 shrink-0 rounded-full bg-muted-foreground/50" />
                {describeTarget(t)}
              </li>
            ))}
          </ul>
        )}

        {goal && progress && (
          <div className="mt-3 flex items-center gap-3">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-emerald-500 transition-all"
                style={{ width: `${progress.percent ?? 0}%` }}
              />
            </div>
            <span className="shrink-0 text-xs text-muted-foreground">
              {progress.percent === null
                ? 'not measured'
                : `${progress.percent}% · ${progress.measured} of ${progress.total} measured`}
            </span>
          </div>
        )}

        {goal && (
          <button
            onClick={() =>
              onAskDirector(
                `Where do ${projectName}'s social targets actually stand right now? Check each one, tell me the real numbers, and say honestly whether we are on track for "${goal.title}".`,
              )
            }
            className="mt-3 text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
          >
            Check where these really stand
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          What {projectName} is aiming at
        </p>
        <button onClick={() => setEditing(false)} className="text-muted-foreground hover:text-foreground">
          <X className="h-4 w-4" />
        </button>
      </div>

      <label className="mt-3 block text-xs text-muted-foreground">
        What would make this a win?
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Fill the telehealth calendar every week"
          className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm text-foreground"
        />
      </label>

      <label className="mt-3 block text-xs text-muted-foreground">
        By when (optional)
        <input
          type="date"
          value={deadline}
          onChange={(e) => setDeadline(e.target.value)}
          className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm text-foreground"
        />
      </label>

      <p className="mt-4 text-xs font-medium text-foreground">Social targets</p>
      <p className="text-xs text-muted-foreground">
        Every post written for this project is aimed at these.
      </p>

      <div className="mt-2 space-y-2">
        {targets.map((t, i) => (
          <div key={i} className="flex flex-wrap items-center gap-1.5">
            <select
              value={t.platform}
              onChange={(e) =>
                setTargets(targets.map((x, j) => (j === i ? { ...x, platform: e.target.value as SocialPlatform } : x)))
              }
              className="rounded-md border bg-background px-2 py-1.5 text-xs"
            >
              {SOCIAL_PLATFORMS.map((p) => (
                <option key={p} value={p}>{PLATFORM_LABELS[p]}</option>
              ))}
            </select>
            <select
              value={t.metric}
              onChange={(e) =>
                setTargets(targets.map((x, j) => (j === i ? { ...x, metric: e.target.value as SocialMetric } : x)))
              }
              className="rounded-md border bg-background px-2 py-1.5 text-xs"
            >
              {SOCIAL_METRICS.map((m) => (
                <option key={m} value={m}>{METRIC_LABELS[m]}</option>
              ))}
            </select>
            <input
              type="number"
              min={0}
              value={t.current ?? ''}
              placeholder="now"
              onChange={(e) =>
                setTargets(targets.map((x, j) =>
                  j === i ? { ...x, current: e.target.value === '' ? null : Number(e.target.value) } : x,
                ))
              }
              className="w-20 rounded-md border bg-background px-2 py-1.5 text-xs"
            />
            <span className="text-xs text-muted-foreground">→</span>
            <input
              type="number"
              min={1}
              value={t.target || ''}
              placeholder="target"
              onChange={(e) =>
                setTargets(targets.map((x, j) => (j === i ? { ...x, target: Number(e.target.value) } : x)))
              }
              className="w-20 rounded-md border bg-background px-2 py-1.5 text-xs"
            />
            <button
              onClick={() => setTargets(targets.filter((_, j) => j !== i))}
              className="text-muted-foreground hover:text-foreground"
              aria-label="Remove this target"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>

      <button
        onClick={() =>
          setTargets([...targets, { platform: 'instagram', metric: 'followers', current: null, target: 0 }])
        }
        className="mt-2 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
      >
        <Plus className="h-3.5 w-3.5" /> Add a target
      </button>

      {error && <p className="mt-3 text-xs text-red-600 dark:text-red-400">{error}</p>}

      <div className="mt-4 flex items-center gap-2">
        <button
          onClick={save}
          disabled={saving}
          className={cn(
            'rounded-md bg-foreground px-3 py-1.5 text-xs font-medium text-background',
            saving && 'opacity-60',
          )}
        >
          {saving ? 'Saving…' : goal ? 'Save as the new goal' : 'Set this goal'}
        </button>
        <button
          onClick={() =>
            onAskDirector(
              `Help me set a marketing goal for ${projectName}. Ask me what I want, then suggest what good social targets would look like for a business like this — with real numbers — and tell me why each one.`,
            )
          }
          className="text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
        >
          Help me decide
        </button>
      </div>

      {goal && (
        <p className="mt-3 text-xs text-muted-foreground">
          The previous goal is kept, so you can see how the aim has changed over time.
        </p>
      )}
    </div>
  )
}

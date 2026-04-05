'use client'

import { useState } from 'react'
import { Rocket, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAgencyStore } from '@/stores/agency-store'
import { useStudioData } from '@/hooks/useStudioData'
import { useStrategyContext } from '@/hooks/useStrategyContext'

export type CampaignDuration = '1_week' | '2_weeks' | '1_month' | '3_months'

export interface CampaignBriefData {
  name: string
  goal: string
  duration: CampaignDuration
  audience: string
}

const DURATION_OPTIONS: { value: CampaignDuration; label: string }[] = [
  { value: '1_week', label: '1 week' },
  { value: '2_weeks', label: '2 weeks' },
  { value: '1_month', label: '1 month' },
  { value: '3_months', label: '3 months' },
]

interface CampaignBriefProps {
  onSubmit: (brief: CampaignBriefData) => void
  isSubmitting: boolean
}

export function CampaignBrief({ onSubmit, isSubmitting }: CampaignBriefProps) {
  const { activeBrandId } = useAgencyStore()
  const data = useStudioData(activeBrandId)
  const strategyContext = useStrategyContext(data.brand, data.posts, data.accounts)

  // Pre-fill audience from brand data
  const defaultAudience = data.brand?.target_audience
    ? typeof data.brand.target_audience === 'string'
      ? data.brand.target_audience
      : JSON.stringify(data.brand.target_audience)
    : ''

  const [name, setName] = useState('')
  const [goal, setGoal] = useState('')
  const [duration, setDuration] = useState<CampaignDuration>('1_month')
  const [audience, setAudience] = useState(defaultAudience)

  const canSubmit = name.trim().length > 0 && goal.trim().length > 0 && !isSubmitting

  function handleSubmit() {
    if (!canSubmit) return
    onSubmit({ name: name.trim(), goal: goal.trim(), duration, audience: audience.trim() })
  }

  return (
    <div className="rounded-xl border border-border bg-card p-6 space-y-5">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/15 text-amber-400">
          <Rocket className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-base font-semibold text-foreground">Campaign Brief</h2>
          <p className="text-xs text-muted-foreground">
            Describe your campaign and the Director will convene all departments.
          </p>
        </div>
      </div>

      {/* Campaign name */}
      <div className="space-y-1.5">
        <label htmlFor="campaign-name" className="text-xs font-medium text-foreground/80">
          Campaign name
        </label>
        <input
          id="campaign-name"
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="e.g. Winter Weight Loss Launch"
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary/40"
        />
      </div>

      {/* Goal description */}
      <div className="space-y-1.5">
        <label htmlFor="campaign-goal" className="text-xs font-medium text-foreground/80">
          What do you want to achieve?
        </label>
        <textarea
          id="campaign-goal"
          value={goal}
          onChange={e => setGoal(e.target.value)}
          rows={3}
          placeholder="e.g. Launch our new weight loss program to 25-45 year old professionals. Drive 200 bookings in the first month."
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 resize-none focus:outline-none focus:ring-1 focus:ring-primary/40"
        />
      </div>

      {/* Duration + Audience row */}
      <div className="grid gap-4 sm:grid-cols-2">
        {/* Duration */}
        <div className="space-y-1.5">
          <label htmlFor="campaign-duration" className="text-xs font-medium text-foreground/80">
            Duration
          </label>
          <div className="relative">
            <select
              id="campaign-duration"
              value={duration}
              onChange={e => setDuration(e.target.value as CampaignDuration)}
              className="w-full appearance-none rounded-lg border border-border bg-background px-3 py-2 pr-8 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary/40"
            >
              {DURATION_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          </div>
        </div>

        {/* Target audience */}
        <div className="space-y-1.5">
          <label htmlFor="campaign-audience" className="text-xs font-medium text-foreground/80">
            Target audience
          </label>
          <input
            id="campaign-audience"
            type="text"
            value={audience}
            onChange={e => setAudience(e.target.value)}
            placeholder="Pre-filled from brand data"
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary/40"
          />
        </div>
      </div>

      {/* Strategy nudge */}
      {strategyContext && (
        <p className="text-[11px] text-muted-foreground italic">
          Strategy hint: {strategyContext.suggestion}
        </p>
      )}

      {/* Submit */}
      <button
        onClick={handleSubmit}
        disabled={!canSubmit}
        className={cn(
          'w-full rounded-lg px-4 py-2.5 text-sm font-semibold transition-all',
          canSubmit
            ? 'bg-primary text-primary-foreground hover:bg-primary/90 cursor-pointer'
            : 'bg-muted text-muted-foreground cursor-not-allowed'
        )}
      >
        {isSubmitting ? 'Convening departments...' : 'Plan Campaign'}
      </button>
    </div>
  )
}

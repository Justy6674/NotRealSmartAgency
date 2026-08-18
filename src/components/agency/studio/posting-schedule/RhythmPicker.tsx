'use client'

import * as React from 'react'
import { Check, Loader2, Sparkles } from 'lucide-react'

import { cn } from '@/lib/utils'
import {
  DAY_NAMES_SHORT,
  RHYTHMS,
  buildWeek,
  friendlyTime,
  joinNames,
  weekMatches,
  weeklyCount,
  type AudienceRhythm,
  type WeekTime,
} from './rhythms'

/**
 * Pick a rhythm — the first thing on the screen and, for most weeks, the last.
 *
 * Every card shows the times it will actually set and how many posts a week
 * that is, because "four times a day" without the times is a promise the owner
 * has to click to check. One click sets the whole week and saves it. Nothing
 * here is pre-selected and nothing is written until a card is pressed.
 *
 * The cards are large and obvious while the week is empty, and shrink to a
 * quiet row once it is not — at that point the grid below is what matters and
 * this is just the way back to a clean start.
 */

export interface RhythmPickerProps {
  /** The week already saved, so a card can show it is the one in force. */
  saved: readonly WeekTime[]
  /** This business's own results, or null when there is not enough to be honest. */
  audience: AudienceRhythm | null
  /** Owner-facing names of everywhere a time posts. */
  accountNames: readonly string[]
  /** Which card is mid-save, by id. */
  applying: string | null
  /** Big when the week is empty: this is the whole screen until it is not. */
  prominent: boolean
  onApply: (id: string, name: string, times: WeekTime[]) => void
}

export function RhythmPicker({
  saved,
  audience,
  accountNames,
  applying,
  prominent,
  onApply,
}: RhythmPickerProps) {
  const audienceTimes = audience?.times ?? []

  return (
    <section aria-labelledby="rhythm-heading" className="space-y-3">
      <div>
        <h2 id="rhythm-heading" className="text-base font-semibold text-foreground">
          {prominent ? 'Pick a rhythm to start' : 'Change your rhythm'}
        </h2>
        <p className="mt-1 max-w-2xl text-[13px] text-muted-foreground">
          {prominent
            ? 'One click sets your whole week. You can move, add or remove any time afterwards.'
            : 'One click replaces the week below. Everything on it can still be changed by hand.'}
        </p>
      </div>

      <div
        className={cn(
          'grid gap-3',
          prominent ? 'sm:grid-cols-2 xl:grid-cols-3' : 'sm:grid-cols-2 xl:grid-cols-3',
        )}
      >
        {RHYTHMS.map((rhythm) => {
          const times = buildWeek(rhythm)
          return (
            <RhythmCard
              key={rhythm.id}
              name={rhythm.name}
              blurb={rhythm.blurb}
              timeLabels={rhythm.times.map(friendlyTime)}
              daysLabel={rhythm.daysLabel}
              perWeek={weeklyCount(rhythm)}
              inForce={saved.length > 0 && weekMatches(saved, times)}
              busy={applying === rhythm.id}
              disabled={applying !== null}
              prominent={prominent}
              onApply={() => onApply(rhythm.id, rhythm.name, times)}
            />
          )
        })}

        {/*
          The fifth option only exists when this business's own results can
          carry it. `audienceRhythm` returns null rather than a thin week, so
          there is deliberately no "not enough data yet" placeholder here —
          an empty promise on the screen is worse than one fewer card.
        */}
        {audience && (
          <RhythmCard
            name="What works for your audience"
            blurb={
              accountNames.length > 0
                ? `Worked out from ${audience.postsCounted} posts you have already published on ${joinNames(accountNames)}.`
                : `Worked out from ${audience.postsCounted} posts you have already published.`
            }
            timeLabels={audienceTimes.map(
              (slot) => `${DAY_NAMES_SHORT[slot.day_of_week]} ${friendlyTime(slot.time)}`,
            )}
            daysLabel={
              audience.daysCovered === 7 ? 'Every day' : `${audience.daysCovered} days a week`
            }
            perWeek={audienceTimes.length}
            inForce={saved.length > 0 && weekMatches(saved, audienceTimes)}
            busy={applying === 'audience'}
            disabled={applying !== null}
            prominent={prominent}
            measured
            onApply={() => onApply('audience', 'What works for your audience', audienceTimes)}
          />
        )}
      </div>
    </section>
  )
}

interface RhythmCardProps {
  name: string
  blurb: string
  timeLabels: string[]
  daysLabel: string
  perWeek: number
  inForce: boolean
  busy: boolean
  disabled: boolean
  prominent: boolean
  /** True only for the card built from real results — it is styled apart. */
  measured?: boolean
  onApply: () => void
}

function RhythmCard({
  name,
  blurb,
  timeLabels,
  daysLabel,
  perWeek,
  inForce,
  busy,
  disabled,
  prominent,
  measured = false,
  onApply,
}: RhythmCardProps) {
  return (
    <button
      type="button"
      onClick={onApply}
      disabled={disabled}
      aria-pressed={inForce}
      className={cn(
        'group flex w-full flex-col items-start gap-2 rounded-xl border text-left transition-shadow',
        prominent ? 'p-4' : 'p-3',
        'hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        disabled && !busy ? 'opacity-60' : '',
      )}
      style={{
        borderColor: inForce ? 'var(--brand, var(--border))' : 'var(--line, var(--border))',
        background: measured || inForce ? 'var(--brand-wash, transparent)' : 'var(--card, transparent)',
        boxShadow: inForce ? '0 0 0 1px var(--brand, transparent) inset' : undefined,
      }}
    >
      <div className="flex w-full items-start justify-between gap-2">
        <span
          className={cn(
            'flex items-center gap-1.5 font-semibold text-foreground',
            prominent ? 'text-[15px]' : 'text-sm',
          )}
        >
          {measured && (
            <Sparkles className="size-4 shrink-0" style={{ color: 'var(--brand-deep, currentColor)' }} />
          )}
          {name}
        </span>
        {busy ? (
          <Loader2 className="size-4 shrink-0 animate-spin text-muted-foreground" />
        ) : inForce ? (
          <span
            className="flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-semibold"
            style={{ background: 'var(--brand, currentColor)', color: 'var(--brand-ink, white)' }}
          >
            <Check className="size-3" />
            In use
          </span>
        ) : null}
      </div>

      <p className="text-[12.5px] leading-snug text-muted-foreground">{blurb}</p>

      {/* The actual times, so the name is checkable without clicking it. */}
      <ul className="flex flex-wrap gap-1">
        {timeLabels.map((label) => (
          <li
            key={label}
            className="rounded-md border px-1.5 py-0.5 font-mono text-[11px] tabular-nums text-foreground"
            style={{
              borderColor: 'var(--line, var(--border))',
              background: 'var(--panel, var(--background))',
            }}
          >
            {label}
          </li>
        ))}
      </ul>

      <p className="mt-auto pt-1 text-[11.5px] text-muted-foreground">
        {daysLabel} · <span className="tabular-nums">{perWeek}</span>{' '}
        {perWeek === 1 ? 'post' : 'posts'} a week
      </p>
    </button>
  )
}

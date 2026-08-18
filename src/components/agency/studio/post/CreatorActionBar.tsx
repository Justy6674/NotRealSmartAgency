'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { PostPlatform } from '@/types/database'
import { PLATFORM_BRAND_COLOURS } from '@/lib/mixpost/ui-tokens'
import { zonedDateTimeToUtc } from '@/lib/posting-queue/assign-to-slot'
import { describePostingTime, isInThePast } from '@/lib/posting-queue/next-free-time'

/**
 * Status dot colours — per DESIGN.md locked to dept-social.html.
 * These are literal oklch values, not CSS variables, so they work
 * without `--st-*` being defined globally in the work column.
 */
const ST_DRAFT   = 'oklch(0.62 0.012 240)'
const ST_SENDING = 'oklch(0.72 0.15 70)'
/** Autosave landed. The lime dot from the reference desk, at NRS's chroma. */
const ST_SAVED   = 'oklch(0.68 0.16 145)'
/** Autosave did not land. The one state that must never look like "Draft". */
const ST_FAILED  = 'oklch(0.55 0.20 25)'

/** Fallback if --brand-deep / --brand / --brand-ink are not yet in the cascade */
const BD_FALLBACK  = 'oklch(0.33 0.08 240)'
const B_FALLBACK   = 'oklch(0.545 0.115 240)'
const INK_FALLBACK = 'oklch(1 0 0)'

const DEFAULT_TIMEZONE = 'Australia/Brisbane'

/**
 * The business's next free posting time, already resolved on the server.
 *
 * Resolved there and not here because the answer depends on what is already
 * scheduled, which the browser has no list of. See
 * `/api/posting-schedule/next-free-time`.
 */
export interface NextFreeTimeView {
  /** False means no posting times are set at all — offer to go and set some. */
  hasTimes: boolean
  when: string | null
  /** "Tuesday 9:00am", in the business's own time zone. */
  label: string | null
  slotId: string | null
  slotIdByPlatform: Record<string, string>
  timezone: string
  /** What to say when there is no time to offer. */
  message: string | null
  setTimesHref: string
}

/** The posting time a scheduled post is taking, so its row can own it. */
export interface QueueSlotChoice {
  slotId: string | null
  slotIdByPlatform: Record<string, string>
}

interface CreatorActionBarProps {
  platforms: PostPlatform[]
  /**
   * Where the 300ms debounced autosave got to. This dot is the whole reason
   * there is no "everything is saved, honest" claim anywhere else on the bar:
   * an autosave that failed and a draft that has never been touched must not
   * look the same, which is what a single grey dot used to do.
   */
  autosaveState?: 'idle' | 'saving' | 'saved' | 'failed'
  captionEmpty: boolean
  compliancePassed: boolean | null
  saving: boolean
  onSave: (
    mode: 'draft' | 'schedule' | 'now',
    scheduledAt?: string,
    queueSlot?: QueueSlotChoice,
  ) => void
  editMode?: boolean
  /**
   * The next free posting time, or null while it is still being read.
   *
   * THE FAULT this replaced: the bar took a bare ISO string, worked out nothing
   * about whether that time was already taken, and when there was no schedule
   * at all it simply greyed the button out with a tooltip. A disabled button
   * with no explanation is indistinguishable from a broken one — and it was the
   * only route to a posting time that did not require picking a date by hand.
   */
  nextFree?: NextFreeTimeView | null
  savedAt?: string | null
  /** datetime-local value the Director (or calendar) already chose */
  scheduledWhen?: string
  onScheduledWhenChange?: (value: string) => void
}

/** "Australia/Brisbane" → "Brisbane". The owner does not think in IANA. */
function placeOf(timezone: string): string {
  const tail = timezone.split('/').pop() ?? timezone
  return tail.replace(/_/g, ' ')
}

/**
 * An instant, written as the wall clock the picker shows.
 *
 * Formatting only — the reverse trip (what the owner typed, as an instant) is
 * `zonedDateTimeToUtc`, which is shared with the weekly-times arithmetic rather
 * than reimplemented here.
 */
function toZonedInputValue(iso: string, timezone: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  const parts = new Intl.DateTimeFormat('en-AU', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date)
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? ''
  return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}`
}

/**
 * What the owner typed, as a real instant in the business's time zone.
 *
 * 9:00 typed here means 9:00 where the business is, not 9:00 on whichever
 * clock the laptop happens to be set to. Returns null for a half-typed value,
 * which is what keeps the Schedule button off until there is a real time.
 */
function fromZonedInputValue(value: string, timezone: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(value)
  if (!match) return null
  const [, year, month, day, hour, minute] = match
  return zonedDateTimeToUtc(
    Number(year),
    Number(month),
    Number(day),
    Number(hour),
    Number(minute),
    0,
    timezone,
  )
}

/**
 * Pinned action bar — every primary action is a button you press.
 *
 * Layout from dept-social.html: state indicator (dot + "Draft" + saved time)
 * on the left, four buttons on the right. Health gate strip sits above the
 * row when compliance has explicitly failed.
 *
 * Tokens: desk surfaces (--bg, --panel, --line, --ink*) and brand accents
 * (--brand-deep, --brand, --brand-ink) come from the shell layout and retint
 * with the selected business's stored website palette. Never shadcn --border.
 */
export function CreatorActionBar({
  platforms,
  autosaveState = 'idle',
  captionEmpty,
  compliancePassed,
  saving,
  onSave,
  editMode,
  nextFree,
  savedAt,
  scheduledWhen,
  onScheduledWhenChange,
}: CreatorActionBarProps) {
  const timezone = nextFree?.timezone || DEFAULT_TIMEZONE
  const [pickingTime, setPickingTime] = useState(() => Boolean(scheduledWhen))
  const [when, setWhen] = useState(() => scheduledWhen ?? '')
  /** The time this post was just put on, so the press is answered in words. */
  const [scheduledFor, setScheduledFor] = useState<string | null>(null)
  const disabled = saving || captionEmpty
  const blockedByHealth = compliancePassed === false

  useEffect(() => {
    if (!scheduledWhen) return
    setWhen(scheduledWhen)
    setPickingTime(true)
  }, [scheduledWhen])

  // Opening the picker with nothing in it made the owner type a whole date from
  // scratch. It starts on their next free posting time when they have one, so
  // the common answer is already in the box and only needs nudging.
  useEffect(() => {
    if (!pickingTime || when) return
    const seed = nextFree?.when ?? new Date(Date.now() + 3_600_000).toISOString()
    setWhen(toZonedInputValue(seed, timezone))
  }, [pickingTime, when, nextFree?.when, timezone])

  const chosen = useMemo(() => fromZonedInputValue(when, timezone), [when, timezone])
  const chosenIsPast = chosen ? isInThePast(chosen) : false

  const nextLabel = nextFree?.label ?? null
  const hasFreeTime = Boolean(nextFree?.when && nextLabel)

  return (
    <div className="shrink-0">
      {/* ── Health gate ────────────────────────────────────────────────── */}
      {blockedByHealth && (
        <div
          className="flex items-center gap-[9px] px-[26px] py-[8px] text-[12px]"
          style={{
            background: 'var(--care-wash, oklch(0.965 0.028 25))',
            borderBottom: '1px solid var(--care-line, oklch(0.89 0.050 25))',
            color: 'var(--ink-2, oklch(0.46 0.012 240))',
          }}
        >
          <span style={{ color: 'var(--care, oklch(0.52 0.150 25))', flexShrink: 0 }} aria-hidden>⚕</span>
          <span>
            <b style={{ color: 'var(--care, oklch(0.52 0.150 25))', fontWeight: 650 }}>
              Health rules apply — this wording needs to pass before it can go out.
            </b>{' '}
            Fix the flagged text or image and it will be checked again.
          </span>
        </div>
      )}

      {/* ── Action row ─────────────────────────────────────────────────── */}
      <div className="flex items-center gap-[14px] px-[26px] py-[11px] flex-wrap">

        {/* Left — state indicator */}
        <div
          className="flex flex-1 min-w-0 items-center gap-[8px] overflow-hidden whitespace-nowrap text-[12px]"
          style={{ color: 'var(--ink-3, oklch(0.615 0.011 240))' }}
        >
          {/* 9 px status dot — the saved-state indicator, not decoration */}
          <span
            className="h-[9px] w-[9px] shrink-0 rounded-full"
            aria-hidden
            style={{
              background:
                saving || autosaveState === 'saving' ? ST_SENDING
                : autosaveState === 'failed' ? ST_FAILED
                : autosaveState === 'saved' ? ST_SAVED
                : ST_DRAFT,
            }}
          />
          <b style={{ color: 'var(--ink-2, oklch(0.46 0.012 240))', fontWeight: 600 }}>
            {saving || autosaveState === 'saving' ? 'Saving…' : 'Draft'}
          </b>
          {!saving && autosaveState !== 'saving' && (
            <>
              <span aria-hidden>·</span>
              <span className="truncate">
                {autosaveState === 'failed'
                  ? 'That last change is not saved yet. Your words are still here.'
                  : scheduledFor
                    ? `Going out ${scheduledFor}. You can still change it.`
                    : savedAt
                      ? `Saved ${savedAt}. Nothing has gone out.`
                      : 'Nothing has gone out.'}
              </span>
            </>
          )}
          {/* Platform colour dots — account identity, not status */}
          {platforms.length > 0 && (
            <span className="ml-[6px] flex shrink-0 items-center gap-[4px]" aria-hidden>
              {platforms.map((p) => (
                <span
                  key={p}
                  className="h-[7px] w-[7px] rounded-full"
                  title={p}
                  style={{
                    background:
                      PLATFORM_BRAND_COLOURS[p as keyof typeof PLATFORM_BRAND_COLOURS] ??
                      'oklch(0.7 0 0)',
                  }}
                />
              ))}
            </span>
          )}
        </div>

        {/* Right — buttons */}
        <div className="flex shrink-0 flex-wrap items-center gap-[9px]">

          {/* Save draft — the press that CREATES the row. Everything after it
              is autosaved, which is what the dot on the left reports. */}
          <button
            type="button"
            onClick={() => onSave('draft')}
            disabled={disabled}
            className={cn(
              'inline-flex shrink-0 items-center gap-[6px]',
              'rounded-[8px] border px-[14px] py-[9px] text-[13px] font-[500]',
              'transition-colors duration-150',
              'disabled:cursor-not-allowed disabled:opacity-40',
            )}
            style={{
              borderColor: 'var(--line, oklch(0.915 0.007 240))',
              background: 'var(--panel, oklch(1 0 0))',
              color: 'var(--ink, oklch(0.20 0.014 240))',
            }}
          >
            {saving ? <Loader2 className="h-[14px] w-[14px] animate-spin" /> : null}
            {editMode ? 'Update draft' : 'Save draft'}
          </button>

          {/*
            Add to next free time.

            The time is ON the button, not in a tooltip: pressing something
            called "next free time" without being told which time that is asks
            the owner to trust a machine about a decision they are responsible
            for. When there is no time to offer, the button stops being a
            scheduling button and becomes the way to go and set one — a dead
            grey button was the old behaviour and it taught nobody anything.
          */}
          {hasFreeTime ? (
            <button
              type="button"
              onClick={() => {
                if (!nextFree?.when || !nextLabel) return
                if (!window.confirm(`Schedule this post for ${nextLabel}, ${placeOf(timezone)} time?`)) return
                onSave('schedule', nextFree.when, {
                  slotId: nextFree.slotId,
                  slotIdByPlatform: nextFree.slotIdByPlatform,
                })
                setScheduledFor(nextLabel)
              }}
              disabled={disabled}
              className={cn(
                'inline-flex shrink-0 flex-col items-start',
                'rounded-[8px] border px-[14px] py-[6px] text-[13px] font-[500]',
                'transition-colors duration-150',
                'disabled:cursor-not-allowed disabled:opacity-40',
              )}
              style={{
                borderColor: 'var(--line, oklch(0.915 0.007 240))',
                background: 'var(--panel, oklch(1 0 0))',
                color: 'var(--ink, oklch(0.20 0.014 240))',
              }}
            >
              <span>Add to next free time</span>
              <span
                className="text-[11px] font-[600] leading-[14px]"
                style={{ color: `var(--brand-deep, ${BD_FALLBACK})` }}
              >
                {nextLabel}
              </span>
            </button>
          ) : nextFree ? (
            <Link
              href={nextFree.setTimesHref}
              className={cn(
                'inline-flex shrink-0 items-center gap-[6px]',
                'rounded-[8px] border px-[14px] py-[9px] text-[13px] font-[500]',
                'transition-colors duration-150',
              )}
              style={{
                borderColor: `var(--brand, ${B_FALLBACK})`,
                background: 'var(--panel, oklch(1 0 0))',
                color: `var(--brand-deep, ${BD_FALLBACK})`,
              }}
              title={nextFree.message ?? undefined}
            >
              {nextFree.hasTimes ? 'Add another posting time' : 'Set your posting times'}
            </Link>
          ) : (
            <span
              className="inline-flex shrink-0 items-center gap-[6px] rounded-[8px] border px-[14px] py-[9px] text-[13px] font-[500] opacity-60"
              style={{
                borderColor: 'var(--line, oklch(0.915 0.007 240))',
                background: 'var(--panel, oklch(1 0 0))',
                color: 'var(--ink-3, oklch(0.615 0.011 240))',
              }}
            >
              <Loader2 className="h-[14px] w-[14px] animate-spin" />
              Finding your next free time…
            </span>
          )}

          {/* Choose a time — toggles the date/time picker row below */}
          <button
            type="button"
            onClick={() => setPickingTime((open) => !open)}
            disabled={disabled}
            className={cn(
              'inline-flex shrink-0 items-center gap-[6px]',
              'rounded-[8px] border px-[14px] py-[9px] text-[13px] font-[500]',
              'transition-colors duration-150',
              'disabled:cursor-not-allowed disabled:opacity-40',
            )}
            style={
              pickingTime
                ? {
                    borderColor: 'var(--brand)',
                    background: 'var(--panel)',
                    color: 'var(--brand-deep)',
                  }
                : {
                    borderColor: 'var(--line)',
                    background: 'var(--panel)',
                    color: 'var(--ink)',
                  }
            }
          >
            Choose a time
          </button>

          {/* Post now — primary fill button */}
          <button
            type="button"
            onClick={() => {
              if (!window.confirm('Post this now to the ticked accounts?')) return
              onSave('now')
            }}
            disabled={disabled || blockedByHealth}
            className={cn(
              'inline-flex shrink-0 items-center gap-[6px]',
              'rounded-[8px] px-[14px] py-[9px] text-[13px] font-[600]',
              'transition-colors duration-150',
              'hover:bg-[var(--brand,oklch(0.545_0.115_240))]',
              'disabled:cursor-not-allowed disabled:opacity-40',
            )}
            style={{
              background: `var(--brand-deep,${BD_FALLBACK})`,
              // --brand-ink is dark in dark mode so text on a light fill is readable.
              // Never use `text-white` here — the dark-mode fill is near-white and
              // white text on it would be invisible (DESIGN.md anti-pattern).
              color: `var(--brand-ink,${INK_FALLBACK})`,
            }}
          >
            {saving && <Loader2 className="h-[14px] w-[14px] animate-spin" />}
            Post now
          </button>
        </div>
      </div>

      {/* Why there is no next free time, said out loud rather than left as a
          disabled button the owner has to guess at. */}
      {nextFree && !hasFreeTime && nextFree.message && (
        <div
          className="border-t px-[26px] py-[8px] text-[12px]"
          style={{ borderColor: 'var(--line)', color: 'var(--ink-3)' }}
        >
          {nextFree.message}
        </div>
      )}

      {/* ── Choose-a-time expansion ─────────────────────────────────────── */}
      {pickingTime && (
        <div
          className="flex flex-wrap items-center gap-[9px] border-t px-[26px] py-[10px]"
          style={{ borderColor: 'var(--line)' }}
        >
          <label
            className="flex items-center gap-[8px] text-[12px]"
            style={{ color: 'var(--ink-3)' }}
          >
            When
            <input
              type="datetime-local"
              value={when}
              onChange={(event) => {
                setWhen(event.target.value)
                onScheduledWhenChange?.(event.target.value)
              }}
              className="rounded-[8px] border px-[8px] py-[5px] text-[12.5px]"
              style={{
                borderColor: 'var(--line)',
                background: 'var(--panel-2)',
                color: 'var(--ink)',
              }}
            />
          </label>

          {/* The time read back in the BUSINESS's zone. Typing 9:00 on a laptop
              set to another state used to schedule an hour out with nothing on
              screen to notice it by. */}
          {chosen && !chosenIsPast && (
            <span className="text-[12px]" style={{ color: 'var(--ink-3)' }}>
              Goes out {describePostingTime(chosen, timezone)}, {placeOf(timezone)} time.
            </span>
          )}
          {chosen && chosenIsPast && (
            <span
              className="text-[12px] font-[600]"
              style={{ color: 'var(--st-fail, oklch(0.55 0.20 25))' }}
            >
              That time has already gone by in {placeOf(timezone)}. Pick a later one.
            </span>
          )}

          <button
            type="button"
            disabled={disabled || !chosen || chosenIsPast}
            onClick={() => {
              if (!chosen || chosenIsPast) return
              if (!window.confirm('Schedule this post to the ticked accounts?')) return
              // A time picked by hand takes no posting time with it — it is not
              // one of the week's times, so nothing owns it but the minute
              // itself, which the next-free-time answer already respects.
              onSave('schedule', chosen.toISOString())
              setScheduledFor(describePostingTime(chosen, timezone))
              setPickingTime(false)
            }}
            className="rounded-[8px] px-[14px] py-[9px] text-[13px] font-[600] disabled:opacity-40"
            style={{
              background: `var(--brand-deep,${BD_FALLBACK})`,
              color: `var(--brand-ink,${INK_FALLBACK})`,
            }}
          >
            Schedule
          </button>
          <button
            type="button"
            onClick={() => setPickingTime(false)}
            className="text-[12.5px] font-[500] transition-colors"
            style={{ color: 'var(--ink-3)' }}
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  )
}

'use client'

import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { PostPlatform } from '@/types/database'
import { PLATFORM_BRAND_COLOURS } from '@/lib/mixpost/ui-tokens'

/**
 * Status dot colours — per DESIGN.md locked to dept-social.html.
 * These are literal oklch values, not CSS variables, so they work
 * without `--st-*` being defined globally in the work column.
 */
const ST_DRAFT   = 'oklch(0.62 0.012 240)'
const ST_SENDING = 'oklch(0.72 0.15 70)'

/** Fallback if --brand-deep / --brand / --brand-ink are not yet in the cascade */
const BD_FALLBACK  = 'oklch(0.33 0.08 240)'
const B_FALLBACK   = 'oklch(0.545 0.115 240)'
const INK_FALLBACK = 'oklch(1 0 0)'

interface CreatorActionBarProps {
  platforms: PostPlatform[]
  captionEmpty: boolean
  compliancePassed: boolean | null
  saving: boolean
  onSave: (mode: 'draft' | 'schedule' | 'now', scheduledAt?: string) => void
  editMode?: boolean
  /** Next time on this business's posting plan, or null if none is set. */
  nextSlotIso?: string | null
  /** Time of the last successful save, e.g. "2:14 pm" */
  savedAt?: string | null
  /** datetime-local value the Director (or calendar) already chose */
  scheduledWhen?: string
  onScheduledWhenChange?: (value: string) => void
}

function slotLabel(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return 'next free slot'
  return date.toLocaleString('en-AU', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function toLocalInputValue(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
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
  captionEmpty,
  compliancePassed,
  saving,
  onSave,
  editMode,
  nextSlotIso,
  savedAt,
  scheduledWhen,
  onScheduledWhenChange,
}: CreatorActionBarProps) {
  const [pickingTime, setPickingTime] = useState(() => Boolean(scheduledWhen))
  const [when, setWhen] = useState(() => scheduledWhen || toLocalInputValue(new Date().toISOString()))
  const disabled = saving || captionEmpty
  const blockedByHealth = compliancePassed === false

  useEffect(() => {
    if (!scheduledWhen) return
    setWhen(scheduledWhen)
    setPickingTime(true)
  }, [scheduledWhen])

  return (
    <div
      className="shrink-0 border-t"
      style={{
        borderColor: 'var(--line, oklch(0.915 0.007 240))',
        background: 'var(--panel, oklch(1 0 0))',
      }}
    >
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
          {/* 9 px status dot — draft or sending */}
          <span
            className="h-[9px] w-[9px] shrink-0 rounded-full"
            aria-hidden
            style={{ background: saving ? ST_SENDING : ST_DRAFT }}
          />
          <b style={{ color: 'var(--ink-2, oklch(0.46 0.012 240))', fontWeight: 600 }}>
            {saving ? 'Saving…' : 'Draft'}
          </b>
          {!saving && (
            <>
              <span aria-hidden>·</span>
              <span className="truncate">
                {savedAt
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

          {/* Save draft */}
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

          {/* Add to next free time */}
          <button
            type="button"
            onClick={() => nextSlotIso && onSave('schedule', nextSlotIso)}
            disabled={disabled || !nextSlotIso}
            title={
              nextSlotIso
                ? `Next open time: ${slotLabel(nextSlotIso)}`
                : 'Set posting times under Social → Schedule first'
            }
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
            Add to next free time
            {nextSlotIso && (
              <span className="text-[11px] font-normal" style={{ color: 'var(--ink-3)' }}>
                {slotLabel(nextSlotIso)}
              </span>
            )}
          </button>

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
          <button
            type="button"
            disabled={disabled || !when}
            onClick={() => {
              if (!window.confirm('Schedule this post to the ticked accounts?')) return
              const iso = new Date(when).toISOString()
              onSave('schedule', iso)
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

'use client'

import { useState } from 'react'
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

/** care-wash — shown when compliance has explicitly failed */
const CARE_WASH   = 'oklch(0.965 0.028 25)'
const CARE_LINE   = 'oklch(0.89 0.050 25)'
const CARE_INK    = 'oklch(0.52 0.150 25)'
const INK_2       = 'oklch(0.46 0.012 240)'
const INK_3       = 'oklch(0.615 0.011 240)'

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
 * Tokens: --brand-deep / --brand / --brand-ink come from the shell layout
 * (always present). House tokens (--border, --card, --foreground) are the
 * shadcn-compat set from globals.css, which closely match the NRS design
 * tokens at these lightness values.
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
}: CreatorActionBarProps) {
  const [pickingTime, setPickingTime] = useState(false)
  const [when, setWhen] = useState(() => toLocalInputValue(new Date().toISOString()))
  const disabled = saving || captionEmpty
  const blockedByHealth = compliancePassed === false

  return (
    <div className="flex-shrink-0 border-t border-[var(--border)] bg-[var(--card,oklch(1_0_0))]">
      {/* ── Health gate ────────────────────────────────────────────────── */}
      {blockedByHealth && (
        <div
          className="flex items-center gap-[9px] px-[26px] py-[8px] text-[12px]"
          style={{
            background: CARE_WASH,
            borderBottom: `1px solid ${CARE_LINE}`,
            color: INK_2,
          }}
        >
          <span style={{ color: CARE_INK, flexShrink: 0 }} aria-hidden>⚕</span>
          <span>
            <b style={{ color: CARE_INK, fontWeight: 650 }}>
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
          style={{ color: INK_3 }}
        >
          {/* 9 px status dot — draft or sending */}
          <span
            className="h-[9px] w-[9px] shrink-0 rounded-full"
            aria-hidden
            style={{ background: saving ? ST_SENDING : ST_DRAFT }}
          />
          <b style={{ color: INK_2, fontWeight: 600 }}>
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
              'rounded-[8px] border border-[var(--border)] bg-[var(--card,oklch(1_0_0))]',
              'px-[14px] py-[9px] text-[13px] font-[500]',
              'text-[var(--foreground)]',
              'transition-colors duration-150',
              'hover:border-[var(--brand,oklch(0.545_0.115_240))] hover:text-[var(--brand-deep,oklch(0.33_0.08_240))]',
              'disabled:cursor-not-allowed disabled:opacity-40',
            )}
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
              'rounded-[8px] border border-[var(--border)] bg-[var(--card,oklch(1_0_0))]',
              'px-[14px] py-[9px] text-[13px] font-[500]',
              'text-[var(--foreground)]',
              'transition-colors duration-150',
              'hover:border-[var(--brand,oklch(0.545_0.115_240))] hover:text-[var(--brand-deep,oklch(0.33_0.08_240))]',
              'disabled:cursor-not-allowed disabled:opacity-40',
            )}
          >
            Add to next free time
            {nextSlotIso && (
              <span className="text-[11px] font-normal" style={{ color: INK_3 }}>
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
              pickingTime
                ? 'border-[var(--brand,oklch(0.545_0.115_240))] bg-[var(--card,oklch(1_0_0))] text-[var(--brand-deep,oklch(0.33_0.08_240))]'
                : 'border-[var(--border)] bg-[var(--card,oklch(1_0_0))] text-[var(--foreground)] hover:border-[var(--brand,oklch(0.545_0.115_240))] hover:text-[var(--brand-deep,oklch(0.33_0.08_240))]',
            )}
          >
            Choose a time
          </button>

          {/* Post now — primary fill button */}
          <button
            type="button"
            onClick={() => onSave('now')}
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
          className="flex flex-wrap items-center gap-[9px] border-t border-[var(--border)] px-[26px] py-[10px]"
        >
          <label
            className="flex items-center gap-[8px] text-[12px]"
            style={{ color: INK_3 }}
          >
            When
            <input
              type="datetime-local"
              value={when}
              onChange={(event) => setWhen(event.target.value)}
              className="rounded-[8px] border border-[var(--border)] bg-[var(--card,oklch(1_0_0))] px-[8px] py-[5px] text-[12.5px] text-[var(--foreground)]"
            />
          </label>
          <button
            type="button"
            disabled={disabled || !when}
            onClick={() => {
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
            className="text-[12.5px] font-[500] transition-colors hover:text-[var(--brand-deep,oklch(0.33_0.08_240))]"
            style={{ color: INK_3 }}
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  )
}

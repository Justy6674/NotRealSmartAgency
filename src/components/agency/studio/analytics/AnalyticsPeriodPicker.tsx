'use client'

import { ANALYTICS_PERIODS, type AnalyticsPeriod } from './analytics-desk'

/**
 * How far back the figures on this screen go.
 *
 * Three windows, always visible, always saying which one is in force. The
 * screen used to be a fixed twenty-eight days with the number written into the
 * heading, so a question like "how did the last quarter go" had no answer here
 * at all.
 *
 * The chosen window is stated in words next to the control rather than only as
 * a highlighted button, because the figures beside it are meaningless without
 * it and a highlight is easy to miss.
 */

const LINE = 'var(--line, oklch(0.915 0.007 240))'
const INK_2 = 'var(--ink-2, oklch(0.46 0.012 240))'
const INK_3 = 'oklch(0.615 0.011 240)'
const BRAND_WASH = 'var(--brand-wash, oklch(0.966 0.0068 240))'
const BRAND_DEEP = 'var(--brand-deep, oklch(0.33 0.0209 240))'

export interface AnalyticsPeriodPickerProps {
  value: AnalyticsPeriod
  onChange: (period: AnalyticsPeriod) => void
  /** Right-hand note — usually how old the figures are. */
  note?: string | null
}

export function AnalyticsPeriodPicker({ value, onChange, note }: AnalyticsPeriodPickerProps) {
  return (
    <div className="flex flex-wrap items-center gap-[10px]">
      <div
        role="group"
        aria-label="How far back to measure"
        className="inline-flex items-center gap-[2px] rounded-[10px] p-[3px]"
        style={{ border: `1px solid ${LINE}`, background: 'var(--panel, oklch(1 0 0))' }}
      >
        {ANALYTICS_PERIODS.map((period) => {
          const active = period.value === value
          return (
            <button
              key={period.value}
              type="button"
              aria-pressed={active}
              onClick={() => onChange(period.value)}
              className="rounded-[8px] px-[11px] py-[5px] text-[12.5px] transition-colors"
              style={{
                background: active ? BRAND_WASH : 'transparent',
                color: active ? BRAND_DEEP : INK_2,
                fontWeight: active ? 600 : 500,
                fontFamily: '"IBM Plex Sans", ui-sans-serif, system-ui, sans-serif',
              }}
            >
              {period.label}
            </button>
          )
        })}
      </div>

      {note ? (
        <span className="text-[11.5px]" style={{ color: INK_3 }}>
          {note}
        </span>
      ) : null}
    </div>
  )
}

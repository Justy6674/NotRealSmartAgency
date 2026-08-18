'use client'

import { cn } from '@/lib/utils'
import type { ContentType } from './ContentTypeSection'

const OPTIONS: { value: ContentType; label: string }[] = [
  { value: 'post', label: 'Post' },
  { value: 'carousel', label: 'Carousel' },
  { value: 'short_video', label: 'Short video' },
  { value: 'long_video', label: 'Long video' },
  { value: 'story', label: 'Story' },
  { value: 'ad', label: 'Ad' },
]

interface ContentTypeCompactProps {
  value: ContentType
  onChange: (type: ContentType) => void
}

/**
 * One quiet row — not the six-tile admin grid. Mockup has no type picker;
 * this stays available without owning the page.
 */
export function ContentTypeCompact({ value, onChange }: ContentTypeCompactProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span
        className="text-[11px] font-semibold uppercase tracking-[0.08em]"
        style={{ color: 'var(--ink-3)' }}
      >
        Format
      </span>
      {OPTIONS.map((opt) => {
        const on = value === opt.value
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={cn(
              'rounded-[8px] border px-[10px] py-[5px] text-[12px] font-medium transition-colors duration-150',
            )}
            style={
              on
                ? {
                    borderColor: 'var(--brand)',
                    background: 'var(--brand-wash)',
                    color: 'var(--brand-deep)',
                  }
                : {
                    borderColor: 'var(--line)',
                    background: 'var(--panel)',
                    color: 'var(--ink-2)',
                  }
            }
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}

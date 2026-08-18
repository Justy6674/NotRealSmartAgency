'use client'

import { useRef, type CSSProperties, type KeyboardEvent, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

/**
 * DepartmentTabs — the inner tab strip that makes a section a DEPARTMENT you
 * work inside, rather than a single form you fill in and leave.
 *
 * Shared on purpose. Social media, Blogging, Advertising and Engagement all
 * have the same shape — a few places to stand inside one area of the business —
 * and the last time each screen drew its own strip we ended up with three
 * different navigations stacked on the same page. One strip, one behaviour.
 *
 * It is PRESENTATIONAL and CONTROLLED: it owns no panel, no routing and no
 * memory of where you were. The screen decides what a tab means, which is what
 * lets the Social department keep its composer mounted while you look at
 * another tab, and lets a simpler department mount and unmount freely.
 *
 * The colours resolve to the active business's accent once the brand variables
 * are set on an ancestor, and fall back to the ordinary foreground token until
 * then — so a department is never invisible while the retint is being wired.
 */

export interface DepartmentTab {
  /**
   * Stable id. It is also what gets written to the address bar, so keep it one
   * lowercase plain word the owner would recognise if he ever saw it.
   */
  id: string
  /**
   * Plain-language label. The owner reads this. No department names, no
   * plumbing words — "Media library", never "Assets" or "Bucket".
   */
  label: string
  icon?: ReactNode
  /**
   * A REAL count, or nothing at all.
   *
   * Do not pass 0 to mean "not loaded yet" and do not pass an estimate. A
   * number sitting beside a tab is read as a fact about the business, so an
   * unknown count is `undefined` — the badge then does not render, which is
   * honest, rather than a zero that says the library is empty when nobody
   * has looked.
   */
  count?: number
  /**
   * Queue badge — attention styling (--brand-deep), not inventory grey.
   */
  attention?: boolean
  /**
   * A compliance item. Tinted with the care colour so a health rule never
   * looks like an ordinary tab. Only ever set this for a business whose
   * compliance flags are actually on.
   */
  care?: boolean
}

/** Element id of a tab button. Exported so a panel can point back at it. */
export const departmentTabId = (group: string, tabId: string) => `${group}-tab-${tabId}`

/** Element id of the panel a tab controls. The screen puts this on its panel. */
export const departmentPanelId = (group: string, tabId: string) => `${group}-panel-${tabId}`

interface DepartmentTabsProps {
  /**
   * Namespaces the generated ids, so two departments rendered on one page do
   * not both claim `tab-posts`.
   */
  group: string
  tabs: DepartmentTab[]
  /** Id of the tab currently showing. */
  value: string
  onValueChange: (tabId: string) => void
  /** What a screen reader announces for the strip, e.g. "Social media sections". */
  label: string
  className?: string
}

const ACTIVE_STYLE: CSSProperties = {
  color: 'var(--brand-deep, var(--foreground))',
  borderBottomColor: 'var(--brand, var(--foreground))',
}

const CARE_STYLE: CSSProperties = {
  color: 'var(--care, var(--destructive))',
}

const ATTENTION_COUNT_STYLE: CSSProperties = {
  background: 'var(--brand-deep, var(--foreground))',
  color: 'var(--brand-ink, oklch(1 0 0))',
  borderColor: 'transparent',
}

const ACTIVE_COUNT_STYLE: CSSProperties = {
  background: 'var(--brand-wash, var(--muted))',
  color: 'var(--brand-deep, var(--foreground))',
  borderColor: 'transparent',
}

export function DepartmentTabs({
  group,
  tabs,
  value,
  onValueChange,
  label,
  className,
}: DepartmentTabsProps) {
  const buttons = useRef<(HTMLButtonElement | null)[]>([])

  // Arrow keys move between tabs, which is what a tab strip is expected to do
  // and what Tab alone will not give you — Tab has to keep leaving the strip
  // and entering the panel, or a keyboard user is trapped in seven stops
  // before reaching the composer.
  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const current = tabs.findIndex((tab) => tab.id === value)
    if (current === -1) return

    let next = current
    if (event.key === 'ArrowRight') next = (current + 1) % tabs.length
    else if (event.key === 'ArrowLeft') next = (current - 1 + tabs.length) % tabs.length
    else if (event.key === 'Home') next = 0
    else if (event.key === 'End') next = tabs.length - 1
    else return

    event.preventDefault()
    onValueChange(tabs[next].id)
    buttons.current[next]?.focus()
  }

  return (
    <div
      role="tablist"
      aria-label={label}
      aria-orientation="horizontal"
      onKeyDown={handleKeyDown}
        className={cn(
          'flex items-center gap-0.5 overflow-x-auto border-b',
          className,
        )}
        style={{ borderColor: 'var(--line, oklch(0.915 0.007 240))' }}
    >
      {tabs.map((tab, index) => {
        const isActive = tab.id === value
        const hasCount = typeof tab.count === 'number'

        return (
          <button
            key={tab.id}
            ref={(node) => {
              buttons.current[index] = node
            }}
            id={departmentTabId(group, tab.id)}
            type="button"
            role="tab"
            aria-selected={isActive}
            aria-controls={departmentPanelId(group, tab.id)}
            // Roving focus: the strip is one stop, not one per tab.
            tabIndex={isActive ? 0 : -1}
            onClick={() => onValueChange(tab.id)}
            style={isActive ? ACTIVE_STYLE : tab.care ? CARE_STYLE : undefined}
            className={cn(
              'relative -mb-px flex shrink-0 items-center gap-[7px] whitespace-nowrap',
              'border-b-2 border-transparent px-3 pb-2.5 pt-[9px] text-[13.5px]',
              'transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)]',
              isActive
                ? 'font-semibold'
                : 'text-[var(--ink-2)] hover:rounded-t-lg hover:bg-[var(--panel-2)] hover:text-[var(--ink)]',
            )}
          >
            {tab.icon ? (
              <span aria-hidden className="flex h-4 w-4 items-center justify-center">
                {tab.icon}
              </span>
            ) : null}
            <span>{tab.label}</span>
            {hasCount ? (
              <span
                style={
                  isActive
                    ? ACTIVE_COUNT_STYLE
                    : tab.attention
                      ? ATTENTION_COUNT_STYLE
                      : undefined
                }
                className={cn(
                  'rounded-sm border px-1.5 py-px text-[10px] font-semibold tabular-nums',
                  isActive || tab.attention
                    ? ''
                    : 'border-[var(--line,oklch(0.915_0.007_240))] bg-[var(--panel-2,oklch(0.975_0.004_240))] text-[var(--ink-3,oklch(0.615_0.011_240))]',
                )}
              >
                {tab.count}
              </span>
            ) : null}
          </button>
        )
      })}
    </div>
  )
}

'use client'

/**
 * The one sidebar. Twelve sections, flat, always expanded, sub-items visible
 * without a click.
 *
 * It replaces three competing navigations that used to stack on the same
 * screen — the room tabs in the header, the brand/chat list in ProjectSidebar,
 * and StudioSidebar's own fourteen destinations. On /agency/studio/* the owner
 * saw all three at once and the code had already noticed: StudioChatCloser
 * existed purely to force the Director panel shut because the sidebars had
 * eaten the width.
 *
 * Two decisions here are deliberate and should not be "tidied":
 *
 * 1. NOTHING IS FETCHED IN THIS FILE. Brand name, compliance flags and counts
 *    all arrive as props. The old header fetched /api/brands for itself, and so
 *    did ChatPanel, and so did ChatInterface — three round-trips for one brand.
 *    Adding a fourth here would make the retint flash on every navigation.
 *
 * 2. THE HEALTHCARE ROW IS AN INDICATOR, NOT A TOGGLE. The mockup draws a
 *    switch and it is tempting to wire it up. AHPRA/TGA applicability is a fact
 *    about the business, held in brands.compliance_flags, and it gates the
 *    publish and save chokepoints. A control in the sidebar that appears to
 *    switch it off would be a control that appears to switch off a $60k-per-
 *    offence obligation. It reports; it does not decide.
 *
 * Colour comes entirely from custom properties, so the business selector can
 * retint the whole column by changing --brand / --brand-deep / --brand-wash on
 * an ancestor. Each alias below falls back to the silver hue-240 house palette,
 * so the sidebar is correct in both themes before any retinting exists and
 * a business with no colours set gets honest neutral rather than a guessed tint.
 */

import type { ReactNode } from 'react'
import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { ChevronDown, Plus } from 'lucide-react'

import { cn } from '@/lib/utils'
import { useAgencyStore } from '@/stores/agency-store'
import type { Brand } from '@/types/database'
import {
  activeChildId,
  CREATE_POST_HREF,
  isHealthcareBusiness,
  isSectionActive,
  visibleChildren,
  visibleSections,
  type NavCounts,
  type NavFilterState,
  type NavSection,
} from './nav-sections'

// ─── Tokens ───────────────────────────────────────────────────────────────────

/**
 * Local aliases, declared once on the root. Every one reads the shared token
 * first and only falls back if it is absent, so this column follows the product
 * the moment the shell defines the real palette, and looks right today if it
 * has not. Dark values are a `dark:` pair rather than a media query because the
 * app switches theme by class (next-themes), not by system preference.
 */
const TOKENS = [
  // Surfaces
  '[--nrs-panel:var(--panel,oklch(1_0_0))]',
  'dark:[--nrs-panel:var(--panel,oklch(0.215_0.012_240))]',
  '[--nrs-panel-2:var(--panel-2,oklch(0.975_0.004_240))]',
  'dark:[--nrs-panel-2:var(--panel-2,oklch(0.245_0.013_240))]',
  '[--nrs-line:var(--line,oklch(0.915_0.007_240))]',
  'dark:[--nrs-line:var(--line,oklch(0.315_0.015_240))]',
  '[--nrs-line-soft:var(--line-soft,oklch(0.950_0.005_240))]',
  'dark:[--nrs-line-soft:var(--line-soft,oklch(0.275_0.013_240))]',
  // Ink
  '[--nrs-ink:var(--ink,oklch(0.20_0.014_240))]',
  'dark:[--nrs-ink:var(--ink,oklch(0.960_0.005_240))]',
  '[--nrs-ink-2:var(--ink-2,oklch(0.46_0.012_240))]',
  'dark:[--nrs-ink-2:var(--ink-2,oklch(0.795_0.011_240))]',
  '[--nrs-ink-3:var(--ink-3,oklch(0.615_0.011_240))]',
  'dark:[--nrs-ink-3:var(--ink-3,oklch(0.640_0.013_240))]',
  // The business accent. One switch retints the column.
  '[--nrs-brand:var(--brand,oklch(0.545_0.115_240))]',
  'dark:[--nrs-brand:var(--brand,oklch(0.74_0.11_240))]',
  '[--nrs-brand-deep:var(--brand-deep,oklch(0.33_0.080_240))]',
  'dark:[--nrs-brand-deep:var(--brand-deep,oklch(0.87_0.08_240))]',
  '[--nrs-brand-wash:var(--brand-wash,oklch(0.966_0.026_240))]',
  'dark:[--nrs-brand-wash:var(--brand-wash,oklch(0.272_0.038_240))]',
  // Text sitting ON the accent. In dark the accent inverts to a light tint, so
  // white here would drop to almost no contrast on the Create post button.
  // brand-theme.ts derives this as --brand-ink for exactly that reason.
  '[--nrs-on-brand:var(--brand-ink,oklch(1_0_0))]',
  'dark:[--nrs-on-brand:var(--brand-ink,oklch(0.17_0.020_240))]',
  // Healthcare. Warm red, hue 25, and only ever visible on a regulated business.
  '[--nrs-care:var(--care,oklch(0.52_0.150_25))]',
  'dark:[--nrs-care:var(--care,oklch(0.77_0.13_25))]',
  '[--nrs-care-wash:var(--care-wash,oklch(0.965_0.028_25))]',
  'dark:[--nrs-care-wash:var(--care-wash,oklch(0.285_0.045_25))]',
  '[--nrs-care-line:oklch(0.89_0.050_25)]',
  'dark:[--nrs-care-line:oklch(0.42_0.070_25)]',
  '[--nrs-knob:oklch(1_0_0)]',
  'dark:[--nrs-knob:oklch(0.20_0.040_25)]',
  // Elevation
  '[--nrs-shadow:0_1px_2px_oklch(0.2_0.02_240/.05),0_8px_24px_-16px_oklch(0.2_0.02_240/.28)]',
  'dark:[--nrs-shadow:0_1px_2px_oklch(0_0_0/.5),0_10px_30px_-18px_oklch(0_0_0/.75)]',
].join(' ')

/** Shared by the business logo chip and the owner's avatar. */
const CHIP =
  'grid size-[26px] shrink-0 place-items-center bg-[var(--nrs-brand)] text-[10px] font-semibold leading-none text-[var(--nrs-on-brand)]'

// ─── Props ────────────────────────────────────────────────────────────────────

export interface AgencySidebarProps {
  /**
   * The block at the top of the column — business name, account count, and the
   * healthcare indicator. Pass the store-connected `<BusinessSelector />` and it
   * replaces the built-in one entirely, indicator included, so the two never
   * stack. The built-in exists so this column is complete and testable on its
   * own from props alone; it is not a second implementation to keep in step.
   */
  businessSelector?: ReactNode
  /** Used only by the built-in selector, i.e. when `businessSelector` is absent. */
  businessName?: string | null
  /**
   * The quiet second line under the name — "3 accounts". Supplied by the
   * caller because only the caller has counted them. Absent means absent.
   */
  businessSubtitle?: string | null
  /**
   * How many businesses this owner has. Almost every subscriber has one, and
   * with one the selector is a label rather than a switcher: there is nothing
   * to switch to, so offering the affordance is a small lie.
   */
  businessCount?: number
  /** Straight off brands.compliance_flags. Drives every [care] row. */
  complianceFlags?: { ahpra?: boolean; tga?: boolean } | null
  /**
   * The live business list. When present, the [care] rows follow the
   * *selected* business rather than whichever one the server guessed first.
   */
  brands?: Brand[]
  /**
   * Attention counts by section id, plus the queue rows that carry one
   * (`social-waiting`). Optional per entry, and anything without a number
   * renders bare — a "0" would claim we looked and found nothing waiting.
   */
  counts?: NavCounts
  /**
   * What is currently on the URL's query string — pass `useSearchParams()`.
   *
   * Only needed to tell "Waiting on you" apart from "Posts", which share a
   * pathname. Omit it and Posts is lit on both, which is what happens today:
   * the shell layout is a Server Component and cannot read the query, so it
   * does not pass this. The Social department screen can, and should.
   */
  activeFilters?: NavFilterState | null
  /** Signed-in owner, for the footer chip. Omit and the footer does not render. */
  userName?: string | null
  /** Only wired when there is more than one business to choose between. */
  onSelectBusiness?: () => void
  /** Mobile: close the drawer once a destination is chosen. */
  onNavigate?: () => void
  createPostHref?: string
  className?: string
}

// ─── Component ────────────────────────────────────────────────────────────────

export function AgencySidebar({
  businessSelector,
  businessName,
  businessSubtitle,
  businessCount = 1,
  complianceFlags,
  brands,
  counts,
  activeFilters,
  userName,
  onSelectBusiness,
  onNavigate,
  createPostHref = CREATE_POST_HREF,
  className,
}: AgencySidebarProps) {
  const pathname = usePathname() ?? ''
  const searchParams = useSearchParams()
  const filters = activeFilters ?? searchParams
  const activeBrandId = useAgencyStore((s) => s.activeBrandId)
  const liveFlags =
    brands?.find((brand) => brand.id === activeBrandId)?.compliance_flags ?? complianceFlags
  const healthcare = isHealthcareBusiness(liveFlags)
  const sections = visibleSections(healthcare)

  return (
    <aside
      className={cn(
        TOKENS,
        'flex w-[236px] shrink-0 flex-col overflow-x-hidden overflow-y-auto',
        'border-r border-[var(--nrs-line)] bg-[var(--nrs-panel)]',
        className
      )}
    >
      {businessSelector ?? (
        <BusinessBlock
          name={businessName}
          subtitle={businessSubtitle}
          count={businessCount}
          healthcare={healthcare}
          complianceFlags={complianceFlags}
          onSelect={onSelectBusiness}
        />
      )}

      {/* The one primary manual action. Law 1: the owner starts work without
          ever addressing the Director. */}
      <Link
        href={createPostHref}
        onClick={onNavigate}
        className={cn(
          'm-3 flex items-center justify-center gap-2 rounded-[10px] px-[14px] py-[11px]',
          'text-[13px] font-[650] tracking-[0.02em] no-underline',
          'bg-[var(--nrs-brand-deep)] text-[var(--nrs-on-brand)] shadow-[var(--nrs-shadow)]',
          'transition-colors hover:bg-[var(--nrs-brand)]'
        )}
      >
        <Plus className="size-[15px]" strokeWidth={2.5} aria-hidden />
        Create post
      </Link>

      <nav aria-label="Sections" className="px-2 pb-1.5">
        {sections.map((section) => (
          <Section
            key={section.id}
            section={section}
            pathname={pathname}
            healthcare={healthcare}
            counts={counts}
            activeFilters={filters}
            onNavigate={onNavigate}
          />
        ))}
      </nav>

      {userName ? (
        <div className="mt-auto flex items-center gap-[9px] border-t border-[var(--nrs-line-soft)] px-4 py-3">
          <span className={cn(CHIP, 'rounded-full')} aria-hidden>
            {initialsFrom(userName)}
          </span>
          <span className="truncate text-[13px] text-[var(--nrs-ink-2)]">{userName}</span>
        </div>
      ) : null}
    </aside>
  )
}

// ─── Business selector + healthcare indicator ─────────────────────────────────

function BusinessBlock({
  name,
  subtitle,
  count,
  healthcare,
  complianceFlags,
  onSelect,
}: {
  name?: string | null
  subtitle?: string | null
  count: number
  healthcare: boolean
  complianceFlags?: { ahpra?: boolean; tga?: boolean } | null
  onSelect?: () => void
}) {
  const label = name?.trim() || 'No business yet'
  const switchable = count > 1 && Boolean(onSelect)

  const card = (
    <>
      <span className={cn(CHIP, 'rounded-[7px]')} aria-hidden>
        {name?.trim() ? initialsFrom(name) : '·'}
      </span>
      <span className="min-w-0 flex-1 text-left">
        <span className="block text-[13px] font-semibold leading-[1.25] tracking-[-0.01em] text-[var(--nrs-ink)]">
          {label}
        </span>
        {subtitle ? (
          <span className="block text-[11px] font-normal text-[var(--nrs-ink-3)]">{subtitle}</span>
        ) : null}
      </span>
      {switchable ? (
        <ChevronDown className="size-3 shrink-0 text-[var(--nrs-ink-3)]" aria-hidden />
      ) : null}
    </>
  )

  const cardClass = cn(
    'flex w-full items-center gap-[9px] rounded-[10px] px-[10px] py-2 text-left',
    'border border-[var(--nrs-line)] bg-[var(--nrs-panel)]',
    switchable && 'cursor-pointer transition-colors hover:border-[var(--nrs-brand)]'
  )

  return (
    <div className="border-b border-[var(--nrs-line-soft)] bg-[var(--nrs-panel-2)] px-[13px] pt-[13px] pb-3">
      {switchable ? (
        <button type="button" onClick={onSelect} className={cardClass}>
          {card}
        </button>
      ) : (
        // One business: a label, not a control. Nothing to switch to.
        <div className={cardClass}>{card}</div>
      )}

      {healthcare ? <HealthcareIndicator flags={complianceFlags} /> : null}
    </div>
  )
}

/**
 * Reports the regulatory regime this business sits under. Read-only on purpose
 * — see the note at the top of the file. The wording names only the regulators
 * that actually apply, so a TGA-only business is not told AHPRA rules are on.
 */
function HealthcareIndicator({ flags }: { flags?: { ahpra?: boolean; tga?: boolean } | null }) {
  const named = [flags?.ahpra ? 'AHPRA' : null, flags?.tga ? 'TGA' : null].filter(Boolean)
  const rules = named.length === 2 ? 'AHPRA & TGA rules' : `${named[0]} rules`

  return (
    <div
      role="status"
      className={cn(
        'mt-[9px] flex w-full items-center gap-2 rounded-[9px] px-[9px] py-[7px] text-left',
        'border border-[var(--nrs-care-line)] bg-[var(--nrs-care-wash)]'
      )}
    >
      <span
        aria-hidden
        className={cn(
          'relative block h-4 w-7 shrink-0 rounded-full bg-[var(--nrs-care)]',
          "after:absolute after:top-[2px] after:right-[2px] after:size-3 after:rounded-full after:bg-[var(--nrs-knob)] after:content-['']"
        )}
      />
      <span className="text-[11.5px] font-semibold leading-[1.35] text-[var(--nrs-care)]">
        Healthcare business — {rules} on
      </span>
    </div>
  )
}

// ─── Sections ─────────────────────────────────────────────────────────────────

function Section({
  section,
  pathname,
  healthcare,
  counts,
  activeFilters,
  onNavigate,
}: {
  section: NavSection
  pathname: string
  healthcare: boolean
  counts?: NavCounts
  activeFilters?: NavFilterState | null
  onNavigate?: () => void
}) {
  const active = isSectionActive(section, pathname)
  const children = visibleChildren(section, healthcare)
  const Icon = section.icon
  const count = badgeCount(counts?.[section.id])
  // At most one child row is ever lit, even where two share a pathname.
  const currentChildId = activeChildId(children, pathname, activeFilters)

  return (
    <>
      {section.groupLabel ? (
        <div className="px-[9px] pt-[14px] pb-[5px] text-[10.5px] font-[650] tracking-[0.09em] text-[var(--nrs-ink-3)] uppercase">
          {section.groupLabel}
        </div>
      ) : null}

      <Link
        href={section.href}
        onClick={onNavigate}
        aria-current={active ? 'page' : undefined}
        className={cn(
          'mt-0.5 flex items-center gap-[9px] rounded-lg px-[9px] py-[7px] text-[13.5px] no-underline',
          active
            ? 'bg-[var(--nrs-brand-wash)] font-[650] text-[var(--nrs-brand-deep)]'
            : 'font-[560] text-[var(--nrs-ink)] hover:bg-[var(--nrs-panel-2)]'
        )}
      >
        <Icon
          className={cn(
            'size-4 shrink-0',
            active ? 'text-[var(--nrs-brand-deep)]' : 'text-[var(--nrs-ink-3)]'
          )}
          strokeWidth={1.9}
          aria-hidden
        />
        <span className="min-w-0 flex-1 truncate">{section.label}</span>
        {count === undefined ? null : <CountBadge count={count} />}
      </Link>

      {children.length > 0 ? (
        // items-stretch matters: centring the rows in a column flex container
        // staircases every one of them toward the middle.
        <div className="mt-px mb-[5px] ml-[34px] flex flex-col items-stretch gap-px text-left">
          {children.map((child) =>
            child.kind === 'group' ? (
              <span
                key={child.id}
                className="block px-2 pt-1.5 pb-0.5 text-[10.5px] font-[650] tracking-[0.08em] text-[var(--nrs-ink-3)] uppercase"
              >
                {child.label}
              </span>
            ) : (
              <SubItem
                key={child.id}
                label={child.label}
                href={child.href}
                care={Boolean(child.healthcareOnly)}
                active={child.id === currentChildId}
                count={child.countId ? badgeCount(counts?.[child.countId]) : undefined}
                onNavigate={onNavigate}
              />
            )
          )}
        </div>
      ) : null}
    </>
  )
}

function SubItem({
  label,
  href,
  care,
  active,
  count,
  onNavigate,
}: {
  label: string
  href: string
  care: boolean
  active: boolean
  count?: number
  onNavigate?: () => void
}) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'flex items-start gap-[7px] rounded-md px-2 py-1 text-[12.5px] leading-[1.4] no-underline',
        // The bullet belongs to the row, never to the list — put it on the list
        // and every group grows a stray dot above its first item.
        "before:mt-[7px] before:size-[3px] before:shrink-0 before:rounded-full before:content-['']",
        // A compliance row keeps its warm red even when selected. It is not the
        // same kind of thing as "Templates" and must never look like it.
        care && active && 'bg-[var(--nrs-care-wash)] font-semibold text-[var(--nrs-care)] before:bg-[var(--nrs-care)] before:opacity-100',
        care && !active && 'font-normal text-[var(--nrs-care)] before:bg-[var(--nrs-care)] before:opacity-85 hover:bg-[var(--nrs-panel-2)]',
        !care && active && 'bg-[var(--nrs-brand-wash)] font-semibold text-[var(--nrs-brand-deep)] before:bg-[var(--nrs-brand-deep)] before:opacity-100',
        !care && !active && 'font-normal text-[var(--nrs-ink-2)] before:bg-[var(--nrs-ink-3)] before:opacity-55 hover:bg-[var(--nrs-panel-2)] hover:text-[var(--nrs-ink)]'
      )}
    >
      <span className="min-w-0 flex-1">{label}</span>
      {count === undefined ? null : <CountBadge count={count} tone="attention" />}
    </Link>
  )
}

// ─── Counts ───────────────────────────────────────────────────────────────────

/**
 * The number, or nothing. Absent means nobody measured it; zero means the queue
 * is empty, and an empty queue is not news worth a badge. Both render bare, so
 * a badge in this column always means there is something there.
 *
 * `Number.isFinite` because a count that arrived as NaN from a failed fetch is
 * an unmeasured count wearing a number's clothes.
 */
function badgeCount(count?: number): number | undefined {
  return typeof count === 'number' && Number.isFinite(count) && count > 0 ? count : undefined
}

/**
 * `quiet` is inventory — how much is in there. `attention` is a queue: work
 * that stops until the owner does something, so it takes the solid accent and
 * survives sitting on an already-tinted active row. Scent Sell's 59 unapproved
 * posts are the reason the second tone exists; a 59 that reads like "59
 * templates" is a 59 nobody clears.
 */
function CountBadge({ count, tone = 'quiet' }: { count: number; tone?: 'quiet' | 'attention' }) {
  return (
    <span
      className={cn(
        'shrink-0 rounded-[5px] border px-[5px] py-[2px] text-[10px] font-[650] tabular-nums',
        tone === 'attention'
          ? 'mt-px border-transparent bg-[var(--nrs-brand-deep)] text-[var(--nrs-on-brand)]'
          : 'border-[var(--nrs-line)] bg-[var(--nrs-panel-2)] text-[var(--nrs-ink-3)]'
      )}
    >
      {count}
    </span>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** "Downscale Weight Loss" → "DW". Never more than two letters. */
function initialsFrom(name: string): string {
  const letters = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0])
    .join('')
  return letters.toUpperCase() || '·'
}

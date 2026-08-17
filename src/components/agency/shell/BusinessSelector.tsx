'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { Check, ChevronDown, ShieldCheck } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAgencyStore } from '@/stores/agency-store'
import type { Brand } from '@/types/database'

/**
 * The business selector, top of the sidebar.
 *
 * Almost every subscriber runs ONE business. For them this is a label — the
 * name of the thing they are looking at — and a switcher with one item in it is
 * a control that does nothing, which reads as a broken menu rather than as a
 * simple product. So with one business there is no chevron, no menu, and
 * nothing to press. The switcher only appears when there is genuinely somewhere
 * to switch to.
 *
 * Which business is active lives in ONE place: `useAgencyStore.activeBrandId`,
 * persisted under `nrs-agency`. This component reads it and calls `setBrand`.
 * It does not keep its own copy, and it never writes `activeBrandId` directly —
 * `setBrand` also clears the open conversation, which is load-bearing for the
 * Director rail: a conversation belongs to the business it was had about.
 */

const EMPTY_BRANDS: Brand[] = []

export interface BusinessSelectorProps {
  /**
   * Supply when a parent already holds the list. Omitted, the selector loads
   * its own — including the first-run seeding of `activeBrandId`, which has to
   * happen somewhere or the app boots with no business and every screen shows
   * an empty state.
   */
  brands?: Brand[]
  /**
   * Connected social accounts for the active business. Supply when a parent
   * already knows; omitted, the selector counts them itself. `null` means "we
   * do not know", and nothing is shown — better silence than a confident zero.
   */
  accountCount?: number | null
  /** Fired after a switch — the mobile sidebar uses it to close itself. */
  onSelect?: (brandId: string) => void
  className?: string
}

interface AccountsResponse {
  configured?: boolean
  brandMapping?: Record<string, Array<{ authorized?: boolean }>>
}

function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return '?'
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase()
  return (words[0][0] + words[1][0]).toUpperCase()
}

/**
 * Names only the rules that are actually switched on. The copy is fixed for
 * the ordinary case — both flags, which is how all four regulated businesses
 * are set up — but a business carrying only one of them must not be told the
 * other is on. What this indicator claims is what the publish gate enforces.
 */
function complianceLabel(ahpra: boolean, tga: boolean): string | null {
  if (ahpra && tga) return 'Healthcare business — AHPRA & TGA rules on'
  if (ahpra) return 'Healthcare business — AHPRA rules on'
  if (tga) return 'Healthcare business — TGA rules on'
  return null
}

function accountsLine(count: number | null | undefined): string | null {
  if (count === null || count === undefined) return null
  if (count === 0) return 'No accounts connected'
  return count === 1 ? '1 account connected' : `${count} accounts connected`
}

export function BusinessSelector({
  brands: providedBrands,
  accountCount: providedAccountCount,
  onSelect,
  className,
}: BusinessSelectorProps) {
  const router = useRouter()
  const pathname = usePathname()
  const activeBrandId = useAgencyStore((s) => s.activeBrandId)
  const setBrand = useAgencyStore((s) => s.setBrand)

  const [loadedBrands, setLoadedBrands] = useState<Brand[] | null>(null)
  const [loadFailed, setLoadFailed] = useState(false)
  const [countedAccounts, setCountedAccounts] = useState<number | null>(null)
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  const brandsAreProvided = providedBrands !== undefined
  const brands = useMemo(
    () => providedBrands ?? loadedBrands ?? EMPTY_BRANDS,
    [providedBrands, loadedBrands],
  )
  /**
   * "Still loading" and "genuinely has none" look identical in the data and
   * must not look identical on screen — telling an owner with eight businesses
   * that they have none, for the half-second the list takes to arrive, is a
   * lie the interface tells every single load.
   */
  const listKnown = brandsAreProvided || loadedBrands !== null

  // ── The list ───────────────────────────────────────────────────────────────

  useEffect(() => {
    if (brandsAreProvided) return
    let cancelled = false

    const load = async () => {
      try {
        const res = await fetch('/api/brands')
        if (!res.ok) throw new Error(`brands request failed: ${res.status}`)
        const data = await res.json()
        if (cancelled) return
        if (!Array.isArray(data)) throw new Error('brands request returned no list')
        setLoadedBrands(data as Brand[])
        setLoadFailed(false)
      } catch (err) {
        // Logged, never rendered. The owner is told plainly that the list did
        // not load — not what the database thought of the request.
        console.error('[business-selector] could not load businesses', err)
        if (!cancelled) setLoadFailed(true)
      }
    }

    void load()

    return () => {
      cancelled = true
    }
  }, [brandsAreProvided])

  /**
   * Seeding. Two cases, both of which otherwise leave the whole app scoped to
   * nothing: a first-run owner with no stored selection, and a returning owner
   * whose stored selection points at a business that has since been switched
   * off (`/api/brands` only returns active ones).
   */
  useEffect(() => {
    if (brands.length === 0) return
    const stored = useAgencyStore.getState().activeBrandId
    if (stored && brands.some((b) => b.id === stored)) return
    setBrand(brands[0].id)
  }, [brands, setBrand])

  const activeBrand = useMemo(
    () => brands.find((b) => b.id === activeBrandId) ?? null,
    [brands, activeBrandId],
  )

  // ── Connected accounts ─────────────────────────────────────────────────────

  useEffect(() => {
    if (providedAccountCount !== undefined) return
    if (!activeBrandId) return
    let cancelled = false

    fetch('/api/mixpost/accounts')
      .then((res) => (res.ok ? res.json() : null))
      .then((data: AccountsResponse | null) => {
        if (cancelled || !data) return
        const mapped = data.brandMapping?.[activeBrandId] ?? []
        // `authorized` absent means it was not reported, which the mapping
        // layer treats as working rather than as broken. Match it.
        setCountedAccounts(mapped.filter((a) => a.authorized !== false).length)
      })
      .catch(() => {
        // Unknown stays unknown. A failed lookup must not become "0 accounts".
        if (!cancelled) setCountedAccounts(null)
      })

    return () => {
      cancelled = true
    }
  }, [activeBrandId, providedAccountCount])

  const accountCount =
    providedAccountCount !== undefined ? providedAccountCount : countedAccounts

  // ── Switching ──────────────────────────────────────────────────────────────

  const handleSelect = useCallback(
    (brandId: string) => {
      setOpen(false)
      if (brandId === activeBrandId) return
      setBrand(brandId)
      // Every screen reads the active business from the store and re-renders on
      // its own, so switching stays where the owner is — comparing two
      // businesses on the same screen is the whole point of switching. The one
      // thing that cannot stay is an open conversation, which belongs to the
      // business being left.
      if (pathname?.startsWith('/agency/chat/')) router.push('/agency/chat')
      onSelect?.(brandId)
    },
    [activeBrandId, onSelect, pathname, router, setBrand],
  )

  // Close the menu on an outside press or Escape.
  useEffect(() => {
    if (!open) return

    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }

    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  // ── Render ─────────────────────────────────────────────────────────────────

  const flags = activeBrand?.compliance_flags
  const careLabel = complianceLabel(Boolean(flags?.ahpra), Boolean(flags?.tga))
  const isSwitcher = brands.length > 1
  const subtitle = accountsLine(accountCount)

  let title: string
  let titleIsQuiet = false
  if (activeBrand) {
    title = activeBrand.name
  } else if (loadFailed) {
    title = 'Could not load your businesses'
    titleIsQuiet = true
  } else if (!listKnown) {
    title = 'Loading…'
    titleIsQuiet = true
  } else {
    title = 'No business set up yet'
    titleIsQuiet = true
  }

  const face = (
    <>
      <BrandMark brand={activeBrand} />
      <span className="min-w-0 flex-1 text-left">
        <span
          className={cn(
            'block text-[13px] font-semibold leading-tight tracking-[-0.01em]',
            titleIsQuiet ? 'font-normal text-muted-foreground' : 'text-foreground',
          )}
        >
          {title}
        </span>
        {activeBrand && subtitle && (
          <span className="mt-0.5 block text-[11px] font-normal leading-tight text-muted-foreground">
            {subtitle}
          </span>
        )}
      </span>
    </>
  )

  return (
    <div
      ref={rootRef}
      className={cn(
        'relative shrink-0 border-b border-border bg-muted/40 px-3.5 pb-3 pt-3.5',
        className,
      )}
    >
      {/* The menu anchors to the trigger, not to this block — the healthcare
          indicator sits underneath and a menu floating below IT would read as
          belonging to the compliance state rather than to the business name. */}
      <div className="relative">
        {isSwitcher ? (
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-haspopup="listbox"
            aria-expanded={open}
            aria-label={
              activeBrand ? `Business: ${activeBrand.name}. Change business.` : 'Choose a business'
            }
            className="flex w-full items-center gap-2.5 rounded-[10px] border border-border bg-card px-2.5 py-2 text-left transition-colors hover:bg-accent"
          >
            {face}
            <ChevronDown
              className={cn(
                'h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform',
                open && 'rotate-180',
              )}
            />
          </button>
        ) : (
          // One business. A label, not a control — there is nowhere to switch to.
          <div className="flex w-full items-center gap-2.5 rounded-[10px] border border-border bg-card px-2.5 py-2">
            {face}
          </div>
        )}

        {isSwitcher && open && (
          <div className="absolute left-0 right-0 top-[calc(100%+4px)] z-50 overflow-hidden rounded-[10px] border border-border bg-popover shadow-lg">
            <ul
              role="listbox"
              aria-label="Your businesses"
              className="max-h-72 overflow-y-auto py-1"
            >
              {brands.map((brand) => {
                const selected = brand.id === activeBrandId
                return (
                  <li key={brand.id} role="option" aria-selected={selected}>
                    <button
                      type="button"
                      onClick={() => handleSelect(brand.id)}
                      className={cn(
                        'flex w-full items-center gap-2.5 px-2.5 py-2 text-left transition-colors hover:bg-accent',
                        selected && 'bg-accent/60',
                      )}
                    >
                      <BrandMark brand={brand} />
                      <span className="min-w-0 flex-1 truncate text-[13px] leading-tight text-foreground">
                        {brand.name}
                      </span>
                      {selected && <Check className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
                    </button>
                  </li>
                )
              })}
            </ul>
          </div>
        )}
      </div>

      {careLabel && (
        /**
         * An indicator, not a switch. It looks like a state because it is one:
         * turning these rules off changes what this business is legally allowed
         * to publish, so it is changed deliberately in Settings, never flicked
         * in passing from the sidebar.
         */
        <div
          className="mt-2.5 flex items-start gap-2 rounded-[9px] border px-2.5 py-2 border-[oklch(0.89_0.05_25)] bg-[oklch(0.965_0.028_25)] text-[oklch(0.52_0.15_25)] dark:border-[oklch(0.42_0.07_25)] dark:bg-[oklch(0.285_0.045_25)] dark:text-[oklch(0.77_0.13_25)]"
          title="Set in Settings. It changes what this business is allowed to publish."
        >
          <ShieldCheck className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span className="text-[11.5px] font-semibold leading-[1.35]">{careLabel}</span>
        </div>
      )}
    </div>
  )
}

/**
 * The square in front of the name. Falls back to initials on the business
 * accent, so a business with no logo still reads as itself rather than as a
 * gap. The `var(--brand, …)` defaults keep it sane if this is ever mounted
 * outside a shell that has applied the theme.
 */
function BrandMark({ brand }: { brand: Brand | null }) {
  if (brand?.logo_url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={brand.logo_url}
        alt=""
        className="h-[26px] w-[26px] shrink-0 rounded-[7px] object-cover"
      />
    )
  }

  return (
    <span
      aria-hidden="true"
      className="grid h-[26px] w-[26px] shrink-0 place-items-center rounded-[7px] text-[10px] font-semibold leading-none"
      style={{
        background: 'var(--brand, oklch(0.545 0.03 240))',
        color: 'var(--brand-ink, oklch(1 0 0))',
      }}
    >
      {brand ? initials(brand.name) : '·'}
    </span>
  )
}

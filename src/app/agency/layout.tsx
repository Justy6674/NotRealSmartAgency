import { Suspense } from 'react'
import type { CSSProperties } from 'react'
import { unstable_cache } from 'next/cache'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { CircleHelp, PanelLeftClose, PanelLeftOpen } from 'lucide-react'

import { createClient } from '@/lib/supabase/server'
import { listZernioAccounts } from '@/lib/zernio/accounts'
import { zernioProfileIdFromSocialUrls } from '@/lib/studio/overview-accounts'
import { countWaitingOnYou } from '@/lib/posts/desk-status'
import type { NavCounts } from '@/components/agency/shell/nav-sections'
import { AgencySidebar } from '@/components/agency/shell/AgencySidebar'
import { BusinessSelector } from '@/components/agency/shell/BusinessSelector'
import { DirectorRailConnected } from '@/components/agency/shell/DirectorRailConnected'
import { UserMenu } from '@/components/agency/UserMenu'
import { BrandThemeSync } from '@/components/agency/shell/BrandThemeSync'
import { ReloadAppButton } from '@/components/agency/shell/ReloadAppButton'
import { brandThemeVars } from '@/components/agency/shell/brand-theme'
import { InstallPrompt } from '@/components/pwa/InstallPrompt'
import type { Brand } from '@/types/database'

/**
 * THE SHELL. Sidebar · the work · the Director, on every /agency screen.
 *
 * Three columns, one fetch, one tint. What follows is mostly a record of the
 * things that are NOT obvious, because each of them is a way this file has to
 * be wrong in a way that only shows up in the browser.
 *
 * ── One fetch, not five ──────────────────────────────────────────────────
 * AgencyHeader, ChatInterface and ChatPanel each called `/api/brands` on their
 * own, so a single screen made three identical round-trips for the same row.
 * The new sidebar, business selector and rail would have made it five. The
 * businesses are read ONCE here, on the server, with the same query
 * `/api/brands` runs (`is_active`, ordered by name) so nothing downstream sees
 * a different list depending on which component asked, and handed down as
 * props.
 *
 * ── The tint cannot be resolved on the server, and must not flash ────────
 * Which business is active lives in `localStorage` under `nrs-agency`
 * (zustand persist). The server cannot read it. So instead of guessing once
 * and repainting after hydration, EVERY business's accents are emitted as CSS
 * up front, scoped to `[data-brand-id="…"]`, and the shell root carries the
 * attribute. The server sets it to the first business — which is the right
 * answer for the great majority of subscribers, who have one — and a tiny
 * inline script corrects it from the persisted selection while the HTML is
 * still parsing, before anything is painted. No flash, no repaint, and the
 * whole product retints from one attribute.
 *
 * ── Collapse must not need this file to know about it ────────────────────
 * The rail column is `auto`, not a fixed 380px. DirectorRail owns its own
 * collapsed state and renders 380px open, 52px shut, nothing at all below
 * `md` (it has its own pill and sheet down there). An `auto` track follows
 * whatever it renders, so the grid reflows without this file subscribing to
 * anything.
 */

// ─── Brand accents, one rule per business ────────────────────────────────────

/** The shell root. Everything below it reads `var(--brand)` and retints free. */
const SHELL = '[data-nrs-shell]'

/**
 * The scrim behind the phone drawer.
 *
 * The drawer opens on `:target` so this file can stay a Server Component (see
 * the sidebar block below). The dimming behind it therefore has to key off the
 * same thing, and "the element AFTER the one that is :target" is a sibling
 * relationship Tailwind has no variant for — so it is one hand-written rule
 * rather than a client component and a piece of state.
 *
 * Without it the drawer floats over a fully lit screen with no indication that
 * the rest of the page is now behind something, and — worse on a phone — no
 * obvious way back out other than finding the small close button. Tapping the
 * scrim navigates to `#`, which stops `:target` matching and shuts the drawer.
 */
const NAV_SCRIM = `
#nrs-nav ~ [data-nrs-nav-scrim]{opacity:0;pointer-events:none;transition:opacity .2s}
#nrs-nav:target ~ [data-nrs-nav-scrim]{opacity:1;pointer-events:auto}
@media (min-width:1024px){#nrs-nav ~ [data-nrs-nav-scrim]{display:none}}
`.trim()

function cssDecls(vars: CSSProperties): string {
  return Object.entries(vars)
    .filter((entry): entry is [string, string] => typeof entry[1] === 'string')
    .map(([name, value]) => `${name}:${value}`)
    .join(';')
}

function brandThemeStyles(brands: Brand[]): string {
  const rules: string[] = []

  const rule = (selector: string, decls: string) => {
    if (decls) rules.push(`${selector}{${decls}}`)
  }

  const fallbackLight = cssDecls(brandThemeVars(null, { dark: false }))
  rule(SHELL, fallbackLight)

  for (const brand of brands) {
    if (!/^[A-Za-z0-9_-]+$/.test(brand.id)) continue

    const scoped = `${SHELL}[data-brand-id="${brand.id}"]`
    rule(scoped, cssDecls(brandThemeVars(brand, { dark: false })))
  }

  return rules.join('\n')
}

/**
 * Mirrors the persisted business selection onto the shell root.
 *
 * Runs while the document is still parsing, so the correct accents are in
 * place before the first paint even when the stored selection is not the
 * business the server guessed.
 *
 * Staying correct afterwards is the awkward part. `setBrand` writes through
 * zustand's persist middleware, and a same-tab `localStorage` write fires no
 * event — `storage` only fires in OTHER tabs. Rather than poll (a visible
 * quarter-second lag on every switch) the write itself is wrapped, narrowly:
 * one key, one extra call, the original `setItem` still does the writing. The
 * alternative is a client component, and this file is a Server Component
 * precisely so the auth check and the fetch stay on the server.
 */
const TINT_SYNC = `
(function () {
  var KEY = 'nrs-agency'
  function paint() {
    var shell = document.querySelector('[data-nrs-shell]')
    if (!shell) return
    var id = null
    try {
      var raw = window.localStorage.getItem(KEY)
      if (raw) {
        var parsed = JSON.parse(raw)
        id = (parsed && parsed.state && parsed.state.activeBrandId) || null
      }
    } catch (e) {
      /* Storage blocked. The server's answer stands — never a reason to fail. */
    }
    if (id && shell.getAttribute('data-brand-id') !== id) {
      shell.setAttribute('data-brand-id', id)
    }
  }
  paint()
  if (window.__nrsShellTint) return
  window.__nrsShellTint = 1
  try {
    var store = window.localStorage
    var write = store.setItem.bind(store)
    store.setItem = function (key, value) {
      write(key, value)
      if (key === KEY) { try { paint() } catch (e) {} }
    }
  } catch (e) {}
  window.addEventListener('storage', function (e) { if (!e.key || e.key === KEY) paint() })
  window.addEventListener('nrs-business-changed', paint)
})()
`.trim()

// ─── First-paint counts ──────────────────────────────────────────────────────

/**
 * The numbers the sidebar draws, for the business the server can see.
 *
 * `AgencySidebar` has taken a `counts` prop since it was written and this file
 * has never passed one, so not a single badge in the product could render —
 * including "Waiting on you", the number the whole approval flow depends on the
 * owner noticing. That is fixed here for the FIRST PAINT; the sidebar re-reads
 * them for whichever business is actually selected, because the selection lives
 * in localStorage and a Server Component cannot see it. `countsBrandId` travels
 * with them so a stale number is never drawn beside another business's name.
 *
 * Only the approval queue is counted here, and it is counted with the SAME
 * predicate as everywhere else — `isWaitingOnYou` in `@/lib/posts/desk-status`.
 * This used to ask for `status IN ('draft','failed')`, which is a different
 * question: it painted 68 for Scent Sell, then `/api/social/nav-counts`
 * answered 17 a moment later and the badge changed under the owner's eye. A
 * number that moves on its own is a number nobody acts on.
 *
 * "Waiting on you" is not a value in the status column — it is a draft an
 * assistant wrote that has not been approved — so the rows come back and are
 * counted here rather than by Postgres. `WAITING_ROW_CAP` bounds that: past it
 * we do not know the answer, and the badge renders bare rather than stating a
 * floor as if it were exact. The live business carries 121 rows.
 */
const WAITING_ROW_CAP = 2000

async function waitingCountFor(
  supabase: Awaited<ReturnType<typeof createClient>>,
  brandId: string,
): Promise<number | undefined> {
  const { data, count, error } = await supabase
    .from('scheduled_posts')
    .select('id, status, metadata', { count: 'exact' })
    .eq('brand_id', brandId)
    .eq('status', 'draft')
    .limit(WAITING_ROW_CAP)

  if (error) {
    console.error('[agency-layout] approval queue could not be counted', error)
    return undefined
  }
  if (!Array.isArray(data)) return undefined
  // Truncated by the cap: we did not see every row, so we do not know.
  if (typeof count === 'number' && count > data.length) return undefined
  return countWaitingOnYou(data)
}

/**
 * "3 accounts connected", under the business name.
 *
 * Cached for five minutes per profile on purpose: it is the one figure here
 * that costs a call to the publisher, this layout re-runs on navigation, and
 * how many accounts a business has connected does not change between two
 * clicks. The business selector reads the live figure for the SELECTED business
 * through /api/social/nav-counts; this is only what the page opens with.
 */
const connectedAccounts = unstable_cache(
  async (profileId: string): Promise<number | null> => {
    try {
      const accounts = await listZernioAccounts({ profileId, status: 'connected' })
      return accounts.length
    } catch (err) {
      // Silence, not a zero. "No accounts connected" is a claim about the
      // business; a failed lookup is a claim about us.
      console.error('[agency-layout] connected accounts could not be counted', err)
      return null
    }
  },
  ['nrs-agency-connected-accounts'],
  { revalidate: 300 },
)

function accountsLine(count: number | null): string | null {
  if (count === null) return null
  if (count === 0) return 'No accounts connected'
  return count === 1 ? '1 account connected' : `${count} accounts connected`
}

// ─── The shell ───────────────────────────────────────────────────────────────

export default async function AgencyLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login?redirect=/agency')
  }

  // `select('*')` deliberately: this is the exact row `/api/brands` returns,
  // and the components downstream are typed against the whole `Brand`. A
  // trimmed column list would type-check and then fail the first time one of
  // them read a field nobody thought to list.
  const { data: brandRows, error: brandsError } = await supabase
    .from('brands')
    .select('*')
    .eq('is_active', true)
    .order('name')

  if (brandsError) {
    // Logged, never rendered. The screens below say plainly that there is no
    // business yet; they must not read out a PostgREST message.
    console.error('[agency-layout] businesses could not be loaded', brandsError)
  }

  const brands = (brandRows ?? []) as Brand[]

  /**
   * The server's answer to "which business", used for the first paint and for
   * the sidebar's own labels. It is the right answer whenever there is one
   * business, which is almost always; the inline script above corrects the
   * TINT for everyone else, and the business selector shows them the live one.
   */
  const primaryBrand = brands[0] ?? null

  const zernioProfileId = zernioProfileIdFromSocialUrls(primaryBrand?.social_urls)
  const [waiting, accountCount] = primaryBrand
    ? await Promise.all([
        waitingCountFor(supabase, primaryBrand.id),
        zernioProfileId ? connectedAccounts(zernioProfileId) : Promise.resolve(null),
      ])
    : [undefined, null]

  const counts: NavCounts = waiting === undefined ? {} : { 'social-waiting': waiting }
  const businessSubtitle = accountsLine(accountCount)

  /**
   * Hand the selector the server's figure ONLY when there is one business,
   * because that is the only case where "the business the server guessed" and
   * "the business the owner has selected" are provably the same. With several,
   * the selector reads the live figure for whichever one is selected — the
   * alternative is describing one business's accounts under another's name,
   * which is the exact fault the unscoped account fetch used to have.
   */
  const seedAccountCount =
    brands.length === 1 && accountCount !== null ? accountCount : undefined

  return (
    <div
      data-nrs-shell=""
      data-brand-id={primaryBrand?.id}
      // The inline script rewrites data-brand-id before React hydrates. That is
      // the intended behaviour, not a mismatch to repair.
      suppressHydrationWarning
      className={[
        'grid h-dvh w-full overflow-hidden bg-[var(--bg)]',
        // Below lg the sidebar leaves the flow (it becomes a drawer), so the
        // work gets the full width and the rail sizes itself to nothing.
        'grid-cols-[minmax(0,1fr)_auto] grid-rows-[minmax(0,1fr)]',
        'lg:grid-cols-[236px_minmax(0,1fr)_auto]',
        // Landscape on a notched phone puts the camera cutout beside the
        // content, not above it. Handled once on the grid rather than in every
        // column; on anything without a cutout env() is 0 and this is inert.
        // Top and bottom are NOT done here — a fixed drawer ignores its
        // parent's padding, so those insets are applied where they land.
        'pr-[env(safe-area-inset-right)] lg:pl-[env(safe-area-inset-left)]',
      ].join(' ')}
    >
      <style dangerouslySetInnerHTML={{ __html: `${brandThemeStyles(brands)}\n${NAV_SCRIM}` }} />
      <script dangerouslySetInnerHTML={{ __html: TINT_SYNC }} />
      <BrandThemeSync brands={brands} />

      {/*
        SIDEBAR. A column at lg and up; an off-canvas drawer below it, opened
        by the `#nrs-nav` link in the work column and closed by choosing a
        destination — following a Link drops the hash, so `:target` stops
        matching on its own. Done in CSS on purpose: a drawer that needs a
        client component would have forced this whole file off the server, and
        with it the auth check and the single fetch.
      */}
      <div
        id="nrs-nav"
        className={[
          'z-50 flex w-[236px] flex-col overflow-y-auto border-r bg-[var(--panel)]',
          'fixed inset-y-0 left-0 shadow-2xl',
          '-translate-x-full transition-transform duration-200 [&:target]:translate-x-0',
          // A fixed element is positioned against the viewport, so the grid's
          // padding above does not reach it and it has to carry its own insets:
          // under the notch at the top, under the home indicator at the bottom,
          // and clear of the left cutout in landscape.
          'pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)]',
          // Momentum scrolling inside the drawer must not drag the page behind
          // it once the list bottoms out.
          'overscroll-contain',
          'lg:static lg:z-auto lg:translate-x-0 lg:p-0 lg:shadow-none lg:transition-none',
        ].join(' ')}
      >
        {/* Product chrome: the things that belong to the account rather than to
            the business. Sits above the business block so the account menu has
            room to open downward — at the foot of the column it opened off the
            bottom of the screen. */}
        <div className="flex shrink-0 items-center gap-0.5 border-b px-2 py-2">
          <div className="min-w-0 flex-1">
            <UserMenu />
          </div>
          <ReloadAppButton />
          <Link
            href="https://help.notrealsmart.com.au"
            target="_blank"
            title="Help centre"
            // 44px square on a phone, the smallest thing a thumb hits
            // reliably; back to the 28px chrome square at lg where there is a
            // pointer. A 16px icon in 6px of padding is a 28px target, which is
            // under every touch guideline there is.
            className="flex h-11 w-11 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground lg:h-auto lg:w-auto lg:p-1.5"
          >
            <CircleHelp className="h-4 w-4" />
          </Link>
          <a
            href="#"
            aria-label="Hide the menu"
            title="Hide the menu"
            className="flex h-11 w-11 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground lg:hidden"
          >
            <PanelLeftClose className="h-4 w-4" />
          </a>
        </div>

        {/*
          One selector, inside the sidebar. It seeds the store (even with a
          single business) and is the only switcher when there are several —
          drawing it here AND letting AgencySidebar invent a second block was
          how the restored stash stacked two business cards.
        */}
        <Suspense fallback={<div className="min-h-0 flex-1" />}>
          <AgencySidebar
            businessSelector={<BusinessSelector brands={brands} accountCount={seedAccountCount} />}
            brands={brands}
            businessName={primaryBrand?.name ?? null}
            businessSubtitle={businessSubtitle}
            businessCount={brands.length}
            counts={counts}
            countsBrandId={primaryBrand?.id ?? null}
            complianceFlags={primaryBrand?.compliance_flags ?? null}
            className="w-full border-r-0"
          />
        </Suspense>
      </div>

      {/*
        The scrim. Must stay the NEXT SIBLING of #nrs-nav — the rule that shows
        it is `#nrs-nav:target ~ [data-nrs-nav-scrim]`, so moving this anywhere
        above the drawer silently stops it working, with no error anywhere.
        `href="#"` is the whole close mechanism: it drops the hash, `:target`
        stops matching, and the drawer slides away.
      */}
      <a
        href="#"
        data-nrs-nav-scrim=""
        aria-label="Close the menu"
        tabIndex={-1}
        // --ink at 45%, not bg-black/40. The house has no black in it; a true
        // black scrim under paper-white chrome reads as a different product.
        className="fixed inset-0 z-40 bg-[oklch(0.20_0.014_240/.45)] lg:hidden"
      />

      {/* THE WORK. Law 1: complete and usable with the Director collapsed. */}
      <main className="flex min-h-0 min-w-0 flex-col overflow-hidden pb-[env(safe-area-inset-bottom)] lg:pb-0">
        <div className="flex shrink-0 items-center gap-2 border-b px-2 py-1 pt-[calc(0.25rem+env(safe-area-inset-top))] lg:hidden">
          {/* The only thing here is the way back to the menu. The business is
              named in the sidebar and on the screen itself; saying it a third
              time on the one viewport with no room for it earns nothing. */}
          <a
            href="#nrs-nav"
            className="flex min-h-11 items-center gap-2 rounded-md px-3 text-[13px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <PanelLeftOpen className="h-4 w-4" />
            Menu
          </a>
        </div>

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">{children}</div>
      </main>

      {/*
        THE DIRECTOR. Law 2: on every screen, its input pinned. The wrapper
        exists so the rail's several roots (open column, collapsed strip,
        mobile pill, mobile sheet) stay inside ONE grid cell instead of each
        becoming a grid item of its own.
      */}
      <div className="flex min-h-0">
        <DirectorRailConnected brandName={primaryBrand?.name ?? null} brands={brands} />
      </div>

      {/*
        "Keep this on your home screen" — once, then never again. Mounted on the
        desk rather than in the root layout on purpose: the only person for whom
        installing this means anything is someone who has signed in, and asking
        a first-time visitor on the marketing site to install an app they have
        not seen is how install banners earned their reputation.
      */}
      <InstallPrompt />
    </div>
  )
}

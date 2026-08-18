import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { CircleHelp, PanelLeftClose, PanelLeftOpen } from 'lucide-react'

import { createClient } from '@/lib/supabase/server'
import { AgencySidebar } from '@/components/agency/shell/AgencySidebar'
import { BusinessSelector } from '@/components/agency/shell/BusinessSelector'
import { DirectorRailConnected } from '@/components/agency/shell/DirectorRailConnected'
import { ThemeToggle } from '@/components/agency/ThemeToggle'
import { UserMenu } from '@/components/agency/UserMenu'
import { BrandThemeSync } from '@/components/agency/shell/BrandThemeSync'
import { ReloadAppButton } from '@/components/agency/shell/ReloadAppButton'
import {
  brandHasSurfacePalette,
  brandThemeVars,
} from '@/components/agency/shell/brand-theme'
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

function cssDecls(vars: Record<string, unknown>): string {
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
  const fallbackDark = cssDecls(brandThemeVars(null, { dark: true }))
  rule(SHELL, fallbackLight)
  rule(`.dark ${SHELL}`, fallbackDark)

  for (const brand of brands) {
    if (!/^[A-Za-z0-9_-]+$/.test(brand.id)) continue

    const scoped = `${SHELL}[data-brand-id="${brand.id}"]`
    const lightVars = brandThemeVars(brand, { dark: false })
    const darkVars = brandHasSurfacePalette(brand)
      ? lightVars
      : brandThemeVars(brand, { dark: true })

    rule(scoped, cssDecls(lightVars))
    rule(`.dark ${scoped}`, cssDecls(darkVars))
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
      ].join(' ')}
    >
      <style dangerouslySetInnerHTML={{ __html: brandThemeStyles(brands) }} />
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
          'lg:static lg:z-auto lg:translate-x-0 lg:shadow-none lg:transition-none',
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
          <ThemeToggle />
          <ReloadAppButton />
          <Link
            href="https://help.notrealsmart.com.au"
            target="_blank"
            title="Help centre"
            className="flex items-center justify-center rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <CircleHelp className="h-4 w-4" />
          </Link>
          <a
            href="#"
            aria-label="Hide the menu"
            title="Hide the menu"
            className="flex items-center justify-center rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground lg:hidden"
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
            businessSelector={<BusinessSelector brands={brands} />}
            brands={brands}
            businessName={primaryBrand?.name ?? null}
            businessCount={brands.length}
            complianceFlags={primaryBrand?.compliance_flags ?? null}
            className="w-full border-r-0"
          />
        </Suspense>
      </div>

      {/* THE WORK. Law 1: complete and usable with the Director collapsed. */}
      <main className="flex min-h-0 min-w-0 flex-col overflow-hidden">
        <div className="flex shrink-0 items-center gap-2 border-b px-2 py-1.5 lg:hidden">
          {/* The only thing here is the way back to the menu. The business is
              named in the sidebar and on the screen itself; saying it a third
              time on the one viewport with no room for it earns nothing. */}
          <a
            href="#nrs-nav"
            className="flex items-center gap-2 rounded-md px-2 py-1.5 text-[13px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
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
    </div>
  )
}

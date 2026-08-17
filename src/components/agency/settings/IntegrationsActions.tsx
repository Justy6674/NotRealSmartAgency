'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowUpRight, Loader2, RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'
import { FOCUS_RING } from '@/lib/ui/focus'
import { TONE_TEXT } from '@/lib/ui/status-tone'

/**
 * Declared here rather than alongside the loader on purpose: this file crosses
 * the client boundary, and a value imported from the loader module drags
 * `next/headers` into the browser bundle and breaks the build.
 *
 * These are the five that both Zernio's connect endpoint accepts and this
 * agency actually publishes to. Mastodon is not a Zernio platform at all, and
 * Bluesky needs an app password rather than this OAuth handover — both appear
 * on the older Studio dialog and both fail there.
 */
const CONNECTABLE_PLATFORMS = [
  { key: 'instagram', label: 'Instagram' },
  { key: 'facebook', label: 'Facebook' },
  { key: 'tiktok', label: 'TikTok' },
  { key: 'youtube', label: 'YouTube' },
  { key: 'linkedin', label: 'LinkedIn' },
] as const

/**
 * Re-reads every publisher. The page is rendered per request, so a refresh is
 * the whole check — there is no cached copy to invalidate.
 */
export function RecheckButton() {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  return (
    <button
      type="button"
      onClick={() => startTransition(() => router.refresh())}
      disabled={pending}
      className={cn(
        'inline-flex shrink-0 items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium text-foreground transition-colors',
        'hover:bg-accent active:bg-accent/80 disabled:cursor-not-allowed disabled:opacity-60',
        FOCUS_RING,
      )}
    >
      {pending ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
      ) : (
        <RefreshCw className="h-3.5 w-3.5" aria-hidden />
      )}
      {pending ? 'Checking' : 'Check again'}
    </button>
  )
}

/**
 * Starts the real OAuth handover.
 *
 * `/api/zernio/connect` answers with a sign-in URL rather than redirecting, so
 * this asks for that URL and then sends the whole tab to it. No popup, no
 * dialog — the owner ends up on the platform's own sign-in screen, which is
 * the only screen that can be trusted for entering credentials.
 *
 * That route also creates a Zernio profile for the brand on first use and
 * writes it back, which is what moves the brand off Mixpost. The copy says so
 * before the button is pressed, because it is not reversible from this page.
 */
export function ConnectViaZernio({
  brands,
  defaultBrandId,
}: {
  brands: Array<{ id: string; name: string }>
  defaultBrandId?: string
}) {
  const [brandId, setBrandId] = useState(defaultBrandId ?? brands[0]?.id ?? '')
  const [starting, setStarting] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const brandName = brands.find((b) => b.id === brandId)?.name ?? 'this brand'

  const begin = async (platform: string, label: string) => {
    setError(null)
    setStarting(platform)
    try {
      const res = await fetch(
        `/api/zernio/connect?platform=${encodeURIComponent(platform)}&brandId=${encodeURIComponent(brandId)}`,
        { cache: 'no-store' },
      )
      const data = (await res.json().catch(() => ({}))) as { authUrl?: string }

      if (!res.ok || !data.authUrl) {
        // The upstream message can carry a raw response body, so it is not
        // repeated here. A sign-in that did not start changed nothing, and
        // saying that plainly is more use than the server's wording.
        setError(
          `Zernio did not return a sign-in link for ${label}. Nothing has changed for ${brandName}. Try again, and if it keeps happening ${label} is not available on this Zernio workspace.`,
        )
        setStarting(null)
        return
      }

      // Full-page handover. Deliberately not restoring the button state — the
      // tab is leaving, and a control that springs back to "ready" mid-navigation
      // reads as a failure.
      window.location.href = data.authUrl
    } catch {
      setError(
        `Could not reach this site’s Zernio route to start the ${label} sign-in. Nothing has changed for ${brandName}. Try again in a moment.`,
      )
      setStarting(null)
    }
  }

  if (brands.length === 0) return null

  return (
    <div className="mt-5 border-t border-border pt-5">
      <h3 className="text-sm font-semibold text-foreground">Move a brand onto Zernio</h3>
      <p className="mt-1 max-w-2xl text-xs leading-relaxed text-muted-foreground">
        Signing in here creates a Zernio profile for the brand and records it against that brand. From that moment its
        posts route through Zernio instead of Mixpost, on every platform it has connected there. Do this on one brand at
        a time.
      </p>

      <div className="mt-4 flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="zernio-connect-brand" className="text-xs font-medium text-foreground">
            Brand
          </label>
          <select
            id="zernio-connect-brand"
            value={brandId}
            onChange={(e) => {
              setBrandId(e.target.value)
              setError(null)
            }}
            disabled={starting !== null}
            className={cn(
              'h-9 min-w-52 rounded-md border border-border bg-background px-3 text-sm text-foreground transition-colors',
              'hover:border-foreground/25 disabled:cursor-not-allowed disabled:opacity-60',
              FOCUS_RING,
            )}
          >
            {brands.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-foreground">Sign in to</span>
          <div className="flex flex-wrap gap-2">
            {CONNECTABLE_PLATFORMS.map((platform) => {
              const isStarting = starting === platform.key
              return (
                <button
                  key={platform.key}
                  type="button"
                  onClick={() => void begin(platform.key, platform.label)}
                  disabled={starting !== null || !brandId}
                  className={cn(
                    'inline-flex h-9 items-center gap-1.5 rounded-md bg-foreground px-3.5 text-sm font-medium text-background transition-colors',
                    'hover:bg-foreground/90 active:bg-foreground/80',
                    'disabled:cursor-not-allowed disabled:opacity-45',
                    FOCUS_RING,
                  )}
                >
                  {isStarting ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                  ) : (
                    <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
                  )}
                  {isStarting ? 'Opening' : platform.label}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {error && (
        <p
          role="alert"
          className={cn('mt-3 max-w-2xl text-xs leading-relaxed', TONE_TEXT.attention)}
        >
          {error}
        </p>
      )}
    </div>
  )
}

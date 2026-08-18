'use client'

import { useEffect, useState } from 'react'
import { ownerFacingPlatformLabel } from '@/lib/studio/social-read-source'

/**
 * Which platforms this business can actually post to.
 *
 * ── THE LEAK THIS CLOSES ───────────────────────────────────────────────
 * This hook took a `brandId`, then fetched `/api/mixpost/accounts` with **no
 * brandId on the URL**. That route answers the unscoped call with the entire
 * fallback workspace — every account belonging to every business — and the hook
 * then reached into `brandMapping[brandId]` to pick its rows out of it. So the
 * browser was handed the whole workspace on every render, for a filter it then
 * did in JavaScript, and a business linked to its own publisher got no Zernio
 * branch at all: the chrome described a different publisher's accounts back to
 * the owner as if they were his.
 *
 * The linked publisher is now asked first, exactly as `useSocialAccounts` does,
 * and the fallback is asked WITH the brand id so the response is scoped before
 * it ever reaches the browser. The two are never merged: a linked business
 * whose list is empty is empty, not "and here is the other workspace".
 *
 * An account that cannot post is not a connected platform. A lapsed Instagram
 * used to keep Instagram lit up in the composer, and the post failed later for
 * reasons that read as nothing to do with the connection.
 */
export function useConnectedPlatforms(brandId: string | null) {
  const [platforms, setPlatforms] = useState<string[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!brandId) {
      setPlatforms([])
      setLoading(false)
      return
    }

    let cancelled = false

    async function fetchPlatforms(id: string) {
      setLoading(true)
      try {
        const linkedRes = await fetch(`/api/zernio/accounts?brandId=${id}`)
        const linked = (await linkedRes.json().catch(() => null)) as {
          linked?: boolean
          accounts?: Array<{ platform?: string; health?: string; needsReconnect?: boolean; enabled?: boolean }>
        } | null

        if (linkedRes.ok && linked?.linked) {
          const usable = (linked.accounts ?? []).filter(
            (a) => a.enabled !== false && a.needsReconnect !== true && a.health !== 'error',
          )
          // Owner-facing labels on BOTH branches. The fallback has always
          // returned "Instagram" / "Facebook", and every consumer — the Desk's
          // platform options, the video import panel — matches on that
          // vocabulary. Returning raw slugs from one branch only would light up
          // different platforms depending on which publisher a business is on.
          if (!cancelled) {
            setPlatforms([...new Set(usable.map((a) => ownerFacingPlatformLabel(a.platform ?? '')))])
          }
          return
        }

        // Scoped at the server. The brand id on this URL is the whole point.
        const res = await fetch(`/api/mixpost/accounts?brandId=${id}`)
        if (!res.ok) {
          if (!cancelled) setPlatforms([])
          return
        }

        const data = (await res.json()) as {
          configured?: boolean
          brandMapping?: Record<
            string,
            Array<{ platform: string; accountName: string; provider: string; authorized?: boolean }>
          >
        }

        if (!data.configured || !data.brandMapping) {
          if (!cancelled) setPlatforms([])
          return
        }

        const mappings = data.brandMapping[id]
        if (!cancelled) {
          setPlatforms(
            mappings
              ? [...new Set(mappings.filter((m) => m.authorized !== false).map((m) => m.platform))]
              : [],
          )
        }
      } catch {
        if (!cancelled) setPlatforms([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void fetchPlatforms(brandId)
    return () => { cancelled = true }
  }, [brandId])

  return { platforms, loading }
}

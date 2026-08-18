'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useAgencyStore } from '@/stores/agency-store'

/**
 * Inbox and ads hang off Analytics (D15) — no new Social tab.
 * Owner strings never name the publisher.
 */
export function SocialHangOffs() {
  const { activeBrandId } = useAgencyStore()
  const [inboxCount, setInboxCount] = useState<number | null>(null)
  const [adsCount, setAdsCount] = useState<number | null>(null)

  useEffect(() => {
    if (!activeBrandId) return
    void fetch(`/api/inbox?brandId=${activeBrandId}&status=backlog`)
      .then((r) => (r.ok ? r.json() : []))
      .then((items: unknown) => {
        const count = Array.isArray(items) ? items.length : 0
        setInboxCount(count > 0 ? count : null)
      })
      .catch(() => setInboxCount(null))

    void fetch(`/api/zernio/ads?brandId=${activeBrandId}`)
      .then((r) => (r.ok ? r.json() : { campaigns: [] }))
      .then((data: { campaigns?: unknown[] }) => {
        const count = Array.isArray(data.campaigns) ? data.campaigns.length : 0
        setAdsCount(count > 0 ? count : null)
      })
      .catch(() => setAdsCount(null))
  }, [activeBrandId])

  if (!inboxCount && !adsCount) return null

  return (
    <div className="flex flex-wrap gap-2">
      {inboxCount != null && (
        <Link
          href="/agency/engagement"
          className="rounded-full border border-border bg-background px-3 py-1 text-[11px] text-foreground hover:bg-muted"
        >
          {inboxCount} waiting on a reply
        </Link>
      )}
      {adsCount != null && (
        <Link
          href="/agency/ads"
          className="rounded-full border border-border bg-background px-3 py-1 text-[11px] text-foreground hover:bg-muted"
        >
          {adsCount} ads running
        </Link>
      )}
    </div>
  )
}

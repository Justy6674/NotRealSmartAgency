'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { TemplatesIndex } from '@/components/agency/studio/templates/TemplatesIndex'
import { useAgencyStore } from '@/stores/agency-store'
import type { Brand } from '@/types/database'

/**
 * The department shell supplies the scrolling, padded pane, so nothing is
 * wrapped around the index here. Creating or editing a template stays on
 * `/agency/social/templates/[templateId]` — inside this chrome — rather than
 * throwing the owner out to the Studio route the editor used to live on.
 */
export default function SocialTemplatesPage() {
  const { activeBrandId } = useAgencyStore()
  const [brand, setBrand] = useState<Brand | null>(null)

  useEffect(() => {
    if (!activeBrandId) {
      setBrand(null)
      return
    }
    let cancelled = false
    fetch('/api/brands')
      .then((res) => (res.ok ? res.json() : null))
      .then((data: Brand[] | null) => {
        if (cancelled || !data) return
        setBrand(data.find((b) => b.id === activeBrandId) ?? null)
      })
      .catch(() => {
        /* the index renders its own empty state; a brand name is decoration */
      })
    return () => {
      cancelled = true
    }
  }, [activeBrandId])

  return <TemplatesIndex brandId={activeBrandId} brandName={brand?.name} />
}

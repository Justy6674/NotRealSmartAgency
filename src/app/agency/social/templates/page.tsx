'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { TemplatesIndex } from '@/components/agency/studio/templates/TemplatesIndex'
import { useAgencyStore } from '@/stores/agency-store'
import type { Brand } from '@/types/database'

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
        /* ignore */
      })
    return () => {
      cancelled = true
    }
  }, [activeBrandId])

  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-6">
      <TemplatesIndex brandId={activeBrandId} brandName={brand?.name} />
    </div>
  )
}

'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { RoomLayout } from '@/components/agency/studio/RoomLayout'
import { TemplatesIndex } from '@/components/agency/studio/templates/TemplatesIndex'
import { useAgencyStore } from '@/stores/agency-store'
import type { Brand } from '@/types/database'

export default function TemplatesPage() {
  const { activeBrandId } = useAgencyStore()
  const [brand, setBrand] = useState<Brand | null>(null)

  useEffect(() => {
    if (!activeBrandId) {
      setBrand(null)
      return
    }
    let cancelled = false
    fetch('/api/brands')
      .then(res => (res.ok ? res.json() : null))
      .then((data: Brand[] | null) => {
        if (cancelled || !data) return
        setBrand(data.find(b => b.id === activeBrandId) ?? null)
      })
      .catch(() => { /* ignore */ })
    return () => { cancelled = true }
  }, [activeBrandId])

  return (
    <RoomLayout title="Templates">
      <TemplatesIndex brandId={activeBrandId} brandName={brand?.name} />
    </RoomLayout>
  )
}

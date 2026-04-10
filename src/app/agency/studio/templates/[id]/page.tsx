'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState, use } from 'react'
import { RoomLayout } from '@/components/agency/studio/RoomLayout'
import { TemplateEditor } from '@/components/agency/studio/templates/TemplateEditor'
import { useAgencyStore } from '@/stores/agency-store'
import type { Brand } from '@/types/database'

interface PageProps {
  params: Promise<{ id: string }>
}

export default function TemplateEditorPage({ params }: PageProps) {
  const { id } = use(params)
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
    <RoomLayout title="Edit template">
      <TemplateEditor
        brandId={activeBrandId}
        brandName={brand?.name}
        templateId={id}
      />
    </RoomLayout>
  )
}

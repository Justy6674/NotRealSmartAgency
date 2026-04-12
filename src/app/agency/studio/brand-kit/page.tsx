'use client'
export const dynamic = 'force-dynamic'

import { RoomLayout } from '@/components/agency/studio/RoomLayout'
import { BrandKitShowcase } from '@/components/agency/studio/brand-kit/BrandKitShowcase'
import { useAgencyStore } from '@/stores/agency-store'

export default function BrandKitPage() {
  const { activeBrandId } = useAgencyStore()

  return (
    <RoomLayout title="Brand Kit">
      <BrandKitShowcase brandId={activeBrandId} />
    </RoomLayout>
  )
}

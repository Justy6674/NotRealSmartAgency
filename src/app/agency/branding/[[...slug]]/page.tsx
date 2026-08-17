'use client'

export const dynamic = 'force-dynamic'

import { usePathname } from 'next/navigation'
import { DepartmentNotReadyForPath } from '@/components/agency/shell/DepartmentNotReady'
import { BrandKitShowcase } from '@/components/agency/studio/brand-kit/BrandKitShowcase'
import { useAgencyStore } from '@/stores/agency-store'

export default function BrandingDepartmentPage() {
  const pathname = usePathname() ?? ''
  const { activeBrandId } = useAgencyStore()

  if (pathname === '/agency/branding' || pathname === '/agency/branding/identity') {
    return (
      <div className="min-h-0 flex-1 overflow-y-auto p-6">
        <BrandKitShowcase brandId={activeBrandId} />
      </div>
    )
  }

  return <DepartmentNotReadyForPath />
}

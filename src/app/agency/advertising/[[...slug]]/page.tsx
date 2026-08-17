'use client'

export const dynamic = 'force-dynamic'

import { usePathname } from 'next/navigation'
import { AdsCommandCentre } from '@/components/agency/ads/AdsCommandCentre'
import { DepartmentNotReady } from '@/components/agency/shell/DepartmentNotReady'

export default function AdvertisingDepartmentPage() {
  const pathname = usePathname() ?? ''

  if (pathname.endsWith('/health-rules')) {
    return (
      <DepartmentNotReady
        title="Ad rules for health — not set up"
        body="Every ad still goes through the AHPRA/TGA check before it can run. This screen will become the written record of those rules. It is not connected yet."
      />
    )
  }

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <AdsCommandCentre />
    </div>
  )
}

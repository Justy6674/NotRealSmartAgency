'use client'

export const dynamic = 'force-dynamic'

import { usePathname } from 'next/navigation'
import { useAgencyStore } from '@/stores/agency-store'
import { BrandKitShowcase } from '@/components/agency/studio/brand-kit/BrandKitShowcase'
import { BrandingVoiceDept } from '@/components/agency/branding/BrandingVoiceDept'

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

  if (pathname === '/agency/branding/voice') {
    return <BrandingVoiceDept view="voice" />
  }

  if (pathname === '/agency/branding/words') {
    return <BrandingVoiceDept view="words" />
  }

  if (pathname === '/agency/branding/topics') {
    return <BrandingVoiceDept view="topics" />
  }

  // Catch-all fallback for any future sub-routes
  return <BrandingVoiceDept view="voice" />
}

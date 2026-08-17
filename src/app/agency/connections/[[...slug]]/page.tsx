'use client'

export const dynamic = 'force-dynamic'

import { usePathname } from 'next/navigation'
import { useAgencyStore } from '@/stores/agency-store'
import { useStudioData } from '@/hooks/useStudioData'
import { AccountsPage } from '@/components/agency/studio/accounts/AccountsPage'
import { ConnectionsIndex } from '@/components/agency/connections/ConnectionsIndex'

export default function ConnectionsDepartmentPage() {
  const pathname = usePathname() ?? ''
  const { activeBrandId } = useAgencyStore()
  const { brand } = useStudioData(activeBrandId)

  // Sub-route: social accounts management
  if (pathname === '/agency/connections/social') {
    return (
      <div className="min-h-0 flex-1 overflow-y-auto">
        <AccountsPage />
      </div>
    )
  }

  // Root: connections hub
  return <ConnectionsIndex brand={brand ?? null} />
}

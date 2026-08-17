'use client'

export const dynamic = 'force-dynamic'

import { usePathname } from 'next/navigation'
import { DepartmentNotReadyForPath } from '@/components/agency/shell/DepartmentNotReady'
import { AccountsPage } from '@/components/agency/studio/accounts/AccountsPage'

export default function ConnectionsDepartmentPage() {
  const pathname = usePathname() ?? ''

  if (pathname === '/agency/connections' || pathname === '/agency/connections/social') {
    return (
      <div className="min-h-0 flex-1 overflow-y-auto">
        <AccountsPage />
      </div>
    )
  }

  return <DepartmentNotReadyForPath />
}

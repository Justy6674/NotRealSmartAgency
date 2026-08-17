'use client'

export const dynamic = 'force-dynamic'

import { usePathname } from 'next/navigation'
import { DepartmentNotReadyForPath } from '@/components/agency/shell/DepartmentNotReady'
import { PagesIndex } from '@/components/agency/studio/pages/PagesIndex'

export default function WebsiteDepartmentPage() {
  const pathname = usePathname() ?? ''

  if (pathname === '/agency/website/pages') {
    return (
      <div className="min-h-0 flex-1 overflow-y-auto p-6">
        <PagesIndex />
      </div>
    )
  }

  return <DepartmentNotReadyForPath />
}

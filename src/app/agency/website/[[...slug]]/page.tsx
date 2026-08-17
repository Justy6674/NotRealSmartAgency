'use client'

export const dynamic = 'force-dynamic'

import { usePathname } from 'next/navigation'
import { WebsiteDept } from '@/components/agency/website/WebsiteDept'
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

  return <WebsiteDept />
}

'use client'

import { useAgencyStore } from '@/stores/agency-store'
import { ProjectSidebar } from './ProjectSidebar'

export function MobileSidebar() {
  const { sidebarOpen, setSidebarOpen } = useAgencyStore()

  if (!sidebarOpen) return null

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/60 md:hidden"
        onClick={() => setSidebarOpen(false)}
        aria-hidden="true"
      />
      {/* Sidebar panel */}
      <div className="fixed inset-y-0 left-0 z-50 md:hidden">
        <ProjectSidebar onClose={() => setSidebarOpen(false)} />
      </div>
    </>
  )
}

'use client'

import { Menu } from 'lucide-react'
import { useAgencyStore } from '@/stores/agency-store'
import { Button } from '@/components/ui/button'

export function SidebarToggle() {
  const { toggleSidebar } = useAgencyStore()

  return (
    <Button
      variant="ghost"
      size="icon"
      className="md:hidden"
      onClick={toggleSidebar}
      aria-label="Open sidebar"
    >
      <Menu className="h-5 w-5" />
    </Button>
  )
}

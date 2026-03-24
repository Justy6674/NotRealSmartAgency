import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ProjectSidebar } from '@/components/agency/ProjectSidebar'
import { AgencyHeader } from '@/components/agency/AgencyHeader'
import { MobileSidebar } from '@/components/agency/MobileSidebar'
import { SidebarToggle } from '@/components/agency/SidebarToggle'
import { UserMenu } from '@/components/agency/UserMenu'

export default async function AgencyLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login?redirect=/agency')
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Desktop sidebar — always visible */}
      <div className="hidden md:flex">
        <ProjectSidebar />
      </div>

      {/* Mobile sidebar — rendered into a portal-like fixed overlay */}
      <MobileSidebar />

      {/* Main content column */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Thin header bar with mobile hamburger + active context */}
        <header className="flex shrink-0 items-center border-b bg-background">
          {/* Hamburger visible on mobile only */}
          <div className="flex items-center px-2 md:hidden">
            <SidebarToggle />
          </div>
          {/* Active agent / brand / compliance — client component */}
          <div className="flex-1">
            <AgencyHeader />
          </div>
          <div className="shrink-0 px-2">
            <UserMenu />
          </div>
        </header>

        {/* Page content */}
        <main className="flex flex-1 flex-col overflow-hidden">
          {children}
        </main>
      </div>
    </div>
  )
}

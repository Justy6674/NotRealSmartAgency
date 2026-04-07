import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ProjectSidebar } from '@/components/agency/ProjectSidebar'
import { AgencyHeader } from '@/components/agency/AgencyHeader'
import { MobileSidebar } from '@/components/agency/MobileSidebar'
import { SidebarToggle } from '@/components/agency/SidebarToggle'
import { UserMenu } from '@/components/agency/UserMenu'
import Link from 'next/link'
import { Settings, CircleHelp } from 'lucide-react'
import { ChatPanelWrapper } from '@/components/agency/ChatPanelWrapper'

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

      {/* Main content column — min-w-0 prevents flex child overflow past chat panel */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* Thin header bar with mobile hamburger + active context */}
        <header className="flex shrink-0 items-center border-b bg-background">
          {/* Hamburger visible on mobile only */}
          <div className="flex items-center px-2 md:hidden">
            <SidebarToggle />
          </div>
          {/* Active agent / brand / compliance + room tabs — client component */}
          <div className="flex-1">
            <AgencyHeader />
          </div>
          <div className="shrink-0 flex items-center gap-1 px-2">
            <Link
              href="/help"
              target="_blank"
              className="flex items-center justify-center rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              title="Help Centre"
            >
              <CircleHelp className="h-4 w-4" />
            </Link>
            <Link
              href="/agency/settings"
              className="flex items-center justify-center rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              title="Agency Settings"
            >
              <Settings className="h-4 w-4" />
            </Link>
            <UserMenu />
          </div>
        </header>

        {/* Page content */}
        <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
          {children}
        </main>
      </div>

      {/* Persistent chat panel — available on every agency page */}
      <ChatPanelWrapper />
    </div>
  )
}

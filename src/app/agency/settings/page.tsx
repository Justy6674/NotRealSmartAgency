import Link from 'next/link'
import { ChevronRight, Plug } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { GlobalSettings } from '@/components/agency/GlobalSettings'
import { ConnectionsPanel } from '@/components/agency/ConnectionsPanel'
import { FOCUS_RING } from '@/lib/ui/focus'
import { cn } from '@/lib/utils'

export const dynamic = 'force-dynamic'

export default async function SettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users')
    .select('work_context')
    .eq('id', user.id)
    .single()

  return (
    <div className="p-6 space-y-6 overflow-y-auto h-full">
      <h1 className="text-xl font-bold">Agency Settings</h1>
      {/* Connections first. A service that is not connected makes whole
          features quietly do nothing, which is worse than an error. */}
      <ConnectionsPanel />

      {/* The panel above answers "is this service switched on?". The hub answers
          the harder question — is each brand's connection actually healthy, and
          which publisher is carrying it. That is configuration you visit rarely,
          so it is reached from here rather than from a pill in the top nav. */}
      <Link
        href="/agency/settings/integrations"
        className={cn(
          'flex items-start gap-3 rounded-lg border bg-card p-4',
          'transition-colors duration-200 hover:bg-accent/50 active:bg-accent/70',
          FOCUS_RING,
        )}
      >
        <Plug className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-foreground">Integration hub</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Per-platform connection health for every brand, and which publisher each
            one actually posts through.
          </p>
        </div>
        <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
      </Link>

      <GlobalSettings
        userId={user.id}
        userEmail={user.email ?? ''}
        workContext={profile?.work_context ?? ''}
      />
    </div>
  )
}

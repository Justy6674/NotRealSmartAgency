import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { GlobalSettings } from '@/components/agency/GlobalSettings'
import { ConnectionsPanel } from '@/components/agency/ConnectionsPanel'

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
      <GlobalSettings
        userId={user.id}
        userEmail={user.email ?? ''}
        workContext={profile?.work_context ?? ''}
      />
    </div>
  )
}

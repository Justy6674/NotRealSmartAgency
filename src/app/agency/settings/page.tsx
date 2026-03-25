import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { GlobalSettings } from '@/components/agency/GlobalSettings'

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
    <div className="p-6 space-y-6">
      <h1 className="text-xl font-bold">Agency Settings</h1>
      <GlobalSettings
        userId={user.id}
        userEmail={user.email ?? ''}
        workContext={profile?.work_context ?? ''}
      />
    </div>
  )
}

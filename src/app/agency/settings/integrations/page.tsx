import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { IntegrationsHub } from '@/components/agency/settings/IntegrationsHub'
import { IntegrationsHubSkeleton } from '@/components/agency/settings/IntegrationsHubSkeleton'
import { RecheckButton } from '@/components/agency/settings/IntegrationsActions'

export const dynamic = 'force-dynamic'

/**
 * Reaching two publishers takes as long as they take, so the heading and the
 * re-check control render immediately and the answer streams in underneath.
 * Nothing above the fold moves when it arrives.
 */
export default async function IntegrationsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto w-full max-w-4xl px-6 py-6">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-foreground">How your brands publish</h1>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              Every approved post leaves through one of two publishers. This asks both of them, live, and reports what
              they actually say.
            </p>
          </div>
          <RecheckButton />
        </div>

        <Suspense fallback={<IntegrationsHubSkeleton />}>
          <IntegrationsHub userId={user.id} />
        </Suspense>
      </div>
    </div>
  )
}

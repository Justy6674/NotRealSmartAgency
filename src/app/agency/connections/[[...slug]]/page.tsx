'use client'

export const dynamic = 'force-dynamic'

import { usePathname, useSearchParams } from 'next/navigation'
import { useAgencyStore } from '@/stores/agency-store'
import { useStudioData } from '@/hooks/useStudioData'
import { AccountsPage } from '@/components/agency/studio/accounts/AccountsPage'
import { ConnectionsIndex } from '@/components/agency/connections/ConnectionsIndex'

const CARE = 'var(--care, oklch(0.52 0.150 25))'
const CARE_WASH = 'var(--care-wash, oklch(0.965 0.028 25))'
const BRAND_WASH = 'var(--brand-wash, oklch(0.965 0.010 240))'
const BRAND_DEEP = 'var(--brand-deep, oklch(0.33 0.0209 240))'

/**
 * What to say when the owner comes back from signing in to Canva.
 *
 * Every one of these used to land him on the Studio dashboard with an invisible
 * `?canva_error=state_mismatch` in the address bar and nothing on the screen —
 * a sign-in that failed looked exactly like a sign-in that worked. He is not a
 * developer; he cannot read a query string, and he should not have to.
 *
 * The words say what happened and what to do, never the machine's reason.
 */
function canvaOutcome(connected: string | null, error: string | null): {
  tone: 'good' | 'bad'
  message: string
} | null {
  if (connected === 'connected') {
    return { tone: 'good', message: 'Canva is connected. Your designs will show up in the media library.' }
  }
  if (!error) return null
  if (error === 'config') {
    return {
      tone: 'bad',
      message: 'Canva is not set up on this site yet. Ask us to finish it — there is nothing for you to do.',
    }
  }
  return {
    tone: 'bad',
    message: 'That did not finish connecting Canva. Try again, and if it fails a second time tell us.',
  }
}

export default function ConnectionsDepartmentPage() {
  const pathname = usePathname() ?? ''
  const search = useSearchParams()
  const { activeBrandId } = useAgencyStore()
  const { brand } = useStudioData(activeBrandId)

  // Sub-route: social accounts management
  if (pathname === '/agency/connections/social') {
    return (
      <div className="min-h-0 flex-1 overflow-y-auto">
        <AccountsPage />
      </div>
    )
  }

  const outcome = canvaOutcome(search?.get('canva') ?? null, search?.get('canva_error') ?? null)

  // Root: connections hub
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {outcome ? (
        <div className="shrink-0 px-6 pt-4">
          <p
            className="rounded-lg px-3 py-2 text-[12.5px] font-[600]"
            style={{
              color: outcome.tone === 'bad' ? CARE : BRAND_DEEP,
              background: outcome.tone === 'bad' ? CARE_WASH : BRAND_WASH,
            }}
          >
            {outcome.message}
          </p>
        </div>
      ) : null}
      <ConnectionsIndex brand={brand ?? null} />
    </div>
  )
}

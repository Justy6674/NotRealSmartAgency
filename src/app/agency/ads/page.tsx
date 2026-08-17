'use client'

export const dynamic = 'force-dynamic'

import { AdsCommandCentre } from '@/components/agency/ads/AdsCommandCentre'

export default function AdsPage() {
  return (
    <div className="flex-1 overflow-y-auto">
      <AdsCommandCentre />
    </div>
  )
}

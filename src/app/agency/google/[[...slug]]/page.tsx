'use client'

export const dynamic = 'force-dynamic'

import { useAgencyStore } from '@/stores/agency-store'
import { useStudioData } from '@/hooks/useStudioData'
import { GoogleSearchabilityDept } from '@/components/agency/google/GoogleSearchabilityDept'

export default function GoogleSearchabilityPage() {
  const { activeBrandId } = useAgencyStore()
  const { brand } = useStudioData(activeBrandId)
  return <GoogleSearchabilityDept brand={brand ?? null} />
}

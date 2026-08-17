'use client'

export const dynamic = 'force-dynamic'

import { useAgencyStore } from '@/stores/agency-store'
import { useStudioData } from '@/hooks/useStudioData'
import { AiSearchabilityDept } from '@/components/agency/ai-search/AiSearchabilityDept'

export default function AiSearchabilityPage() {
  const { activeBrandId } = useAgencyStore()
  const { brand } = useStudioData(activeBrandId)
  return <AiSearchabilityDept brand={brand ?? null} />
}

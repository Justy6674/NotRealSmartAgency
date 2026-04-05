'use client'
export const dynamic = 'force-dynamic'

import { RoomLayout } from '@/components/agency/studio/RoomLayout'
import { CampaignPlannerRoom } from '@/components/agency/studio/campaign/CampaignPlannerRoom'
import { useAgencyStore } from '@/stores/agency-store'
import { useStudioData } from '@/hooks/useStudioData'

export default function CampaignPlannerPage() {
  const { activeBrandId } = useAgencyStore()
  const data = useStudioData(activeBrandId)

  return (
    <RoomLayout title="Campaign Planner">
      <CampaignPlannerRoom brandName={data.brand?.name ?? null} />
    </RoomLayout>
  )
}

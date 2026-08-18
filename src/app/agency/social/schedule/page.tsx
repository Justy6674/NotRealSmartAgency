'use client'

export const dynamic = 'force-dynamic'

import { useState } from 'react'

import { PostingSchedulePage } from '@/components/agency/studio/posting-schedule/PostingSchedulePage'
import { SchedulePanels } from '@/components/agency/studio/schedule/SchedulePanels'
import { useAgencyStore } from '@/stores/agency-store'

/**
 * The department shell already supplies the scrolling, padded pane (18/26/26)
 * — it is the only scroller in Social. Wrapping this screen in a second
 * `overflow-y-auto` gave it two scrollbars and doubled the side padding.
 *
 * The grid, then the two panels that sit under it: what this business's own
 * audience responds to, and the control that empties the week. Clearing the
 * week remounts the grid rather than telling it to refetch, because the two
 * showing different weeks for even a moment is exactly the confusion the
 * clear button exists to end.
 */
export default function SocialSchedulePage() {
  const activeBrandId = useAgencyStore((s) => s.activeBrandId)
  const [generation, setGeneration] = useState(0)

  return (
    <div className="space-y-4">
      <PostingSchedulePage key={`${activeBrandId ?? 'none'}-${generation}`} />
      <SchedulePanels
        key={`panels-${activeBrandId ?? 'none'}`}
        brandId={activeBrandId}
        onChanged={() => setGeneration((n) => n + 1)}
      />
    </div>
  )
}

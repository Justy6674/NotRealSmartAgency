'use client'

export const dynamic = 'force-dynamic'

import { ReviewRoom } from '@/components/agency/studio/ReviewRoom'
import { useSearchParams } from 'next/navigation'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export default function ReviewPage() {
  const searchParams = useSearchParams()
  const draftParam = searchParams.get('draft')
  const initialDraftId = draftParam && UUID_PATTERN.test(draftParam) ? draftParam : undefined
  return <ReviewRoom initialDraftId={initialDraftId} />
}

'use client'

export const dynamic = 'force-dynamic'

import { MediaLibrary } from '@/components/agency/studio/MediaLibrary'

export default function SocialMediaPage() {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <MediaLibrary />
    </div>
  )
}

'use client'

export const dynamic = 'force-dynamic'

import { WebhooksIndex } from '@/components/agency/studio/webhooks/WebhooksIndex'

export default function WebhooksPage() {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 p-4 md:p-6">
      <WebhooksIndex />
    </div>
  )
}

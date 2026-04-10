'use client'

export const dynamic = 'force-dynamic'

import { use } from 'react'

import { WebhookEditor } from '@/components/agency/studio/webhooks/WebhookEditor'
import { WebhookDeliveriesLog } from '@/components/agency/studio/webhooks/WebhookDeliveriesLog'

interface WebhookDetailPageProps {
  params: Promise<{ id: string }>
}

export default function WebhookDetailPage({ params }: WebhookDetailPageProps) {
  const { id } = use(params)
  // The "new" route is handled here too — when the dynamic segment is
  // literally "new" we render an empty editor in create mode and skip the
  // delivery log (a webhook that doesn't exist yet has nothing to log).
  const isNew = id === 'new'

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 p-4 md:p-6">
      <WebhookEditor webhookId={isNew ? undefined : id} />
      {!isNew && <WebhookDeliveriesLog webhookId={id} />}
    </div>
  )
}

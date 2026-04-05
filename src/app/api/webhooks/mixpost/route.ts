import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * Mixpost webhook receiver.
 * Handles post.published and post.published.failed events
 * to keep scheduled_posts status in sync with Mixpost.
 */
export async function POST(request: Request) {
  // Optional: verify webhook secret if configured
  const secret = request.headers.get('x-mixpost-signature')
  if (process.env.MIXPOST_WEBHOOK_SECRET && secret !== process.env.MIXPOST_WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 403 })
  }

  const body = await request.json()
  const eventType = body.event ?? body.type
  const eventData = body.data ?? body

  const supabase = createAdminClient()

  if (eventType === 'post.published') {
    const mixpostPostId = String(eventData.post_id ?? eventData.id ?? '')
    if (mixpostPostId) {
      await supabase
        .from('scheduled_posts')
        .update({
          status: 'published',
          published_at: new Date().toISOString(),
        })
        .eq('external_post_id', mixpostPostId)
    }
  }

  if (eventType === 'post.published.failed') {
    const mixpostPostId = String(eventData.post_id ?? eventData.id ?? '')
    const error = eventData.reason ?? eventData.error ?? 'Publishing failed'
    if (mixpostPostId) {
      await supabase
        .from('scheduled_posts')
        .update({
          status: 'failed',
          error,
        })
        .eq('external_post_id', mixpostPostId)
    }
  }

  return NextResponse.json({ received: true })
}

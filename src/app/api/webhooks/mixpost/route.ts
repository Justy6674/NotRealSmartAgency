import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { Resend } from 'resend'
import { parseNotificationPreferences } from '@/lib/notification-preferences'
import { buildPostPublishedEmail, buildPostFailedEmail } from '@/lib/emails/post-published'

/**
 * Mixpost webhook receiver.
 * Handles post.published and post.published.failed events
 * to keep scheduled_posts status in sync with Mixpost.
 * Sends email notifications to the user when enabled.
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

      // Send notification email
      await sendPublishNotification(supabase, mixpostPostId, 'published')
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

      // Send failure notification email
      await sendPublishNotification(supabase, mixpostPostId, 'failed', error)
    }
  }

  return NextResponse.json({ received: true })
}

async function sendPublishNotification(
  supabase: ReturnType<typeof createAdminClient>,
  mixpostPostId: string,
  status: 'published' | 'failed',
  errorMessage?: string
) {
  try {
    // Fetch the post with brand info
    const { data: post } = await supabase
      .from('scheduled_posts')
      .select('user_id, platform, caption, brand_id, brands(name)')
      .eq('external_post_id', mixpostPostId)
      .single()

    if (!post?.user_id) return

    // Fetch user email and notification preferences
    const { data: user } = await supabase
      .from('users')
      .select('email, work_context')
      .eq('id', post.user_id)
      .single()

    if (!user?.email) return

    const prefs = parseNotificationPreferences(user.work_context)

    // Check if this notification type is enabled
    if (status === 'published' && !prefs.notify_post_published) return
    if (status === 'failed' && !prefs.notify_post_failed) return

    // Send via Resend
    const apiKey = process.env.RESEND_API_KEY
    if (!apiKey) return

    const resend = new Resend(apiKey)
    const brandsData = post.brands as { name: string } | { name: string }[] | null
    const brandName = Array.isArray(brandsData) ? brandsData[0]?.name ?? 'your brand' : brandsData?.name ?? 'your brand'
    const fromEmail = process.env.RESEND_FROM_EMAIL ?? 'noreply@notrealsmart.com.au'

    const html = status === 'published'
      ? buildPostPublishedEmail(post.platform, post.caption ?? '', brandName)
      : buildPostFailedEmail(post.platform, errorMessage ?? 'Unknown error', brandName)

    const subject = status === 'published'
      ? `Your ${post.platform} post for ${brandName} is live!`
      : `Publishing failed: ${post.platform} post for ${brandName}`

    await resend.emails.send({
      from: `NRS Agency <${fromEmail}>`,
      to: user.email,
      subject,
      html,
    })
  } catch (err) {
    // Non-blocking — don't let notification failures break the webhook
    console.error('Failed to send publish notification:', err)
  }
}

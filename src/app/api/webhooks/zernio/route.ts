import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifyZernioWebhook } from './verify'

export const dynamic = 'force-dynamic'

function eventIdOf(payload: Record<string, unknown>, headers: Headers): string | null {
  const fromPayload = typeof payload.id === 'string' ? payload.id.trim() : ''
  if (fromPayload) return fromPayload
  const fromHeader = (headers.get('x-zernio-event-id') ?? headers.get('x-late-event-id') ?? '').trim()
  return fromHeader || null
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : null
}

function accountIdOf(value: unknown): string {
  if (typeof value === 'string') return value
  const rec = asRecord(value)
  if (!rec) return ''
  const id = rec.id ?? rec._id ?? rec.accountId
  return typeof id === 'string' ? id : ''
}

export async function POST(request: Request) {
  const signature = request.headers.get('x-zernio-signature') ?? request.headers.get('x-late-signature')
  const rawBody = await request.text()

  const verified = verifyZernioWebhook({
    secret: process.env.ZERNIO_WEBHOOK_SECRET,
    signature,
    rawBody,
  })
  if (!verified.ok) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: verified.status })
  }

  let payload: Record<string, unknown>
  try {
    payload = JSON.parse(rawBody) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
  }

  const event = typeof payload.event === 'string' ? payload.event : ''
  const id = eventIdOf(payload, request.headers)
  if (!id) {
    return NextResponse.json({ error: 'Missing event id' }, { status: 400 })
  }

  const supabase = createAdminClient()
  const { error: insertError } = await supabase.from('zernio_webhook_events').insert({
    id,
    event,
    zernio_post_id: typeof payload.postId === 'string' ? payload.postId : null,
    account_id: accountIdOf(payload.account) || null,
    payload,
  })
  if (insertError) {
    if (insertError.code === '23505') {
      return NextResponse.json({ success: true, duplicate: true })
    }
    console.error('[zernio webhook] dedupe insert failed:', insertError.message)
    return NextResponse.json({ error: 'Could not record this event' }, { status: 500 })
  }

  void processZernioEvent(event, payload).catch((err) => {
    console.error('[zernio webhook] async process failed:', err)
  })

  return NextResponse.json({ success: true })
}

async function processZernioEvent(event: string, payload: Record<string, unknown>) {
  const supabase = createAdminClient()

  if (event === 'account.connected' || event === 'account.disconnected') {
    const profileId = typeof payload.profileId === 'string'
      ? payload.profileId
      : accountIdOf(asRecord(payload.profile))
    const accountId = typeof payload.accountId === 'string' ? payload.accountId : accountIdOf(payload.account)
    if (!profileId || !accountId) {
      console.error('[zernio webhook] account event missing profileId/accountId')
      return
    }

    const { data: brands } = await supabase
      .from('brands')
      .select('id, social_urls')
    const brand = (brands ?? []).find((row) => {
      const urls = (row.social_urls ?? {}) as Record<string, unknown>
      return urls.zernio_profile_id === profileId
    })
    if (!brand) {
      console.error('[zernio webhook] unknown profileId, dropped', profileId)
      return
    }

    if (event === 'account.disconnected') {
      await supabase
        .from('zernio_account_map')
        .update({ disconnected_at: new Date().toISOString() })
        .eq('brand_id', brand.id)
        .eq('account_id', accountId)
      return
    }

    await supabase.from('zernio_account_map').upsert({
      account_id: accountId,
      brand_id: brand.id,
      profile_id: profileId,
      platform: typeof payload.platform === 'string' ? payload.platform : '',
      username: typeof payload.username === 'string' ? payload.username : null,
      disconnected_at: null,
    }, { onConflict: 'account_id,brand_id' })
    return
  }

  if (event === 'post.published' || event === 'post.failed' || event === 'post.partial') {
    const post = asRecord(payload.post) ?? payload
    const externalId = typeof post._id === 'string' ? post._id : typeof post.id === 'string' ? post.id : ''
    if (!externalId) {
      console.error('[zernio webhook] post event missing id, dropped')
      return
    }

    const { data: run } = await supabase
      .from('publisher_runs')
      .select('id, scheduled_post_id, account_id, status')
      .eq('external_post_id', externalId)
      .maybeSingle()

    if (!run) {
      console.error('[zernio webhook] no matching publisher_run for', externalId)
      return
    }

    const failed = event === 'post.failed' || event === 'post.partial'
    await supabase
      .from('publisher_runs')
      .update({
        status: failed && event === 'post.failed' ? 'failed' : event === 'post.published' ? 'success' : run.status,
        external_permalink: typeof post.platformPostUrl === 'string' ? post.platformPostUrl : undefined,
        finished_at: new Date().toISOString(),
      })
      .eq('id', run.id)
    return
  }

  if (event === 'message.received' || event === 'comment.received') {
    const account = asRecord(payload.account)
    const accountId = accountIdOf(account)
    if (!accountId) {
      console.error('[zernio webhook] inbox event unknown accountId, dropped')
      return
    }

    const { data: live } = await supabase
      .from('zernio_account_map')
      .select('brand_id, account_id')
      .eq('account_id', accountId)
      .is('disconnected_at', null)

    if (!live || live.length === 0) {
      console.error('[zernio webhook] inbox unknown accountId, dropped', accountId)
      return
    }
    if (live.length > 1) {
      console.error('[zernio webhook] two live map rows for one accountId, dropped', accountId)
      return
    }

    const brandId = live[0]!.brand_id
    const { data: brand } = await supabase
      .from('brands')
      .select('id, user_id')
      .eq('id', brandId)
      .maybeSingle()
    if (!brand) return

    const message = asRecord(payload.message)
    const conversation = asRecord(payload.conversation)
    const text = typeof message?.text === 'string' ? message.text : ''

    await supabase.from('tasks').insert({
      user_id: brand.user_id,
      brand_id: brand.id,
      title: event === 'comment.received' ? '1 new comment' : '1 new message',
      description: text ? `A customer wrote: "${text}"` : 'A customer sent a message.',
      context: {
        source: 'zernio_inbox',
        conversationId: conversation?.id ?? conversation?._id,
        accountId,
        platform: account?.platform,
      },
      status: 'backlog',
      priority: 'high',
    })
  }
}

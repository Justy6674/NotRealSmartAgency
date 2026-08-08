/**
 * The whole conversation, in one order, rebuilt from the server every time.
 *
 * This replaces two things at once: the `/media` route, which returned clips
 * NEWEST FIRST into a top-to-bottom chat, and the job-polling loop, which was
 * the only way a Director answer ever reached the screen — and kept it in
 * React state, so closing the app erased every message the owner had sent.
 *
 * IO only. No ordering logic lives here; that is `timeline.ts`, alone.
 */

import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getNRSTelegramConfig } from '@/lib/telegram/nrs-telegram-config'
import { resolveTelegramMiniAppContext, validateTelegramMiniAppInitData } from '@/lib/telegram/mini-app'
import { buildTelegramTimeline, PAGE_GROUPS, takeNewestGroups } from '@/lib/telegram/timeline'
import { TELEGRAM_TIMELINE_SOURCES } from '@/lib/telegram/timeline-sources'
import { sanitiseTimeline } from '@/lib/telegram/timeline-text'
import { readThreadStart } from '@/lib/telegram/thread-boundary'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** Generous per source — the builder pages by whole groups afterwards. */
const ROW_LIMIT = PAGE_GROUPS * 3

export async function POST(request: Request) {
  const config = getNRSTelegramConfig()
  if (!config?.enabled) {
    return NextResponse.json({ error: 'Telegram Mini App is not enabled.' }, { status: 503 })
  }

  const body = (await request.json().catch(() => null)) as
    | { init_data?: unknown; before_anchor_ms?: unknown }
    | null

  const initData = typeof body?.init_data === 'string' ? body.init_data : ''
  const auth = validateTelegramMiniAppInitData(initData, config.botToken)
  if (!auth) return NextResponse.json({ error: 'Invalid or expired Telegram session.' }, { status: 401 })

  const admin = createAdminClient()
  const context = await resolveTelegramMiniAppContext(admin, auth)
  if (!context?.activeSession) {
    return NextResponse.json({ error: 'Choose a project first.' }, { status: 409 })
  }

  const nowMs = Date.now()
  const brandId = context.activeSession.projectId

  // Start of the current piece of work, if the owner has ever said "new".
  // Older events are not deleted — they simply sit above the line, so a fresh
  // clip is not read against three days of argument about a different one.
  const { data: brand } = await admin
    .from('brands').select('slug').eq('id', brandId).maybeSingle()
  const threadStartMs = brand?.slug
    ? await readThreadStart(admin, {
      brandId, brandSlug: brand.slug as string, userId: context.actorUserId,
    }).catch(() => null)
    : null

  const fetchContext = {
    admin,
    userId: context.actorUserId,
    brandId,
    fromMs: threadStartMs,
    rowLimit: ROW_LIMIT,
  }

  // One source failing must not blank the conversation. A missing clip is a
  // gap; a thrown request is an empty screen and no way to tell which.
  const settled = await Promise.allSettled(
    TELEGRAM_TIMELINE_SOURCES.map(async (source) => {
      const rows = await source.fetch(fetchContext)
      return source.map(rows, { brandId, nowMs })
    }),
  )

  const failed = settled.flatMap((outcome, index) =>
    outcome.status === 'rejected' ? [TELEGRAM_TIMELINE_SOURCES[index].name] : [],
  )
  if (failed.length > 0) {
    console.error('[timeline] source(s) failed:', failed.join(', '))
  }

  const sourceEvents = settled.flatMap((outcome) =>
    outcome.status === 'fulfilled' ? outcome.value : [],
  )

  const { events, dropped } = buildTelegramTimeline({ events: sanitiseTimeline(sourceEvents) })
  const page = takeNewestGroups(events)

  if (dropped > 0) console.warn(`[timeline] ${dropped} event(s) had no usable time`)

  return NextResponse.json({
    events: page.events,
    has_more: page.hasMore,
    oldest_anchor_ms: page.oldestAnchorMs,
    server_time_ms: nowMs,
    ...(failed.length > 0 ? { degraded: failed } : {}),
  })
}

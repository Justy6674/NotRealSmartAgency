import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getNRSTelegramConfig } from '@/lib/telegram/nrs-telegram-config'
import { resolveTelegramMiniAppContext, validateTelegramMiniAppInitData } from '@/lib/telegram/mini-app'

/**
 * What has landed, and what has been written about it.
 *
 * Several clips can be uploaded at once, and each moves through transcription
 * and a first-pass proposal on its own. This reports where every one of them
 * has got to so the app can show a list that fills in as the work completes,
 * rather than blocking on one file at a time.
 */

export const runtime = 'nodejs'

/** Enough to cover a session's uploads without paging. */
const RECENT_LIMIT = 20

/**
 * listening — still being transcribed, or the first pass is still being written.
 * ready     — a proposal is waiting.
 * no_draft  — transcribed, but no proposal ever arrived. Clips uploaded before
 *             proposals existed sit here, as does anything Content & Copy could
 *             not write for. Without this the list would say "listening…"
 *             forever and the app would poll for a proposal that is not coming.
 * failed    — the file could not be read at all.
 */
type Stage = 'listening' | 'ready' | 'no_draft' | 'failed'

/** How long to keep waiting on a first pass before calling it a no-show. */
const PROPOSAL_GRACE_MS = 10 * 60 * 1000

export async function POST(request: Request) {
  const config = getNRSTelegramConfig()
  if (!config?.enabled) return NextResponse.json({ error: 'Telegram Mini App is not enabled.' }, { status: 503 })

  const body = (await request.json().catch(() => null)) as { init_data?: unknown } | null
  const initData = typeof body?.init_data === 'string' ? body.init_data : ''
  const auth = validateTelegramMiniAppInitData(initData, config.botToken)
  if (!auth) return NextResponse.json({ error: 'Invalid or expired Telegram session.' }, { status: 401 })

  const admin = createAdminClient()
  const context = await resolveTelegramMiniAppContext(admin, auth)
  if (!context?.activeSession) {
    return NextResponse.json({ error: 'Choose a project first.' }, { status: 409 })
  }

  const projectId = context.activeSession.projectId

  const { data: mediaRows } = await admin
    .from('media_items')
    .select('id, file_name, file_type, transcription_status, created_at')
    .eq('user_id', context.actorUserId)
    .eq('brand_id', projectId)
    .contains('metadata', { source: 'telegram', via: 'mini_app' })
    .order('created_at', { ascending: false })
    .limit(RECENT_LIMIT)

  const media = mediaRows ?? []
  if (media.length === 0) return NextResponse.json({ items: [] })

  // Proposals are matched back to their clip through metadata rather than a
  // foreign key, because an `outputs` row can cover several media items.
  const { data: outputRows } = await admin
    .from('outputs')
    .select('id, title, content, metadata, is_approved, created_at')
    .eq('user_id', context.actorUserId)
    .eq('brand_id', projectId)
    .eq('output_type', 'social_post')
    .order('created_at', { ascending: false })
    .limit(RECENT_LIMIT * 2)

  const proposalByMedia = new Map<string, Record<string, unknown>>()
  for (const row of outputRows ?? []) {
    const meta = (row.metadata ?? {}) as Record<string, unknown>
    if (meta.stage !== 'proposal') continue
    for (const id of Array.isArray(meta.media_item_ids) ? meta.media_item_ids : []) {
      if (typeof id === 'string' && !proposalByMedia.has(id)) {
        proposalByMedia.set(id, { ...row, meta })
      }
    }
  }

  const items = media.map((item) => {
    const found = proposalByMedia.get(item.id as string)
    const meta = (found?.meta ?? {}) as Record<string, unknown>
    const ageMs = Date.now() - new Date(item.created_at as string).getTime()
    const transcribed = item.transcription_status === 'transcribed'
    const stage: Stage = found
      ? 'ready'
      : item.transcription_status === 'failed'
        ? 'failed'
        : transcribed && ageMs > PROPOSAL_GRACE_MS
          ? 'no_draft'
          : 'listening'

    return {
      id: item.id,
      file_name: item.file_name,
      file_type: item.file_type,
      stage,
      transcription_status: item.transcription_status,
      proposal: found
        ? {
            output_id: found.id,
            opener: typeof meta.opener === 'string' ? meta.opener : '',
            hook: typeof meta.hook === 'string' ? meta.hook : (found.title as string) ?? '',
            caption: (found.content as string) ?? '',
            hashtags: Array.isArray(meta.hashtags) ? meta.hashtags : [],
            post_type: typeof meta.post_type === 'string' ? meta.post_type : 'single',
            approved: Boolean(found.is_approved),
          }
        : null,
    }
  })

  return NextResponse.json({ items })
}

/**
 * File a visually reviewed carousel as a draft.
 *
 * The button in the Mini App is the owner's explicit approval to create a
 * draft, not approval to publish. All provider status is returned as an
 * actual Mixpost receipt instead of being guessed from a successful HTTP call.
 */
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createDraftPost } from '@/lib/posts/create-draft'
import type { PostPlatform } from '@/types/database'
import { getNRSTelegramConfig } from '@/lib/telegram/nrs-telegram-config'
import { resolveTelegramMiniAppContext, validateTelegramMiniAppInitData } from '@/lib/telegram/mini-app'
import { userSafeError } from '@/lib/errors/user-safe'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 120

const POST_PLATFORMS: ReadonlySet<PostPlatform> = new Set([
  'instagram', 'facebook', 'linkedin', 'twitter', 'tiktok', 'youtube',
  'bluesky', 'mastodon', 'pinterest', 'threads', 'google_business',
])

export async function POST(request: Request) {
  const config = getNRSTelegramConfig()
  if (!config?.enabled) return NextResponse.json({ error: 'Telegram Mini App is not enabled.' }, { status: 503 })

  const body = await request.json().catch(() => null) as
    | { init_data?: unknown; output_id?: unknown }
    | null
  const initData = typeof body?.init_data === 'string' ? body.init_data : ''
  const outputId = typeof body?.output_id === 'string' ? body.output_id : ''
  const auth = validateTelegramMiniAppInitData(initData, config.botToken)
  if (!auth) return NextResponse.json({ error: 'Invalid or expired Telegram session.' }, { status: 401 })
  if (!outputId) return NextResponse.json({ error: 'output_id required' }, { status: 400 })

  const admin = createAdminClient()
  const context = await resolveTelegramMiniAppContext(admin, auth)
  if (!context?.activeSession) return NextResponse.json({ error: 'Choose a project first.' }, { status: 409 })
  const grant = context.grants.find((candidate) =>
    candidate.grantId === context.activeSession?.grantId && candidate.projectId === context.activeSession?.projectId,
  )
  if (!grant?.capabilities.includes('director:chat')) {
    return NextResponse.json({ error: 'The selected project cannot file a Director draft.' }, { status: 403 })
  }

  const { data: proposal } = await admin
    .from('outputs')
    .select('id, title, content, metadata, is_approved')
    .eq('id', outputId)
    .eq('user_id', context.actorUserId)
    .eq('brand_id', context.activeSession.projectId)
    .eq('output_type', 'social_post')
    .maybeSingle()
  if (!proposal) return NextResponse.json({ error: 'That carousel is not available in this project.' }, { status: 404 })
  if (proposal.is_approved) {
    return NextResponse.json({ error: 'That carousel has already been filed as a draft.' }, { status: 409 })
  }

  const metadata = (proposal.metadata ?? {}) as Record<string, unknown>
  const stage = metadata.stage
  const post_type = metadata.post_type
  if (stage !== 'proposal' || post_type !== 'carousel') {
    return NextResponse.json({ error: 'That item is not an unapproved carousel proposal.' }, { status: 409 })
  }
  const mediaItemIds = Array.isArray(metadata.media_item_ids)
    ? metadata.media_item_ids.filter((id): id is string => typeof id === 'string')
    : []
  if (mediaItemIds.length < 2) {
    return NextResponse.json({ error: 'That carousel has no complete set of saved slides.' }, { status: 409 })
  }
  const rawPlatform = typeof metadata.platform === 'string' ? metadata.platform : 'instagram'
  const platform: PostPlatform = POST_PLATFORMS.has(rawPlatform as PostPlatform)
    ? rawPlatform as PostPlatform
    : 'instagram'
  const hashtags = Array.isArray(metadata.hashtags)
    ? metadata.hashtags.filter((tag): tag is string => typeof tag === 'string')
    : []
  const caption = proposal.content?.trim() ?? ''
  if (!caption) return NextResponse.json({ error: 'The carousel has no caption to file.' }, { status: 409 })

  try {
    const draft = await createDraftPost({
      supabase: admin,
      userId: context.actorUserId,
      brandId: context.activeSession.projectId,
      platform,
      caption,
      hashtags,
      mediaItemIds,
      postType: 'carousel',
      outputId: proposal.id,
      metadata: { source: 'telegram_mini_app_carousel', approved_from: proposal.id },
    })

    // A draft exists even if Mixpost is pending or failed. Preserve that
    // distinction in the response; do not make the owner re-approve it and do
    // not call a failed sync ready to review.
    await admin.from('outputs').update({
      is_approved: true,
      metadata: {
        ...metadata,
        carousel_draft: {
          draft_id: draft.id,
          mixpost: draft.mixpost,
          ...(draft.mixpostError ? { mixpost_error: draft.mixpostError } : {}),
          ...(draft.mixpostPostUuid ? { mixpost_post_uuid: draft.mixpostPostUuid } : {}),
        },
      },
    }).eq('id', proposal.id)

    return NextResponse.json({
      draft_id: draft.id,
      platform,
      mixpost: draft.mixpost,
      ...(draft.mixpostError ? { mixpost_error: draft.mixpostError } : {}),
      ...(draft.mixpostPostUuid ? { mixpost_post_uuid: draft.mixpostPostUuid } : {}),
    })
  } catch (error) {
    return NextResponse.json({
      error: userSafeError('mini-app-carousel-draft', error, 'The draft could not be created. Nothing was published.'),
    }, { status: 500 })
  }
}

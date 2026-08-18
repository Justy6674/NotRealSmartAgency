import type { SocialDeskAction } from './actions'
import { SOCIAL_PLATFORM_CAPABILITIES } from './capabilities'
import { SOCIAL_PLATFORMS, type SocialPlatform } from './model'
import type { PostPlatform } from '@/types/database'

export interface FillComposePayload {
  caption?: string
  hashtags?: string[]
  platforms?: string[]
  media_ids?: string[]
  account_ids?: string[]
  title?: string
  first_comment?: string
  cover_image_url?: string
  tiktok_privacy?: 'public' | 'friends' | 'private'
  youtube_privacy?: 'public' | 'private' | 'unlisted'
  allow_comments?: boolean
  allow_duet?: boolean
  allow_stitch?: boolean
  ai_disclosure?: boolean
  made_for_kids?: boolean
  youtube_category?: string
  scheduled_at?: string
  timezone?: string
}

function asSocialPlatforms(platforms: readonly string[]): SocialPlatform[] {
  return platforms.filter((platform): platform is SocialPlatform =>
    (SOCIAL_PLATFORMS as readonly string[]).includes(platform),
  )
}

function httpsUrl(value: string | undefined): string | null {
  if (!value?.trim()) return null
  try {
    const url = new URL(value.trim())
    return url.protocol === 'https:' ? url.toString() : null
  } catch {
    return null
  }
}

/**
 * Director/button payload → the same desk actions the reducer already knows.
 * Platforms first so title, first comment, accounts and options have a target.
 */
export function fillPayloadToDeskActions(
  payload: FillComposePayload,
  current?: { mediaIds?: string[]; platforms?: PostPlatform[] },
): SocialDeskAction[] {
  const actions: SocialDeskAction[] = []
  const platforms = asSocialPlatforms(payload.platforms ?? current?.platforms ?? [])

  if (platforms.length > 0) {
    actions.push({ type: 'set_platforms', platforms })
  }

  if (typeof payload.caption === 'string') {
    actions.push({ type: 'set_master_caption', caption: payload.caption })
  }

  if (payload.hashtags) {
    actions.push({ type: 'set_hashtags', hashtags: payload.hashtags })
  }

  if (payload.media_ids) {
    const wanted = [...new Set(payload.media_ids)]
    const currentIds = current?.mediaIds ?? []
    for (const id of currentIds) {
      if (!wanted.includes(id)) actions.push({ type: 'remove_media', mediaItemId: id })
    }
    for (const id of wanted) {
      if (!currentIds.includes(id)) actions.push({ type: 'add_media', mediaItemId: id })
    }
  }

  for (const platform of platforms) {
    if (payload.account_ids) {
      actions.push({ type: 'choose_accounts', targetId: platform, accountIds: [...payload.account_ids] })
    }

    if (typeof payload.title === 'string' && SOCIAL_PLATFORM_CAPABILITIES[platform].title) {
      actions.push({
        type: 'set_platform_title',
        targetId: platform,
        title: payload.title.trim() === '' ? null : payload.title,
      })
    }

    if (typeof payload.first_comment === 'string' && SOCIAL_PLATFORM_CAPABILITIES[platform].firstComment) {
      actions.push({
        type: 'set_first_comment',
        targetId: platform,
        firstComment: payload.first_comment.trim() === '' ? null : payload.first_comment,
      })
    }

    const cover = httpsUrl(payload.cover_image_url)
    if (cover && SOCIAL_PLATFORM_CAPABILITIES[platform].cover !== 'unsupported') {
      actions.push({ type: 'set_cover', targetId: platform, source: { kind: 'url', url: cover } })
    }

    const optionPatch: Record<string, unknown> = {}
    if (platform === 'tiktok') {
      if (payload.tiktok_privacy === 'public') optionPatch.privacyLevel = 'PUBLIC_TO_EVERYONE'
      if (payload.tiktok_privacy === 'friends') optionPatch.privacyLevel = 'MUTUAL_FOLLOW_FRIENDS'
      if (payload.tiktok_privacy === 'private') optionPatch.privacyLevel = 'SELF_ONLY'
      if (typeof payload.allow_comments === 'boolean') optionPatch.allowComment = payload.allow_comments
      if (typeof payload.allow_duet === 'boolean') optionPatch.allowDuet = payload.allow_duet
      if (typeof payload.allow_stitch === 'boolean') optionPatch.allowStitch = payload.allow_stitch
      if (typeof payload.ai_disclosure === 'boolean') optionPatch.videoMadeWithAi = payload.ai_disclosure
    }
    if (platform === 'youtube') {
      if (payload.youtube_privacy) optionPatch.visibility = payload.youtube_privacy
      if (typeof payload.made_for_kids === 'boolean') optionPatch.madeForKids = payload.made_for_kids
      if (payload.youtube_category) optionPatch.categoryId = payload.youtube_category
    }
    if (Object.keys(optionPatch).length > 0) {
      actions.push({ type: 'set_platform_options', targetId: platform, patch: optionPatch })
    }
  }

  if (payload.scheduled_at) {
    actions.push({
      type: 'set_schedule',
      schedule: {
        mode: 'at',
        scheduledAt: payload.scheduled_at,
        timezone: payload.timezone?.trim() || 'Australia/Sydney',
      },
    })
  }

  return actions
}

/** Option switches for one already-ticked platform. Does not replace the platform list. */
export function composerOptionsToDeskActions(
  platform: SocialPlatform,
  options: Record<string, unknown>,
): SocialDeskAction[] {
  const actions: SocialDeskAction[] = []
  if (typeof options.title === 'string' && SOCIAL_PLATFORM_CAPABILITIES[platform].title) {
    actions.push({
      type: 'set_platform_title',
      targetId: platform,
      title: options.title.trim() === '' ? null : options.title,
    })
  }
  if (typeof options.first_comment === 'string' && SOCIAL_PLATFORM_CAPABILITIES[platform].firstComment) {
    actions.push({
      type: 'set_first_comment',
      targetId: platform,
      firstComment: options.first_comment.trim() === '' ? null : options.first_comment,
    })
  }
  const cover = httpsUrl(typeof options.cover_image_url === 'string' ? options.cover_image_url : undefined)
  if (cover && SOCIAL_PLATFORM_CAPABILITIES[platform].cover !== 'unsupported') {
    actions.push({ type: 'set_cover', targetId: platform, source: { kind: 'url', url: cover } })
  }
  const optionPatch: Record<string, unknown> = {}
  if (platform === 'tiktok') {
    if (options.privacy === 'public') optionPatch.privacyLevel = 'PUBLIC_TO_EVERYONE'
    if (options.privacy === 'friends') optionPatch.privacyLevel = 'MUTUAL_FOLLOW_FRIENDS'
    if (options.privacy === 'private') optionPatch.privacyLevel = 'SELF_ONLY'
    if (typeof options.allow_comments === 'boolean') optionPatch.allowComment = options.allow_comments
    if (typeof options.allow_duet === 'boolean') optionPatch.allowDuet = options.allow_duet
    if (typeof options.allow_stitch === 'boolean') optionPatch.allowStitch = options.allow_stitch
    if (typeof options.ai_disclosure === 'boolean') optionPatch.videoMadeWithAi = options.ai_disclosure
  }
  if (platform === 'youtube') {
    if (options.privacy === 'public' || options.privacy === 'private' || options.privacy === 'unlisted') {
      optionPatch.visibility = options.privacy
    }
    if (typeof options.made_for_kids === 'boolean') optionPatch.madeForKids = options.made_for_kids
    if (typeof options.category === 'string') optionPatch.categoryId = options.category
  }
  if (Object.keys(optionPatch).length > 0) {
    actions.push({ type: 'set_platform_options', targetId: platform, patch: optionPatch })
  }
  return actions
}

const NEED_COPY: Record<string, string> = {
  platforms: 'Which accounts should this go on — Instagram, TikTok, YouTube, Facebook, LinkedIn, or X?',
  caption: 'What should the post say?',
  media: 'Which photo or video should sit on this post?',
  accounts: 'Which of your connected accounts should it use?',
  youtube_title: 'What should the YouTube title be?',
  schedule: 'Should this stay as a draft, or go out at a specific time?',
}

export function stillNeededOnDesk(input: {
  platforms: string[]
  caption: string
  mediaIds: string[]
  accountIds: string[]
  youtubeTitle?: string
  scheduledAt?: string
}): string[] {
  const needed: string[] = []
  if (input.platforms.length === 0) needed.push(NEED_COPY.platforms)
  if (!input.caption.trim()) needed.push(NEED_COPY.caption)
  if (input.mediaIds.length === 0) needed.push(NEED_COPY.media)
  if (input.accountIds.length === 0) needed.push(NEED_COPY.accounts)
  if (input.platforms.includes('youtube') && !input.youtubeTitle?.trim()) {
    needed.push(NEED_COPY.youtube_title)
  }
  if (!input.scheduledAt) needed.push(NEED_COPY.schedule)
  return needed
}

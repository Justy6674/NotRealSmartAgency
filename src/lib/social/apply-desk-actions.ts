import type { SocialDeskAction } from './actions'
import {
  SOCIAL_PLATFORMS,
  type SocialMediaRef,
  type SocialPlatform,
  type SocialPostDocumentV1,
} from './model'
import { SOCIAL_PLATFORM_CAPABILITIES } from './capabilities'
import { reduceSocialCommand } from './reducer'
import {
  createVersionsFromMaster,
  customisePlatform,
  type PostVersions,
} from '@/lib/post-versions'
import { sdkOptionsToComposer } from '@/lib/publishers/zernio-platform-data'
import type { PostPlatform } from '@/types/database'

function asSocialPlatforms(platforms: readonly string[]): SocialPlatform[] {
  return platforms.filter((platform): platform is SocialPlatform =>
    (SOCIAL_PLATFORMS as readonly string[]).includes(platform),
  )
}

export interface ComposeDeskPatch {
  caption: string
  hashtags: string[]
  selectedPlatforms: PostPlatform[]
  selectedMediaIds: string[]
  selectedAccountIds: string[]
  versions: PostVersions
  platformOptions: Record<string, Record<string, unknown>>
  showPerPlatformVersions: boolean
  showDirectorHashtagNote: boolean
  successLabel: string
  scheduledAt?: string
  inverseActions: SocialDeskAction[]
}

export interface ComposeDeskSnapshotInput {
  brandId: string
  caption: string
  hashtags: string[]
  selectedPlatforms: PostPlatform[]
  selectedMediaIds: string[]
  selectedAccountIds: string[]
  versions: PostVersions
  platformOptions: Record<string, Record<string, unknown>>
  mediaById: Map<string, SocialMediaRef>
}

function emptyDocument(brandId: string, now: string): SocialPostDocumentV1 {
  return {
    schemaVersion: 1,
    compositionId: '00000000-0000-4000-8000-000000000001',
    brandId,
    ownerUserId: '00000000-0000-4000-8000-000000000002',
    conversationId: null,
    revision: 0,
    lifecycle: 'editing',
    masterCaption: '',
    hashtags: [],
    contentType: 'feed',
    media: [],
    targets: [],
    schedule: { mode: 'draft', timezone: 'Australia/Sydney' },
    compliance: { warnings: [] },
    updatedAt: now,
  }
}

export function composeStateToDocument(
  input: ComposeDeskSnapshotInput,
  now = new Date().toISOString(),
): SocialPostDocumentV1 {
  const document = emptyDocument(input.brandId, now)
  document.masterCaption = input.caption
  document.hashtags = input.hashtags
  document.media = input.selectedMediaIds.flatMap((id, position) => {
    const media = input.mediaById.get(id)
    return media ? [{ ...media, position }] : []
  })
  document.targets = asSocialPlatforms(input.selectedPlatforms).map((platform) => ({
    targetId: platform,
    platform,
    accountIds: input.selectedAccountIds,
    captionOverride: input.versions[platform]?.isCustomised
      ? input.versions[platform]?.caption
      : undefined,
    options: { ...(input.platformOptions[platform] ?? {}) },
    firstComment: typeof input.platformOptions[platform]?.first_comment === 'string'
      ? (input.platformOptions[platform]!.first_comment as string)
      : undefined,
    title: typeof input.platformOptions[platform]?.title === 'string'
      ? (input.platformOptions[platform]!.title as string)
      : undefined,
  }))
  return document
}

function documentToPatch(
  document: SocialPostDocumentV1,
  hashtagsAreSuggested: boolean,
): ComposeDeskPatch {
  const selectedPlatforms = document.targets.map((target) => target.platform) as PostPlatform[]
  let showPerPlatformVersions = false
  const versions = (() => {
    let next = createVersionsFromMaster(selectedPlatforms, document.masterCaption, document.hashtags)
    for (const target of document.targets) {
      if (target.captionOverride) {
        next = customisePlatform(next, target.platform as PostPlatform, target.captionOverride, document.hashtags)
        showPerPlatformVersions = selectedPlatforms.length > 1
      }
    }
    return next
  })()

  const platformOptions: Record<string, Record<string, unknown>> = {}
  for (const target of document.targets) {
    const options = sdkOptionsToComposer(target.platform, { ...target.options })
    if (target.firstComment) options.first_comment = target.firstComment
    if (target.title) options.title = target.title
    if (target.cover?.kind === 'url') options.cover_image_url = target.cover.url
    platformOptions[target.platform] = options
  }

  return {
    caption: document.masterCaption,
    hashtags: document.hashtags,
    selectedPlatforms,
    selectedMediaIds: document.media.map((item) => item.mediaItemId),
    selectedAccountIds: [...new Set(document.targets.flatMap((target) => target.accountIds))],
    versions,
    platformOptions,
    showPerPlatformVersions,
    showDirectorHashtagNote: hashtagsAreSuggested && document.hashtags.length > 0,
    successLabel: document.targets.some((target) => target.captionOverride) && document.targets.length > 1
      ? 'Put each account\'s words on the post'
      : document.targets.length === 1
      ? `Added to ${document.targets[0]!.platform.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())} caption`
      : 'Added to caption',
    scheduledAt: document.schedule.mode === 'at' ? document.schedule.scheduledAt : undefined,
    inverseActions: [],
  }
}

export function applyDeskActionsToCompose(
  actions: SocialDeskAction[],
  input: ComposeDeskSnapshotInput,
  opts?: { hashtagsAreSuggested?: boolean; now?: string },
): ComposeDeskPatch {
  const now = opts?.now ?? new Date().toISOString()
  let document = composeStateToDocument(input, now)
  const inverseActions: SocialDeskAction[] = []
  for (const action of actions) {
    const result = reduceSocialCommand(document, action, {
      capabilities: SOCIAL_PLATFORM_CAPABILITIES,
      now,
      mediaById: input.mediaById,
    })
    document = result.document
    if (result.inverseAction) inverseActions.unshift(result.inverseAction)
  }
  return { ...documentToPatch(document, Boolean(opts?.hashtagsAreSuggested)), inverseActions }
}

export function captionDraftToDeskActions(draft: {
  caption: string
  hashtags: string[]
  platforms?: PostPlatform[]
  copies?: Array<{
    platform: PostPlatform
    caption: string
    hashtags: string[]
    title?: string
  }>
  youtubeTitle?: string
}): SocialDeskAction[] {
  const actions: SocialDeskAction[] = [
    { type: 'set_master_caption', caption: draft.caption },
    { type: 'set_hashtags', hashtags: draft.hashtags },
  ]
  const fromCopies = asSocialPlatforms((draft.copies ?? []).map((copy) => copy.platform))
  const platforms = fromCopies.length > 0 ? fromCopies : asSocialPlatforms(draft.platforms ?? [])
  if (platforms.length > 0) {
    actions.push({ type: 'set_platforms', platforms })
  }
  for (const copy of draft.copies ?? []) {
    if (!(SOCIAL_PLATFORMS as readonly string[]).includes(copy.platform)) continue
    actions.push({ type: 'set_platform_caption', targetId: copy.platform, caption: copy.caption })
    if (copy.platform === 'youtube' && copy.title) {
      actions.push({ type: 'set_platform_title', targetId: 'youtube', title: copy.title })
    }
  }
  if (draft.youtubeTitle && !(draft.copies ?? []).some((copy) => copy.platform === 'youtube' && copy.title)) {
    actions.push({ type: 'set_platform_title', targetId: 'youtube', title: draft.youtubeTitle })
  }
  return actions
}

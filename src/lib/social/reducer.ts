import type { SocialDeskAction } from './actions'
import type { SocialPlatformCapabilities } from './capabilities'
import type { SocialMediaRef, SocialPostDocumentV1, SocialTarget } from './model'

export class SocialCommandError extends Error {
  constructor(
    public readonly code: 'INVALID_ACTION' | 'UNSUPPORTED_OPTION' | 'MEDIA_NOT_AVAILABLE',
    message: string,
  ) {
    super(message)
    this.name = 'SocialCommandError'
  }
}

export interface SocialReducerContext {
  capabilities: SocialPlatformCapabilities
  now: string
  mediaById: Map<string, SocialMediaRef>
}

export interface SocialReducerResult {
  document: SocialPostDocumentV1
  inverseAction?: SocialDeskAction
  touchedPaths: string[]
  warnings: string[]
}

function targetIndex(document: SocialPostDocumentV1, targetId: string): number {
  const index = document.targets.findIndex((target) => target.targetId === targetId)
  if (index < 0) throw new SocialCommandError('INVALID_ACTION', 'That social account target is no longer part of this post.')
  return index
}

function normaliseMedia(media: SocialMediaRef[]): SocialMediaRef[] {
  return media.map((item, position) => ({ ...item, position }))
}

/** Keep the owner's casing. Lowercasing #DownscaleWeightLoss is how a brand hashtag disappeared. */
function cleanHashtags(hashtags: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const raw of hashtags) {
    const tag = raw.trim().replace(/^#+/, '')
    if (!tag) continue
    const key = tag.toLocaleLowerCase('en-AU')
    if (seen.has(key)) continue
    seen.add(key)
    out.push(tag)
  }
  return out
}

function assertOptionKeys(
  platform: SocialTarget['platform'],
  keys: string[],
  capabilities: SocialPlatformCapabilities,
) {
  const allowed = capabilities[platform].optionKeys
  const unsupported = keys.filter((key) => !allowed.includes(key))
  if (unsupported.length) {
    throw new SocialCommandError('UNSUPPORTED_OPTION', `Unsupported option: ${unsupported.join(', ')}`)
  }
}

function clearCaptionCompliance(document: SocialPostDocumentV1) {
  document.compliance = {
    ...document.compliance,
    allowed: undefined,
    captionHash: undefined,
    checkedAt: undefined,
  }
}

function assertOwnedMedia(ids: string[], mediaById: Map<string, SocialMediaRef>) {
  for (const id of ids) {
    if (!mediaById.has(id)) {
      throw new SocialCommandError('MEDIA_NOT_AVAILABLE', 'That media is not available for this business.')
    }
  }
}

export function reduceSocialCommand(
  current: SocialPostDocumentV1,
  action: SocialDeskAction,
  context: SocialReducerContext,
): SocialReducerResult {
  const document = structuredClone(current)
  let inverseAction: SocialDeskAction | undefined
  let touchedPaths: string[] = []

  switch (action.type) {
    case 'set_master_caption':
      inverseAction = { type: 'set_master_caption', caption: current.masterCaption }
      document.masterCaption = action.caption
      clearCaptionCompliance(document)
      touchedPaths = ['masterCaption', 'compliance']
      break
    case 'set_platforms': {
      const unique = [...new Set(action.platforms)]
      if (unique.length !== action.platforms.length) {
        throw new SocialCommandError('INVALID_ACTION', 'A platform was selected more than once.')
      }
      inverseAction = { type: 'restore_targets', targets: structuredClone(current.targets) }
      document.targets = unique.map((platform) => (
        current.targets.find((target) => target.platform === platform)
        ?? { targetId: platform, platform, accountIds: [], options: {} }
      ))
      touchedPaths = ['targets']
      break
    }
    case 'restore_targets':
      inverseAction = { type: 'restore_targets', targets: structuredClone(current.targets) }
      document.targets = structuredClone(action.targets)
      touchedPaths = ['targets']
      break
    case 'set_platform_caption': {
      const index = targetIndex(document, action.targetId)
      inverseAction = { type: 'set_platform_caption', targetId: action.targetId, caption: current.targets[index]!.captionOverride ?? null }
      if (action.caption === null) delete document.targets[index]!.captionOverride
      else document.targets[index]!.captionOverride = action.caption
      clearCaptionCompliance(document)
      touchedPaths = [`targets.${action.targetId}.captionOverride`, 'compliance']
      break
    }
    case 'choose_accounts': {
      const index = targetIndex(document, action.targetId)
      if (new Set(action.accountIds).size !== action.accountIds.length) {
        throw new SocialCommandError('INVALID_ACTION', 'An account was selected more than once.')
      }
      inverseAction = { type: 'choose_accounts', targetId: action.targetId, accountIds: [...current.targets[index]!.accountIds] }
      document.targets[index]!.accountIds = [...action.accountIds]
      touchedPaths = [`targets.${action.targetId}.accountIds`]
      break
    }
    case 'set_platform_title': {
      const index = targetIndex(document, action.targetId)
      if (!context.capabilities[document.targets[index]!.platform].title) {
        throw new SocialCommandError('UNSUPPORTED_OPTION', 'That platform does not support a title for this post.')
      }
      inverseAction = { type: 'set_platform_title', targetId: action.targetId, title: current.targets[index]!.title ?? null }
      if (action.title === null) delete document.targets[index]!.title
      else document.targets[index]!.title = action.title
      touchedPaths = [`targets.${action.targetId}.title`]
      break
    }
    case 'set_first_comment': {
      const index = targetIndex(document, action.targetId)
      if (!context.capabilities[document.targets[index]!.platform].firstComment) {
        throw new SocialCommandError('UNSUPPORTED_OPTION', 'That platform does not support a first comment.')
      }
      inverseAction = { type: 'set_first_comment', targetId: action.targetId, firstComment: current.targets[index]!.firstComment ?? null }
      if (action.firstComment === null) delete document.targets[index]!.firstComment
      else document.targets[index]!.firstComment = action.firstComment
      touchedPaths = [`targets.${action.targetId}.firstComment`]
      break
    }
    case 'set_cover': {
      const index = targetIndex(document, action.targetId)
      if (context.capabilities[document.targets[index]!.platform].cover === 'unsupported') {
        throw new SocialCommandError('UNSUPPORTED_OPTION', 'That platform does not accept a cover through the current publishing contract.')
      }
      if (action.source?.kind === 'media') assertOwnedMedia([action.source.mediaItemId], context.mediaById)
      inverseAction = { type: 'set_cover', targetId: action.targetId, source: current.targets[index]!.cover ?? null }
      if (action.source === null) delete document.targets[index]!.cover
      else document.targets[index]!.cover = action.source
      touchedPaths = [`targets.${action.targetId}.cover`]
      break
    }
    case 'add_media': {
      if (document.media.some((item) => item.mediaItemId === action.mediaItemId)) {
        throw new SocialCommandError('INVALID_ACTION', 'That media is already attached.')
      }
      const media = context.mediaById.get(action.mediaItemId)
      if (!media) throw new SocialCommandError('MEDIA_NOT_AVAILABLE', 'That media is not available for this business.')
      const at = Math.min(action.at ?? document.media.length, document.media.length)
      document.media.splice(at, 0, media)
      document.media = normaliseMedia(document.media)
      inverseAction = { type: 'remove_media', mediaItemId: action.mediaItemId }
      touchedPaths = ['media']
      break
    }
    case 'remove_media': {
      if (!document.media.some((item) => item.mediaItemId === action.mediaItemId)) {
        throw new SocialCommandError('INVALID_ACTION', 'That media is not attached.')
      }
      inverseAction = { type: 'restore_media', media: structuredClone(current.media) }
      document.media = normaliseMedia(document.media.filter((item) => item.mediaItemId !== action.mediaItemId))
      touchedPaths = ['media']
      break
    }
    case 'restore_media':
      assertOwnedMedia(action.media.map((item) => item.mediaItemId), context.mediaById)
      inverseAction = { type: 'restore_media', media: structuredClone(current.media) }
      document.media = normaliseMedia(structuredClone(action.media))
      touchedPaths = ['media']
      break
    case 'reorder_media': {
      const existing = current.media.map((item) => item.mediaItemId)
      if (
        action.mediaItemIds.length !== existing.length
        || new Set(action.mediaItemIds).size !== existing.length
        || action.mediaItemIds.some((id) => !existing.includes(id))
      ) {
        throw new SocialCommandError('INVALID_ACTION', 'Media order must contain each attached item exactly once.')
      }
      inverseAction = { type: 'reorder_media', mediaItemIds: existing }
      document.media = normaliseMedia(action.mediaItemIds.map((id) => document.media.find((item) => item.mediaItemId === id)!))
      touchedPaths = ['media']
      break
    }
    case 'set_content_type':
      inverseAction = { type: 'set_content_type', contentType: current.contentType }
      document.contentType = action.contentType
      touchedPaths = ['contentType']
      break
    case 'set_hashtags':
      inverseAction = { type: 'set_hashtags', hashtags: [...current.hashtags] }
      document.hashtags = cleanHashtags(action.hashtags)
      touchedPaths = ['hashtags']
      break
    case 'set_platform_options': {
      const index = targetIndex(document, action.targetId)
      assertOptionKeys(document.targets[index]!.platform, Object.keys(action.patch), context.capabilities)
      inverseAction = {
        type: 'replace_platform_options',
        targetId: action.targetId,
        options: { ...current.targets[index]!.options },
      }
      document.targets[index]!.options = { ...document.targets[index]!.options, ...action.patch }
      touchedPaths = Object.keys(action.patch).map((key) => `targets.${action.targetId}.options.${key}`)
      break
    }
    case 'replace_platform_options': {
      const index = targetIndex(document, action.targetId)
      assertOptionKeys(document.targets[index]!.platform, Object.keys(action.options), context.capabilities)
      inverseAction = {
        type: 'replace_platform_options',
        targetId: action.targetId,
        options: { ...current.targets[index]!.options },
      }
      document.targets[index]!.options = { ...action.options }
      touchedPaths = [`targets.${action.targetId}.options`]
      break
    }
    case 'set_schedule':
      inverseAction = { type: 'set_schedule', schedule: { ...current.schedule } }
      document.schedule = action.schedule
      touchedPaths = ['schedule']
      break
    case 'save_draft':
    case 'schedule_post':
    case 'request_publish':
    case 'confirm_publish':
    case 'undo':
      throw new SocialCommandError('INVALID_ACTION', 'That action requires the command service.')
    default:
      throw new SocialCommandError('INVALID_ACTION', 'Unknown Social command.')
  }

  document.revision = current.revision + 1
  document.updatedAt = context.now
  return { document, inverseAction, touchedPaths, warnings: [] }
}

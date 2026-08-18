import {
  createVersionsFromMaster,
  customisePlatform,
  updateMasterCaption,
  type PostVersions,
} from '@/lib/post-versions'
import type { PostPlatform } from '@/types/database'
import type { CaptionApplyPayload } from '@/stores/compose-desk-store'

export interface CaptionApplyResult {
  caption: string
  hashtags: string[]
  selectedPlatforms: PostPlatform[]
  versions: PostVersions
  showPerPlatformVersions: boolean
  showDirectorHashtagNote: boolean
  /** User-facing confirmation after apply */
  successLabel: string
  /** True when caption went to a platform override, not master-only */
  appliedAsPlatformOverride: boolean
}

/**
 * Pure apply logic: Director draft → Compose state patch.
 * PostCreator calls this so the behaviour is testable without TipTap.
 */
export function applyCaptionPayloadToCompose(
  payload: CaptionApplyPayload,
  current: {
    selectedPlatforms: PostPlatform[]
    versions: PostVersions
    caption: string
    hashtags: string[]
  },
): CaptionApplyResult {
  const nextCaption = payload.caption
  const nextTags = payload.hashtags
  const draftPlatforms = payload.platforms ?? []
  const singlePlatform = draftPlatforms.length === 1 ? draftPlatforms[0] : undefined

  let selectedPlatforms = [...current.selectedPlatforms]
  let versions = { ...current.versions }
  let showPerPlatformVersions = false
  let appliedAsPlatformOverride = false

  if (
    singlePlatform &&
    selectedPlatforms.length > 1 &&
    selectedPlatforms.includes(singlePlatform)
  ) {
    versions = customisePlatform(versions, singlePlatform, nextCaption, nextTags)
    showPerPlatformVersions = true
    appliedAsPlatformOverride = true
  } else if (draftPlatforms.length > 0 && selectedPlatforms.length === 0) {
    selectedPlatforms = draftPlatforms
    versions = createVersionsFromMaster(draftPlatforms, nextCaption, nextTags)
  } else if (draftPlatforms.length > 0) {
    const base =
      Object.keys(versions).length > 0
        ? updateMasterCaption(versions, nextCaption, nextTags)
        : createVersionsFromMaster(
            selectedPlatforms.length > 0 ? selectedPlatforms : draftPlatforms,
            nextCaption,
            nextTags,
          )
    if (singlePlatform && selectedPlatforms.includes(singlePlatform)) {
      versions = customisePlatform(base, singlePlatform, nextCaption, nextTags)
      appliedAsPlatformOverride = true
      showPerPlatformVersions = selectedPlatforms.length > 1
    } else {
      versions = base
    }
  } else {
    versions = updateMasterCaption(versions, nextCaption, nextTags)
  }

  const platformLabel =
    singlePlatform && appliedAsPlatformOverride
      ? singlePlatform.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
      : null

  const successLabel = platformLabel
    ? `Added to ${platformLabel} caption`
    : 'Added to caption'

  return {
    caption: nextCaption,
    hashtags: nextTags,
    selectedPlatforms,
    versions,
    showPerPlatformVersions,
    showDirectorHashtagNote: Boolean(payload.hashtagsAreSuggested && nextTags.length > 0),
    successLabel,
    appliedAsPlatformOverride,
  }
}

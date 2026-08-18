/**
 * Compose desk snapshot — what the Director rail must see while the owner
 * works in Social → Compose (or Media library). Persisted to conversation
 * metadata via /api/desk/context; never faked in the footer badge.
 */

export type ComposeDeskScreen = 'compose' | 'media_library'

export interface ComposeDeskSnapshot {
  screen: ComposeDeskScreen
  brandId: string
  contentType?: string
  mediaItemIds: string[]
  /** Human labels — usually file_name, never invented product names */
  mediaLabels: string[]
  mediaTypes: string[]
  platforms: string[]
  captionPreview?: string
  updatedAt: number
}

export function composeDeskIsActive(snapshot: ComposeDeskSnapshot | null): boolean {
  if (!snapshot) return false
  if (snapshot.screen === 'compose') {
    return (
      snapshot.mediaItemIds.length > 0 ||
      snapshot.platforms.length > 0 ||
      !!snapshot.captionPreview?.trim()
    )
  }
  return snapshot.screen === 'media_library'
}

/** Summary stored in desk context `intent` so the chat route sees it. */
export function buildComposeDeskIntent(snapshot: ComposeDeskSnapshot): string {
  if (snapshot.screen === 'media_library') {
    return 'Media library open — owner browsing files for the next post.'
  }

  const type = (snapshot.contentType ?? 'post').replace(/_/g, ' ')
  const media =
    snapshot.mediaLabels.length > 0
      ? snapshot.mediaLabels.join(', ')
      : 'none selected'
  const platforms =
    snapshot.platforms.length > 0 ? snapshot.platforms.join(', ') : 'none chosen'
  const caption = snapshot.captionPreview?.trim()
    ? `Caption started: "${snapshot.captionPreview.trim()}"`
    : 'Caption: empty'

  return `Compose in progress — ${type}. Media: ${media}. Platforms: ${platforms}. ${caption}.`
}

/** Wrap a wand-button prompt with the live desk facts. */
export function wrapComposeDirectorPrompt(
  snapshot: ComposeDeskSnapshot | null,
  userPrompt: string,
): string {
  if (!snapshot || !composeDeskIsActive(snapshot)) return userPrompt

  const facts = [
    '## COMPOSE DESK (live — trust this over guessing)',
    buildComposeDeskIntent(snapshot),
    snapshot.mediaItemIds.length
      ? `Media IDs (exact): ${snapshot.mediaItemIds.join(', ')}`
      : null,
    snapshot.mediaTypes.length
      ? `Media types: ${snapshot.mediaTypes.join(', ')}`
      : null,
    'Call query_media with mode="analysis" for selected IDs before describing what is in the clip.',
    'Do not invent product names from filenames or transcripts.',
  ]
    .filter(Boolean)
    .join('\n')

  return `${facts}\n\n---\n\n${userPrompt}`
}

/** Idle copy when Compose has media attached but no chat yet. */
export function composeDirectorIdleCopy(snapshot: ComposeDeskSnapshot): {
  headline: string
  body: string
} {
  const primary = snapshot.mediaLabels[0] ?? 'your clip'
  const isVideo = snapshot.mediaTypes.some((t) => t.startsWith('video/'))
  const platformLine =
    snapshot.platforms.length > 0
      ? snapshot.platforms.map((p) => p.replace(/_/g, ' ')).join(', ')
      : 'your accounts'

  if (snapshot.mediaItemIds.length > 0 && !snapshot.captionPreview?.trim()) {
    return {
      headline: 'Director',
      body: isVideo
        ? `I can see ${primary} ready for ${platformLine}. What's the main message in this clip — and who is it for? I can write the caption once you tell me the angle.`
        : `I can see ${primary} on the desk for ${platformLine}. What should this post say, and who is it for?`,
    }
  }

  if (snapshot.captionPreview?.trim()) {
    return {
      headline: 'Director',
      body: `You have a draft caption for ${platformLine}. Want me to tighten it, check the tone, or suggest hashtags?`,
    }
  }

  return {
    headline: 'Director',
    body: `You're composing a ${(snapshot.contentType ?? 'post').replace(/_/g, ' ')} for ${platformLine}. Pick media or tell me what you want to say — I'll help from there.`,
  }
}

export function composeDirectorSuggestions(snapshot: ComposeDeskSnapshot) {
  const platformNames =
    snapshot.platforms.length > 0
      ? snapshot.platforms.join(', ')
      : 'social media'
  const mediaName = snapshot.mediaLabels[0] ?? 'selected media'

  const items = []

  if (snapshot.mediaItemIds.length > 0 && !snapshot.captionPreview?.trim()) {
    items.push({
      id: 'write-caption',
      label: 'Write my caption',
      prompt: wrapComposeDirectorPrompt(
        snapshot,
        `Write a caption (text only) for ${mediaName} on ${platformNames}. First tell me what you see in the media, then ask one clarifying question if needed, then draft the caption and 5–8 lowercase hashtags.`,
      ),
    })
    items.push({
      id: 'review-media',
      label: 'Review my clip',
      prompt: wrapComposeDirectorPrompt(
        snapshot,
        `Review ${mediaName}. Call query_media with mode="analysis". Tell me what you understand is in it, the strongest hook, and who it is for. Do not draft yet — confirm understanding first.`,
      ),
    })
  } else if (snapshot.captionPreview?.trim()) {
    items.push({
      id: 'improve-caption',
      label: 'Improve this caption',
      prompt: wrapComposeDirectorPrompt(
        snapshot,
        `Improve this caption for ${platformNames}. Return only the revised caption text and hashtags:\n\n"${snapshot.captionPreview}"`,
      ),
    })
  }

  return items
}

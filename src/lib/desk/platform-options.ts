const DESK_PLATFORM_ORDER = ['YouTube', 'Instagram', 'Facebook', 'TikTok'] as const

function canonicalPlatform(platform: string): (typeof DESK_PLATFORM_ORDER)[number] | null {
  const value = platform.trim().toLowerCase()
  if (value.includes('youtube')) return 'YouTube'
  if (value.includes('instagram')) return 'Instagram'
  if (value.includes('facebook')) return 'Facebook'
  if (value.includes('tiktok')) return 'TikTok'
  return null
}

/**
 * Keep the Desk focused on the channels this brand can actually use.
 * TikTok is deliberately absent until Mixpost reports an authorised account.
 */
export function deskPlatformOptions(connectedPlatforms: readonly string[]): string[] {
  const connected = new Set(
    connectedPlatforms
      .map(canonicalPlatform)
      .filter((platform): platform is (typeof DESK_PLATFORM_ORDER)[number] => platform !== null),
  )

  return DESK_PLATFORM_ORDER.filter((platform) => connected.has(platform))
}

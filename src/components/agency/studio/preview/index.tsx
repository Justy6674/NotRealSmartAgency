export { PhoneFrame } from './PhoneFrame'
export { InstagramMockup } from './InstagramMockup'
export { FacebookMockup } from './FacebookMockup'
export { LinkedInMockup } from './LinkedInMockup'
export { TikTokMockup } from './TikTokMockup'
export { YouTubeMockup } from './YouTubeMockup'
export { BlueskyMockup } from './BlueskyMockup'
export { MastodonMockup } from './MastodonMockup'
export { PinterestMockup } from './PinterestMockup'
export { ThreadsMockup } from './ThreadsMockup'
export { GoogleBusinessMockup } from './GoogleBusinessMockup'
export { ComposerPreviewPane } from './ComposerPreviewPane'

import { InstagramMockup } from './InstagramMockup'
import { FacebookMockup } from './FacebookMockup'
import { LinkedInMockup } from './LinkedInMockup'
import { TikTokMockup } from './TikTokMockup'
import { YouTubeMockup } from './YouTubeMockup'
import { BlueskyMockup } from './BlueskyMockup'
import { MastodonMockup } from './MastodonMockup'
import { PinterestMockup } from './PinterestMockup'
import { ThreadsMockup } from './ThreadsMockup'
import { GoogleBusinessMockup } from './GoogleBusinessMockup'
import { RETIRED_COMPOSER_PLATFORMS } from '@/lib/social/capabilities'

interface PlatformMockupProps {
  platform: string
  caption: string
  hashtags?: string[]
  mediaUrl?: string
  mediaUrls?: string[]
  brandName: string
  brandAvatarUrl?: string
}

/**
 * Renders the appropriate phone-frame platform mockup for the given platform.
 *
 * A retired network has no frame. That list is `RETIRED_COMPOSER_PLATFORMS`
 * rather than a `case 'twitter'` of our own, because the whole point of that
 * constant is that retiring the next network is one edit, not a hunt through
 * six hand-kept copies — and this file was very nearly the seventh.
 *
 * An unnamed platform returns nothing too. It used to fall through to the
 * Instagram frame, which showed the owner his post on a network he was not
 * sending to.
 */
export function PlatformMockupPreview({ platform, ...props }: PlatformMockupProps) {
  if ((RETIRED_COMPOSER_PLATFORMS as readonly string[]).includes(platform)) return null

  switch (platform) {
    case 'instagram':
      return <InstagramMockup {...props} />
    case 'facebook':
      return <FacebookMockup {...props} />
    case 'linkedin':
      return <LinkedInMockup {...props} />
    case 'tiktok':
      return <TikTokMockup {...props} />
    case 'youtube':
      return <YouTubeMockup {...props} />
    case 'bluesky':
      return <BlueskyMockup {...props} />
    case 'mastodon':
      return <MastodonMockup {...props} />
    case 'pinterest':
      return <PinterestMockup {...props} />
    case 'threads':
      return <ThreadsMockup {...props} />
    case 'google_business':
      return <GoogleBusinessMockup {...props} />
    default:
      return null
  }
}

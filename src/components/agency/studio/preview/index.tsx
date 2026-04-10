export { PhoneFrame } from './PhoneFrame'
export { InstagramMockup } from './InstagramMockup'
export { FacebookMockup } from './FacebookMockup'
export { LinkedInMockup } from './LinkedInMockup'
export { XMockup } from './XMockup'
export { TikTokMockup } from './TikTokMockup'
export { YouTubeMockup } from './YouTubeMockup'
export { BlueskyMockup } from './BlueskyMockup'
export { MastodonMockup } from './MastodonMockup'
export { PinterestMockup } from './PinterestMockup'
export { ThreadsMockup } from './ThreadsMockup'
export { GoogleBusinessMockup } from './GoogleBusinessMockup'

import { InstagramMockup } from './InstagramMockup'
import { FacebookMockup } from './FacebookMockup'
import { LinkedInMockup } from './LinkedInMockup'
import { XMockup } from './XMockup'
import { TikTokMockup } from './TikTokMockup'
import { YouTubeMockup } from './YouTubeMockup'
import { BlueskyMockup } from './BlueskyMockup'
import { MastodonMockup } from './MastodonMockup'
import { PinterestMockup } from './PinterestMockup'
import { ThreadsMockup } from './ThreadsMockup'
import { GoogleBusinessMockup } from './GoogleBusinessMockup'

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
 */
export function PlatformMockupPreview({ platform, ...props }: PlatformMockupProps) {
  switch (platform) {
    case 'instagram':
      return <InstagramMockup {...props} />
    case 'facebook':
      return <FacebookMockup {...props} />
    case 'linkedin':
      return <LinkedInMockup {...props} />
    case 'twitter':
      return <XMockup {...props} />
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
      return <InstagramMockup {...props} />
  }
}

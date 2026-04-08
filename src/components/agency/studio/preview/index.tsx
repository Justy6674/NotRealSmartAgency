export { PhoneFrame } from './PhoneFrame'
export { InstagramMockup } from './InstagramMockup'
export { FacebookMockup } from './FacebookMockup'
export { LinkedInMockup } from './LinkedInMockup'
export { XMockup } from './XMockup'
export { TikTokMockup } from './TikTokMockup'
export { YouTubeMockup } from './YouTubeMockup'

import { InstagramMockup } from './InstagramMockup'
import { FacebookMockup } from './FacebookMockup'
import { LinkedInMockup } from './LinkedInMockup'
import { XMockup } from './XMockup'
import { TikTokMockup } from './TikTokMockup'
import { YouTubeMockup } from './YouTubeMockup'

interface PlatformMockupProps {
  platform: string
  caption: string
  hashtags?: string[]
  mediaUrl?: string
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
    default:
      return <InstagramMockup {...props} />
  }
}

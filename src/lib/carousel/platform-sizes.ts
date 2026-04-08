/**
 * Platform-specific carousel/image dimensions.
 * Used by both client-side (html-to-image) and server-side (satori) renderers.
 */

export interface PlatformSize {
  key: string
  label: string
  width: number
  height: number
  aspectRatio: string
  platforms: string[]
  maxSlides: number
}

export const PLATFORM_SIZES: PlatformSize[] = [
  {
    key: 'ig-feed',
    label: 'Instagram Feed',
    width: 1080,
    height: 1080,
    aspectRatio: '1:1',
    platforms: ['instagram'],
    maxSlides: 10,
  },
  {
    key: 'ig-story',
    label: 'Instagram Story / Reel',
    width: 1080,
    height: 1920,
    aspectRatio: '9:16',
    platforms: ['instagram', 'tiktok', 'youtube'],
    maxSlides: 10,
  },
  {
    key: 'linkedin',
    label: 'LinkedIn',
    width: 1080,
    height: 1080,
    aspectRatio: '1:1',
    platforms: ['linkedin'],
    maxSlides: 20,
  },
  {
    key: 'linkedin-wide',
    label: 'LinkedIn Wide',
    width: 1200,
    height: 627,
    aspectRatio: '1.91:1',
    platforms: ['linkedin'],
    maxSlides: 20,
  },
  {
    key: 'facebook',
    label: 'Facebook',
    width: 1080,
    height: 1080,
    aspectRatio: '1:1',
    platforms: ['facebook'],
    maxSlides: 10,
  },
  {
    key: 'tiktok',
    label: 'TikTok',
    width: 1080,
    height: 1920,
    aspectRatio: '9:16',
    platforms: ['tiktok'],
    maxSlides: 35,
  },
]

export const DEFAULT_SIZE = PLATFORM_SIZES[0] // ig-feed 1:1

export function getSizeForPlatform(platform: string): PlatformSize {
  return PLATFORM_SIZES.find(s => s.platforms.includes(platform)) ?? DEFAULT_SIZE
}

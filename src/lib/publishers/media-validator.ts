/**
 * Pre-flight media validation for native publishers.
 *
 * Checks file sizes, durations, and counts against the platform limits
 * defined in ui-tokens.ts. Called by the dispatcher before attempting
 * to publish — fast-fails with human-readable errors.
 */

import { PLATFORM_MEDIA_LIMITS, type PlatformKey } from '@/lib/mixpost/ui-tokens'
import type { PublishMedia, PublisherPlatform } from './types'

interface ValidationResult {
  ok: boolean
  errors: string[]
}

/**
 * Validate media items against a platform's constraints.
 */
export function validateMedia(
  platform: PublisherPlatform,
  media: PublishMedia[],
): ValidationResult {
  const errors: string[] = []

  // Map publisher platform to ui-tokens platform key
  const key = platform as PlatformKey
  const limits = PLATFORM_MEDIA_LIMITS[key]

  if (!limits) {
    // No limits defined — allow anything
    return { ok: true, errors: [] }
  }

  const images = media.filter((m) => m.type === 'image')
  const videos = media.filter((m) => m.type === 'video')

  // Check image count
  if (images.length > limits.maxImages) {
    errors.push(
      `Too many images: ${images.length} provided, maximum ${limits.maxImages} for ${platform}.`,
    )
  }

  // Check video count
  if (videos.length > limits.maxVideos) {
    errors.push(
      `Too many videos: ${videos.length} provided, maximum ${limits.maxVideos} for ${platform}.`,
    )
  }

  // Check individual video constraints
  const maxBytes = limits.maxVideoSizeMb * 1024 * 1024
  for (const video of videos) {
    if (video.size_bytes && video.size_bytes > maxBytes) {
      const sizeMb = Math.round(video.size_bytes / (1024 * 1024))
      errors.push(
        `Video too large: ${sizeMb} MB exceeds ${limits.maxVideoSizeMb} MB limit for ${platform}.`,
      )
    }

    if (
      video.duration_seconds &&
      video.duration_seconds > limits.maxVideoDurationSec
    ) {
      const mins = Math.round(video.duration_seconds / 60)
      const maxMins = Math.round(limits.maxVideoDurationSec / 60)
      errors.push(
        `Video too long: ~${mins} min exceeds ${maxMins} min limit for ${platform}.`,
      )
    }
  }

  return { ok: errors.length === 0, errors }
}

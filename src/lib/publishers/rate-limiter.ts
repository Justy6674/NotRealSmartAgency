/**
 * Simple in-memory token-bucket rate limiter per (platform, brandId).
 *
 * Not persisted — resets on server restart. Good enough for MVP to
 * prevent accidental burst-publishing that could trigger platform bans.
 *
 * Defaults:
 * - LinkedIn: 25 posts/hour (their API is strict)
 * - All others: 50 posts/hour
 */

import type { PublisherPlatform } from './types'

interface Bucket {
  tokens: number
  lastRefill: number
}

const HOUR_MS = 60 * 60 * 1000

const LIMITS: Record<PublisherPlatform, number> = {
  linkedin: 25,
  facebook: 50,
  instagram: 50,
  tiktok: 50,
  youtube: 50,
  twitter: 50,
}

/** In-memory store keyed by `${platform}:${brandId}` */
const buckets = new Map<string, Bucket>()

function key(platform: PublisherPlatform, brandId: string): string {
  return `${platform}:${brandId}`
}

function getBucket(platform: PublisherPlatform, brandId: string): Bucket {
  const k = key(platform, brandId)
  const existing = buckets.get(k)
  const now = Date.now()
  const maxTokens = LIMITS[platform]

  if (!existing) {
    const bucket: Bucket = { tokens: maxTokens, lastRefill: now }
    buckets.set(k, bucket)
    return bucket
  }

  // Refill tokens proportionally to elapsed time
  const elapsed = now - existing.lastRefill
  const refill = Math.floor((elapsed / HOUR_MS) * maxTokens)

  if (refill > 0) {
    existing.tokens = Math.min(maxTokens, existing.tokens + refill)
    existing.lastRefill = now
  }

  return existing
}

/**
 * Check if publishing is allowed for this platform + brand.
 */
export function canPublish(
  platform: PublisherPlatform,
  brandId: string,
): boolean {
  const bucket = getBucket(platform, brandId)
  return bucket.tokens > 0
}

/**
 * Record a publish event, consuming one token.
 */
export function recordPublish(
  platform: PublisherPlatform,
  brandId: string,
): void {
  const bucket = getBucket(platform, brandId)
  bucket.tokens = Math.max(0, bucket.tokens - 1)
}

/**
 * Get remaining quota for a platform + brand.
 */
export function remainingQuota(
  platform: PublisherPlatform,
  brandId: string,
): number {
  const bucket = getBucket(platform, brandId)
  return bucket.tokens
}

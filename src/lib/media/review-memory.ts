/**
 * Extract memories from review decisions (approve/reject) so the AI
 * learns what the user likes and dislikes for content.
 */

import type { ScheduledPost, DraftSource } from '@/types/database'

interface ReviewDecision {
  action: 'approve' | 'reject'
  post: ScheduledPost
  brandSlug: string
  reason?: string
}

/**
 * Store a review decision as a memory via the API.
 * Called after approve/reject in the ReviewRoom.
 * Fire-and-forget — never blocks the UI.
 */
export function recordReviewDecision(decision: ReviewDecision) {
  const { action, post, brandSlug, reason } = decision
  const meta = (post.metadata ?? {}) as Record<string, unknown>
  const source = (meta.source as DraftSource) ?? 'unknown'
  const contentType = post.content_type ?? 'general'

  let memoryValue: string

  if (action === 'approve') {
    memoryValue = `User approved a ${contentType} ${post.platform} post (source: ${source}). ` +
      `Caption style: "${post.caption.slice(0, 100)}${post.caption.length > 100 ? '...' : ''}". ` +
      `This style works for this brand.`
  } else {
    memoryValue = `User rejected a ${contentType} ${post.platform} post (source: ${source}). ` +
      (reason ? `Reason: ${reason}. ` : '') +
      `Caption was: "${post.caption.slice(0, 100)}${post.caption.length > 100 ? '...' : ''}". ` +
      `Avoid this pattern.`
  }

  // Fire-and-forget memory store
  fetch('/api/memories', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      namespace: `nrs-${brandSlug}-content`,
      key: `review-${action}-${post.platform}-${Date.now()}`,
      value: memoryValue,
      memory_type: action === 'approve' ? 'preference' : 'decision',
      tags: [action, post.platform, source, contentType],
    }),
  }).catch(() => {}) // Silent — never block UI
}

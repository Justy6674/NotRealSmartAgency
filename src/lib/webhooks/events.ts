/**
 * Allowed outbound webhook events.
 *
 * This is the canonical, hardcoded set of events the user can subscribe to.
 * Any new event must be added here AND fired via fireUserWebhooks() from
 * a real event source. The API validates incoming subscriptions against
 * this list, and the editor UI uses it to render the checkbox grid.
 */

export const WEBHOOK_EVENTS = [
  'post.created',
  'post.scheduled',
  'post.published',
  'post.failed',
  'post.comment.added',
  'post.deleted',
  'media.uploaded',
  'brand.updated',
] as const

export type WebhookEvent = (typeof WEBHOOK_EVENTS)[number]

/**
 * Human-readable label for each event — used in the editor UI and the
 * deliveries log so non-developers understand what they subscribed to.
 */
export const WEBHOOK_EVENT_LABELS: Record<WebhookEvent, string> = {
  'post.created': 'Post created',
  'post.scheduled': 'Post scheduled',
  'post.published': 'Post published',
  'post.failed': 'Post failed',
  'post.comment.added': 'Comment on post',
  'post.deleted': 'Post deleted',
  'media.uploaded': 'Media uploaded',
  'brand.updated': 'Brand updated',
}

/**
 * Group label for the editor — keeps related events visually clustered.
 */
export const WEBHOOK_EVENT_GROUPS: Record<string, WebhookEvent[]> = {
  Posts: [
    'post.created',
    'post.scheduled',
    'post.published',
    'post.failed',
    'post.deleted',
    'post.comment.added',
  ],
  Media: ['media.uploaded'],
  Brand: ['brand.updated'],
}

export function isWebhookEvent(value: string): value is WebhookEvent {
  return (WEBHOOK_EVENTS as readonly string[]).includes(value)
}

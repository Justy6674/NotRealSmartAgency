/**
 * Every update type NRS listens for.
 *
 * Telegram only sends what you subscribe to, and `setWebhook` WITHOUT
 * `allowed_updates` subscribes to a default set that excludes reactions. So
 * the emoji-reaction learning the owner asked for could never have received a
 * single event — and an unsubscribed update is indistinguishable from nobody
 * having reacted, which is why it went unnoticed.
 *
 * Listed explicitly, in one place. Anything missing from here silently stops
 * arriving, so a new feature that depends on a new update type must add it
 * here or it will appear to be broken for reasons nothing in the code shows.
 */
export const SUBSCRIBED_UPDATES = [
  'message',
  /** Correcting a typo instead of resending is how people use Telegram. */
  'edited_message',
  'callback_query',
  /** Being added to or removed from a group. */
  'my_chat_member',
  /** 👍 on an answer. Excluded from Telegram's default set. */
  'message_reaction',
] as const

/** The ones a missing subscription would visibly break. */
export const REQUIRED_UPDATES = ['message', 'my_chat_member', 'message_reaction'] as const

/** What is subscribed but should not be, and what is missing. */
export function missingUpdates(allowed: readonly string[] | undefined): string[] {
  // An empty list is not "all" — it means Telegram's default set, which has
  // no reactions in it.
  if (!allowed || allowed.length === 0) return ['message_reaction']
  return REQUIRED_UPDATES.filter((type) => !allowed.includes(type))
}

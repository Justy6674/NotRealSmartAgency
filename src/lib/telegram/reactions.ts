/**
 * A 👍 on an answer is the cheapest feedback there is.
 *
 * The owner asked for this weeks ago. Nothing was built, and worse, nothing
 * could have been: the bot was never subscribed to reaction updates, so a
 * reaction was not ignored by our code — it never arrived. That is the kind of
 * fault with no failure to find, which is why it survived.
 *
 * Why reactions rather than asking. Typing "that one was good" costs a
 * sentence and interrupts what you were doing, so nobody does it and the
 * Director learns nothing from months of use. A thumb costs one tap on a
 * message already on screen. The difference is between feedback that exists
 * and feedback that does not.
 *
 * What it must NOT do: change behaviour on its own. A 👎 records that a piece
 * of copy missed; it does not rewrite anything, retry anything, or send
 * anything. Silent action off an ambiguous tap is how a marketing tool starts
 * publishing things nobody asked for.
 */

/** Plainly positive. */
const APPROVES = new Set(['👍', '❤', '❤️', '🔥', '🥰', '👏', '💯', '🤩', '😍', '🙏', '⚡', '🎉'])
/** Plainly negative. */
const REJECTS = new Set(['👎', '💩', '🤮', '😢', '😱', '🤬', '🙄', '😴', '🥱'])

export type Verdict = 'approved' | 'rejected'

export interface ReactionEvent {
  chatId: string
  telegramUserId: string
  /** The message reacted to — how the verdict is tied back to what was said. */
  messageId: number
  emoji: string
  verdict: Verdict
}

interface RawReaction {
  chat?: { id?: unknown }
  user?: { id?: unknown; is_bot?: unknown }
  message_id?: unknown
  new_reaction?: Array<{ type?: unknown; emoji?: unknown }>
}

/**
 * Read a `message_reaction` update, or return null.
 *
 * Null for anything ambiguous, which includes a reaction being REMOVED (an
 * empty `new_reaction`). Removing a thumb means "I did not mean that", not
 * "the opposite" — recording it as a rejection would invent an opinion nobody
 * expressed.
 */
export function parseReaction(update: unknown): ReactionEvent | null {
  if (!update || typeof update !== 'object') return null
  const raw = (update as { message_reaction?: RawReaction }).message_reaction
  if (!raw) return null

  const chatId = raw.chat?.id
  const userId = raw.user?.id
  const messageId = raw.message_id
  if (chatId === undefined || userId === undefined || typeof messageId !== 'number') return null
  // A bot reacting to a bot is not feedback.
  if (raw.user?.is_bot === true) return null

  const added = raw.new_reaction ?? []
  if (added.length === 0) return null

  // Only emoji reactions carry a meaning we can read. Custom stickers are a
  // paid feature and mean whatever the person who bought them decided.
  const first = added.find((reaction) => reaction.type === 'emoji' && typeof reaction.emoji === 'string')
  const emoji = typeof first?.emoji === 'string' ? first.emoji : null
  if (!emoji) return null

  const verdict = verdictFor(emoji)
  if (!verdict) return null

  return {
    chatId: String(chatId),
    telegramUserId: String(userId),
    messageId,
    emoji,
    verdict,
  }
}

/**
 * What an emoji means, or nothing.
 *
 * The unmapped middle is deliberate and large. 🤔 and 👀 are read as thinking,
 * not judgement, and guessing at them would fill the record with opinions the
 * owner never held — worse than having no record at all, because it would be
 * confidently wrong.
 */
export function verdictFor(emoji: string): Verdict | null {
  if (APPROVES.has(emoji)) return 'approved'
  if (REJECTS.has(emoji)) return 'rejected'
  return null
}

/**
 * The lesson, written the way the Director should read it back.
 *
 * The reacted text is included and truncated: what was approved is the useful
 * part, and a whole caption in a memory row crowds out everything else.
 */
export function lessonFrom(event: ReactionEvent, reactedText: string): string {
  const excerpt = reactedText.trim().replace(/\s+/g, ' ').slice(0, 240)
  return event.verdict === 'approved'
    ? `The owner reacted ${event.emoji} to this — it landed. Write more like it: "${excerpt}"`
    : `The owner reacted ${event.emoji} to this — it missed. Avoid this shape: "${excerpt}"`
}

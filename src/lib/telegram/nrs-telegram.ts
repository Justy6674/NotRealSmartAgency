import { timingSafeEqual } from 'node:crypto'

export interface TelegramUpdate {
  update_id: number
  message?: {
    message_id: number
    chat: { id: number; type: string }
    from?: { id: number; is_bot: boolean }
    text?: string
  }
}

export interface TelegramOwner {
  chatId: string
  userId: string
}

export type TelegramAuthorisation =
  | { ok: true; text: string }
  | { ok: false; reason: 'invalid_secret' | 'unlinked_chat' | 'unsupported_update' }

export interface TelegramBrand {
  id: string
  name: string
  slug: string
}

export type TelegramBrandResolution =
  | { kind: 'matched'; brand: TelegramBrand }
  | { kind: 'needs_brand' }

function secretsMatch(suppliedSecret: string | null, expectedSecret: string): boolean {
  if (!suppliedSecret || suppliedSecret.length !== expectedSecret.length) return false

  return timingSafeEqual(Buffer.from(suppliedSecret), Buffer.from(expectedSecret))
}

/**
 * Telegram only verifies that an update came from its own delivery pipeline.
 * This second gate binds the bot to the configured NRS owner and refuses every
 * group, bot, non-text, and unlinked private-chat update before any Director
 * or brand data is touched.
 */
export function authoriseTelegramUpdate({
  update,
  suppliedSecret,
  expectedSecret,
  owner,
}: {
  update: TelegramUpdate
  suppliedSecret: string | null
  expectedSecret: string
  owner: TelegramOwner
}): TelegramAuthorisation {
  if (!secretsMatch(suppliedSecret, expectedSecret)) {
    return { ok: false, reason: 'invalid_secret' }
  }

  if (!Number.isSafeInteger(update.update_id)) {
    return { ok: false, reason: 'unsupported_update' }
  }

  const message = update.message
  if (!message?.text || !message.from || message.from.is_bot || message.chat.type !== 'private') {
    return { ok: false, reason: 'unsupported_update' }
  }

  if (String(message.chat.id) !== owner.chatId || String(message.from.id) !== owner.userId) {
    return { ok: false, reason: 'unlinked_chat' }
  }

  return { ok: true, text: message.text.trim() }
}

function containsBrandReference(message: string, brand: TelegramBrand): boolean {
  const normalizedMessage = message.toLocaleLowerCase('en-AU')
  const references = [brand.name, brand.slug]
    .map((reference) => reference.trim().toLocaleLowerCase('en-AU'))
    .filter(Boolean)

  return references.some((reference) => {
    const flexibleReference = reference
      .replace(/[^a-z0-9]/gi, '')
      .split('')
      .map((character) => character.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
      .join('[\\s_-]*')

    return new RegExp(`(^|[^a-z0-9])${flexibleReference}([^a-z0-9]|$)`, 'i').test(normalizedMessage)
  })
}

/** Never pick a brand by default: a Telegram request must name one exactly. */
export function resolveTelegramBrand(message: string, brands: TelegramBrand[]): TelegramBrandResolution {
  const matches = brands.filter((brand) => containsBrandReference(message, brand))

  return matches.length === 1
    ? { kind: 'matched', brand: matches[0] }
    : { kind: 'needs_brand' }
}

/** Telegram limits each sendMessage body to 4,096 UTF-16 code units. */
export function splitTelegramMessage(text: string, limit = 4096): string[] {
  const chunks: string[] = []
  let remaining = text.trim()

  while (remaining.length > limit) {
    const boundary = remaining.lastIndexOf('\n', limit)
    const end = boundary > 0 ? boundary : limit
    chunks.push(remaining.slice(0, end))
    remaining = remaining.slice(boundary > 0 ? boundary + 1 : end).trimStart()
  }

  if (remaining) chunks.push(remaining)
  return chunks
}

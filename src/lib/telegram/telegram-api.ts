import { splitTelegramMessage } from './nrs-telegram.ts'

export interface TelegramInlineKeyboard {
  inline_keyboard: Array<Array<
    | { text: string; callback_data: string }
    | { text: string; url: string }
    | { text: string; web_app: { url: string } }
  >>
}

export interface TelegramWebAppMenuButton {
  type: 'web_app'
  text: string
  web_app: { url: string }
}

export async function setTelegramChatMenuButton({
  botToken,
  url,
  text = 'Open NRS',
  fetchImpl = fetch,
}: {
  botToken: string
  url: string
  text?: string
  fetchImpl?: typeof fetch
}): Promise<void> {
  const response = await fetchImpl(`https://api.telegram.org/bot${botToken}/setChatMenuButton`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ menu_button: { type: 'web_app', text, web_app: { url } } satisfies TelegramWebAppMenuButton }),
  })
  if (!response.ok) throw new Error(`Telegram setChatMenuButton failed: ${response.status}`)
}

/**
 * Telegram project changes must use opaque callback data.  Deliberately do
 * not support reply keyboards: their visible text can be replayed as normal
 * chat input and must never be interpreted as a project selector.
 */
export type TelegramReplyMarkup = TelegramInlineKeyboard

export async function sendTelegramText({
  botToken,
  chatId,
  text,
  replyMarkup,
  threadId,
  fetchImpl = fetch,
}: {
  botToken: string
  chatId: string
  text: string
  replyMarkup?: TelegramReplyMarkup
  /**
   * Forum topic to answer in. A group has a topic per project, so leaving this
   * off puts the answer in General — visibly detached from the request that
   * caused it, and in the one topic that says nothing about which brand it is.
   */
  threadId?: number
  fetchImpl?: typeof fetch
}): Promise<void> {
  for (const chunk of splitTelegramMessage(text)) {
    const response = await fetchImpl(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: chunk,
        disable_web_page_preview: true,
        ...(threadId !== undefined ? { message_thread_id: threadId } : {}),
        ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
      }),
    })

    if (!response.ok) {
      throw new Error(`Telegram sendMessage failed: ${response.status}`)
    }
  }
}

/** Telegram accepts at most ten items in one media group. */
export const TELEGRAM_ALBUM_LIMIT = 10

export interface TelegramAlbumItem {
  /** Publicly reachable URL — Telegram fetches the file itself. */
  url: string
  kind: 'photo' | 'video'
}

/**
 * Send finished files back as an album.
 *
 * The bot could only ever send text, so a carousel it had just made existed
 * only as a sentence saying it was ready. Sending the images means they can be
 * saved straight to the phone — which is the whole TikTok path, since TikTok
 * photo posts are not published through Mixpost here.
 *
 * Returns the number of files Telegram accepted rather than throwing: the work
 * is already saved in NRS, and a failed album must not read as a failed job.
 */
export async function sendTelegramAlbum({
  botToken,
  chatId,
  items,
  caption,
  threadId,
  fetchImpl = fetch,
}: {
  botToken: string
  chatId: string
  items: readonly TelegramAlbumItem[]
  /** Shown under the first item only — that is how Telegram renders albums. */
  caption?: string
  threadId?: number
  fetchImpl?: typeof fetch
}): Promise<{ sent: number; error?: string }> {
  if (items.length === 0) return { sent: 0 }

  let sent = 0
  let firstError: string | undefined

  for (let start = 0; start < items.length; start += TELEGRAM_ALBUM_LIMIT) {
    const batch = items.slice(start, start + TELEGRAM_ALBUM_LIMIT)
    const media = batch.map((item, index) => ({
      type: item.kind,
      media: item.url,
      // Only the first item of the first batch carries the caption, so a
      // 12-slide set does not repeat it halfway through.
      ...(caption && start === 0 && index === 0 ? { caption } : {}),
    }))

    try {
      const response = await fetchImpl(`https://api.telegram.org/bot${botToken}/sendMediaGroup`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          media,
          ...(threadId !== undefined ? { message_thread_id: threadId } : {}),
        }),
      })

      const body = (await response.json().catch(() => null)) as
        | { ok?: boolean; description?: string }
        | null

      if (!response.ok || body?.ok === false) {
        firstError ??= body?.description ?? `Telegram sendMediaGroup failed: ${response.status}`
        continue
      }
      sent += batch.length
    } catch (err) {
      firstError ??= err instanceof Error ? err.message : String(err)
    }
  }

  return firstError ? { sent, error: firstError } : { sent }
}

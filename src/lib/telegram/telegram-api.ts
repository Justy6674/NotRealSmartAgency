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
  fetchImpl = fetch,
}: {
  botToken: string
  chatId: string
  text: string
  replyMarkup?: TelegramReplyMarkup
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
        ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
      }),
    })

    if (!response.ok) {
      throw new Error(`Telegram sendMessage failed: ${response.status}`)
    }
  }
}

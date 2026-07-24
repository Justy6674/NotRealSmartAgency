import { splitTelegramMessage } from './nrs-telegram.ts'

export interface TelegramInlineKeyboard {
  inline_keyboard: Array<Array<
    | { text: string; callback_data: string }
    | { text: string; url: string }
  >>
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

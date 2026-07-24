import { splitTelegramMessage } from './nrs-telegram.ts'

export interface TelegramReplyKeyboard {
  keyboard: string[][]
  resize_keyboard?: boolean
  input_field_placeholder?: string
}

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
  replyMarkup?: TelegramReplyKeyboard
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

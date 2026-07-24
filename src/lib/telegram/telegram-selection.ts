/** Durable private-chat state; it is intentionally outside any brand memory namespace. */
export const TELEGRAM_SELECTION_NAMESPACE = 'nrs-telegram-selection'

export function telegramSelectionKey(chatId: string): string {
  return `selected-brand:${chatId}`
}

/** Durable private-chat state; it is intentionally outside any brand memory namespace. */
export const TELEGRAM_SELECTION_NAMESPACE = 'nrs-telegram-selection'

export function telegramSelectionKey(chatId: string): string {
  return `selected-brand:${chatId}`
}

/** A compact picker is essential once an owner has more projects than fit on one Telegram screen. */
export function telegramProjectPickerPageKey(chatId: string): string {
  return `project-picker-page:${chatId}`
}

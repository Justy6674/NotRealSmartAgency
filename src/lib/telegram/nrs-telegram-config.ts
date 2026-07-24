export interface NRSTelegramConfig {
  botToken: string
  webhookSecret: string
  ownerTelegramChatId: string
  ownerTelegramUserId: string
  ownerNrsUserId: string
}

/**
 * A Telegram identity and an NRS/Supabase identity are different values.
 * Keeping them separate prevents a Telegram update from selecting another
 * NRS account's brands or job queue.
 */
export function getNRSTelegramConfig(env: NodeJS.ProcessEnv = process.env): NRSTelegramConfig | null {
  const botToken = env.TELEGRAM_BOT_TOKEN
  const webhookSecret = env.TELEGRAM_WEBHOOK_SECRET_TOKEN
  const ownerTelegramChatId = env.NRS_TELEGRAM_OWNER_CHAT_ID
  const ownerTelegramUserId = env.NRS_TELEGRAM_OWNER_USER_ID
  const ownerNrsUserId = env.NRS_TELEGRAM_OWNER_NRS_USER_ID

  if (!botToken || !webhookSecret || !ownerTelegramChatId || !ownerTelegramUserId || !ownerNrsUserId) {
    return null
  }

  return {
    botToken,
    webhookSecret,
    ownerTelegramChatId,
    ownerTelegramUserId,
    ownerNrsUserId,
  }
}

export interface NRSTelegramConfig {
  botToken: string
  webhookSecret: string
  /** Must be deliberately set after token rotation and production acceptance. */
  enabled: boolean
}

/**
 * Telegram identities are paired to NRS identities in the database with a
 * short-lived one-time code. They are intentionally not configured as a
 * hard-coded bot owner: that would make one ambient Telegram identity an
 * implicit passport to every project.
 */
export function getNRSTelegramConfig(env: NodeJS.ProcessEnv = process.env): NRSTelegramConfig | null {
  const botToken = env.TELEGRAM_BOT_TOKEN
  const webhookSecret = env.TELEGRAM_WEBHOOK_SECRET_TOKEN

  if (!botToken || !webhookSecret) {
    return null
  }

  return {
    botToken,
    webhookSecret,
    enabled: env.NRS_TELEGRAM_CHANNEL_ENABLED === 'true',
  }
}

export interface NRSTelegramConfig {
  botToken: string
  webhookSecret: string
  /** Must be deliberately set after token rotation and production acceptance. */
  enabled: boolean
}

type NRSTelegramEnv = Record<string, string | undefined>

/**
 * Telegram identities are paired to NRS identities in the database with a
 * short-lived one-time code. They are intentionally not configured as a
 * hard-coded bot owner: that would make one ambient Telegram identity an
 * implicit passport to every project.
 */
export function getNRSTelegramConfig(env: NRSTelegramEnv = process.env): NRSTelegramConfig | null {
  // Never inherit a product bot such as Downscale's. The central NRS control
  // channel has its own Telegram identity, credentials and webhook secret.
  const botToken = env.NRS_TELEGRAM_BOT_TOKEN
  const webhookSecret = env.NRS_TELEGRAM_WEBHOOK_SECRET_TOKEN

  if (!botToken || !webhookSecret) {
    return null
  }

  return {
    botToken,
    webhookSecret,
    enabled: env.NRS_TELEGRAM_CHANNEL_ENABLED === 'true',
  }
}

export const TELEGRAM_CHANNEL_STATUS = 'disabled_pending_scoped_channel_migration' as const

/**
 * Telegram remains fail-closed until verified channel pairing and project
 * grants are backed by the scoped-access migration.
 */
export function telegramChannelCanProcessMarketing(): false {
  return false
}

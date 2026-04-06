export interface NotificationPreferences {
  notify_post_published: boolean
  notify_post_failed: boolean
}

const DEFAULTS: NotificationPreferences = {
  notify_post_published: true,
  notify_post_failed: true,
}

/**
 * Parse notification preferences from the user's work_context field.
 * Preferences are stored in the ---GLOBAL_DIGEST--- JSON block
 * (same block as the daily digest settings).
 */
export function parseNotificationPreferences(
  workContext: string | null | undefined
): NotificationPreferences {
  if (!workContext) return DEFAULTS
  try {
    const match = workContext.match(/---GLOBAL_DIGEST---\n([\s\S]+)$/)
    if (match) {
      const parsed = JSON.parse(match[1])
      return {
        notify_post_published: parsed.notify_post_published ?? DEFAULTS.notify_post_published,
        notify_post_failed: parsed.notify_post_failed ?? DEFAULTS.notify_post_failed,
      }
    }
  } catch {
    /* ignore parse errors */
  }
  return DEFAULTS
}

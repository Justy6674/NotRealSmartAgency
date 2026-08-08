/**
 * Is the Telegram channel actually working?
 *
 * Built for the same reason as the video probe: the owner reports something
 * broken, and from a terminal there is no way to tell whether the bot is even
 * receiving messages. The token lives only in the deployment, so every answer
 * about Telegram so far has been inference — and inference has been wrong
 * repeatedly today.
 *
 * This asks Telegram directly. It reports which bot the deployment is holding,
 * whether a webhook is registered and healthy, whether the update types NRS
 * depends on are subscribed, and whether the typing indicator can actually be
 * sent. Read-only apart from the typing action, which is invisible and expires
 * in five seconds.
 *
 * Guarded by the cron secret. A probe, not a page.
 */

import { NextResponse } from 'next/server'
import { getNRSTelegramConfig } from '@/lib/telegram/nrs-telegram-config'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

interface Check {
  ok: boolean
  detail: string
}

/**
 * Updates NRS cannot work without.
 *
 * An empty `allowed_updates` means Telegram sends the default set — which
 * EXCLUDES message reactions. So emoji reactions would silently never arrive,
 * and the absence looks identical to nobody having reacted.
 */
const NEEDED_UPDATES = ['message', 'my_chat_member', 'message_reaction']

export async function GET(request: Request) {
  if (request.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  const config = getNRSTelegramConfig()
  if (!config) {
    return NextResponse.json({
      ok: false,
      checks: { config: { ok: false, detail: 'NRS_TELEGRAM_BOT_TOKEN or webhook secret is not set' } },
    }, { status: 503 })
  }

  const api = (method: string, body?: unknown) =>
    fetch(`https://api.telegram.org/bot${config.botToken}/${method}`, {
      method: body ? 'POST' : 'GET',
      ...(body ? { headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) } : {}),
    }).then((response) => response.json() as Promise<{ ok: boolean; result?: unknown; description?: string }>)

  const checks: Record<string, Check> = {}

  checks.enabled = {
    ok: config.enabled,
    detail: config.enabled ? 'channel enabled' : 'NRS_TELEGRAM_CHANNEL_ENABLED is not "true"',
  }

  // Which bot is this deployment actually holding? Two projects have shared a
  // token before, and the symptom is silence rather than an error.
  const me = await api('getMe').catch(() => null)
  const bot = me?.result as { username?: string; id?: number } | undefined
  checks.identity = {
    ok: Boolean(me?.ok && bot?.username),
    detail: bot?.username ? `@${bot.username} (id ${bot.id})` : `getMe failed: ${me?.description ?? 'no response'}`,
  }

  const info = await api('getWebhookInfo').catch(() => null)
  const hook = info?.result as {
    url?: string
    pending_update_count?: number
    last_error_message?: string
    last_error_date?: number
    allowed_updates?: string[]
  } | undefined

  checks.webhook = {
    ok: Boolean(hook?.url),
    detail: hook?.url
      ? `registered → ${hook.url}`
      : 'NO WEBHOOK REGISTERED — the bot receives nothing, and every message is silently dropped',
  }

  checks.webhookHealth = {
    // A backlog means Telegram is delivering and the app is not answering.
    ok: !hook?.last_error_message && (hook?.pending_update_count ?? 0) < 5,
    detail: hook?.last_error_message
      ? `last error: ${hook.last_error_message}`
      : `${hook?.pending_update_count ?? 0} pending update(s)`,
  }

  const allowed = hook?.allowed_updates ?? []
  const missing = allowed.length === 0
    // Default set: everything except reactions and a few others.
    ? ['message_reaction']
    : NEEDED_UPDATES.filter((type) => !allowed.includes(type))
  checks.updateTypes = {
    ok: missing.length === 0,
    detail: missing.length === 0
      ? `subscribed: ${allowed.join(', ')}`
      : `NOT subscribed to: ${missing.join(', ')} — those updates never arrive`
        + (allowed.length === 0 ? ' (allowed_updates is empty, so Telegram sends its default set)' : ''),
  }

  // Can the dots actually be sent? Needs a chat, so this only runs when one is
  // supplied — a probe must not need a human to have messaged first.
  const chatId = new URL(request.url).searchParams.get('chat_id')
  if (chatId) {
    const typing = await api('sendChatAction', { chat_id: chatId, action: 'typing' }).catch(() => null)
    checks.typing = {
      ok: Boolean(typing?.ok),
      detail: typing?.ok ? 'typing indicator sent' : `failed: ${typing?.description ?? 'no response'}`,
    }
  }

  const ok = Object.values(checks).every((check) => check.ok)
  return NextResponse.json({ ok, checks }, { status: ok ? 200 : 503 })
}

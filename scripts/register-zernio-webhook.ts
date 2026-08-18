/**
 * Register — or bring up to date — the webhook subscription the desk listens on.
 *
 * Run: `npx tsx scripts/register-zernio-webhook.ts`
 * It reads `.env.local`, so it talks to the LIVE account. It is idempotent:
 * an existing subscription on the same URL is updated in place rather than
 * duplicated, because two subscriptions on one URL means every event arrives
 * twice and the dedupe table absorbs the difference silently.
 *
 * Pairs with `src/app/api/webhooks/zernio/route.ts`, which handles what arrives.
 *
 * ── Why the event list grew ────────────────────────────────────────────
 * Seven of forty-seven available events were subscribed. The nine added here
 * are the ones the desk cannot work without:
 *
 *   post.scheduled / post.cancelled          the activity thread's own history
 *   post.platform.published / .failed        per-network outcome, not just the
 *                                            whole-post verdict
 *   post.platform.deleted                    a PUBLISHED post has vanished from
 *                                            the platform — for a business
 *                                            advertising regulated health
 *                                            services, somebody has to see that
 *   post.external.created / .updated         history published outside this app
 *   review.new                               a review needs an answer
 *   conversation.started                     so does a first message
 *
 * Nothing here subscribes to the WhatsApp, telephony or ads families. They are
 * out of product scope and every one of them is noise on this endpoint.
 */

import { config } from 'dotenv'
import Zernio from '@zernio/node'

config({ path: '.env.local' })

const WEBHOOK_NAME = 'NRS desk'
const WEBHOOK_URL = 'https://www.notrealsmart.com.au/api/webhooks/zernio'

/**
 * Every event this app has a handler for. Adding one here without a branch in
 * the route means a delivery that is recorded and then ignored — which reads,
 * from the outside, exactly like a bug in the publisher.
 */
const EVENTS = [
  // Publishing
  'post.scheduled',
  'post.published',
  'post.failed',
  'post.partial',
  'post.cancelled',
  'post.platform.published',
  'post.platform.failed',
  'post.platform.deleted',
  'post.external.created',
  'post.external.updated',
  // Accounts
  'account.connected',
  'account.disconnected',
  // Engagement
  'message.received',
  'comment.received',
  'conversation.started',
  'review.new',
] as const

async function main() {
  const apiKey = process.env.ZERNIO_API_KEY
  if (!apiKey) throw new Error('Missing ZERNIO_API_KEY in .env.local')

  const zernio = new Zernio({ apiKey })

  const existing = await zernio.webhooks.getWebhookSettings()
  if (existing.error) {
    throw new Error(`Could not read the current subscriptions: ${JSON.stringify(existing.error)}`)
  }

  const webhooks = (existing.data?.webhooks ?? []) as { _id?: string; url?: string; events?: string[] }[]
  const mine = webhooks.find((hook) => hook.url === WEBHOOK_URL)

  if (mine?._id) {
    const before = mine.events?.length ?? 0
    const result = await zernio.webhooks.updateWebhookSettings({
      body: { _id: mine._id, name: WEBHOOK_NAME, url: WEBHOOK_URL, events: [...EVENTS], isActive: true },
    })
    if (result.error) throw new Error(`Update refused: ${JSON.stringify(result.error)}`)
    console.log(`Updated subscription ${mine._id}: ${before} events → ${EVENTS.length}.`)
    return
  }

  /*
   * The secret is NOT generated here.
   *
   * `ZERNIO_WEBHOOK_SECRET` is what the route verifies signatures against, so
   * inventing one in a script would silently break every delivery: the
   * publisher would sign with a value this deployment has never seen and the
   * route would answer 401 to everything. Set both to the same value, or leave
   * it to the publisher and copy the value it returns into the environment.
   */
  const secret = process.env.ZERNIO_WEBHOOK_SECRET
  const created = await zernio.webhooks.createWebhookSettings({
    body: {
      name: WEBHOOK_NAME,
      url: WEBHOOK_URL,
      events: [...EVENTS],
      isActive: true,
      ...(secret ? { secret } : {}),
    },
  })
  if (created.error) throw new Error(`Create refused: ${JSON.stringify(created.error)}`)
  console.log(`Created subscription with ${EVENTS.length} events.`)
  if (!secret) {
    console.log('No ZERNIO_WEBHOOK_SECRET was set — copy the secret from the response into .env.local, or deliveries will be rejected.')
    console.log(JSON.stringify(created.data, null, 2))
  }
}

main().catch((err: unknown) => {
  console.error('Could not register the webhook:', err instanceof Error ? err.message : err)
  process.exitCode = 1
})

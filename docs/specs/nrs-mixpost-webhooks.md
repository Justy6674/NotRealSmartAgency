---
created: 2026-04-10
tags: [notrealsmart, mixpost, webhooks, reference]
project: NotRealSmart
---

# Mixpost Pro — Webhook Events & Signing

Canonical list of webhook event names emitted by Mixpost Pro (self-hosted on our VPS at `mixpost.notrealsmart.com.au`). The Mixpost docs at `https://docs.mixpost.app/webhooks/create/` do NOT publish the event list — this page is derived from the Pro source inside the Docker container on 2026-04-10:

```
ssh vps
docker exec mixpost-mixpost-1 find /var/www/html/vendor/inovector/mixpost-pro-team/src/Events -name "*.php"
```

## Event names

### Post events
| Event | Fired when |
|---|---|
| `post.created` | New draft or scheduled post created (any source) |
| `post.updated` | Caption, hashtags, media, or metadata edited |
| `post.scheduled` | Existing draft moved to scheduled status |
| `post.published` | Successfully published to one or more social platforms |
| `post.publishing_failed` | Publishing failed. **NOTE: NRS receiver was previously listening for `post.published.failed` which does NOT exist — all failure webhooks were being silently dropped.** Fixed 2026-04-10. |
| `post.deleted` | Post was deleted |

### Account events
| Event | Fired when |
|---|---|
| `account.added` | Social account newly connected to Mixpost |
| `account.updated` | Account metadata refreshed (token rotation, profile change) |
| `account.deleted` | Social account disconnected or token revoked |

### NOT emitted (despite what docs may imply)
- `media.uploaded` — no such event in Pro source
- `media.deleted` — no such event in Pro source
- Any `workspace.*` events — Enterprise tier only (checked — not in Pro)

## Wire format (exact)

Every webhook delivery POSTs this JSON to your callback URL:

```json
{
  "event": "post.published",
  "data": { ...event-specific payload... }
}
```

**Headers sent by Mixpost:**
- `Content-Type: application/json` (default unless overridden in webhook config)
- `X-Request-Source: <mixpost app name>` — informational only
- `X-Signature: <hex>` — HMAC signature, only present if the webhook has a secret configured

## Signature verification — EXACT method

Mixpost uses `hash_hmac('sha256', json_encode($data), $webhook->secret)` in `TriggerWebhook.php`. To verify in Node/TypeScript:

```ts
import crypto from 'node:crypto'

const rawBody = await request.text()                // MUST read raw text first
const received = request.headers.get('x-signature') ?? ''
const expected = crypto
  .createHmac('sha256', process.env.MIXPOST_WEBHOOK_SECRET!)
  .update(rawBody)
  .digest('hex')

// Timing-safe comparison to prevent length/content leaks
const valid = received.length === expected.length &&
  crypto.timingSafeEqual(Buffer.from(received), Buffer.from(expected))
```

**Critical:** you MUST read the raw body as text before parsing JSON — any re-serialisation will produce different bytes and the signature will mismatch. In Next.js App Router route handlers, call `await request.text()` then `JSON.parse(...)` yourself.

## Where NRS handles these

- Receiver: `src/app/api/webhooks/mixpost/route.ts`
- Setup guide: `~/Obsidian/Reference/nrs-mixpost-webhook-setup.md`

## Reference — dispatcher source

`/var/www/html/vendor/inovector/mixpost-pro-team/src/Actions/Webhook/TriggerWebhook.php` on the VPS — inspect it directly if Mixpost Pro ships a new version and adds events. The event name registry is at `src/Events/Post/*.php` and `src/Events/Account/*.php` — each class has a `public static function name(): string` returning the wire name.

---
**Related entity:** [[Reference/wiki/entities/notrealsmart|notrealsmart]]

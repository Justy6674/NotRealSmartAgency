---
created: 2026-04-10
tags: [notrealsmart, mixpost, webhooks, setup, reference]
project: NotRealSmart
---

# Mixpost Webhook Setup — One-off Admin Steps

NRS doesn't programmatically register webhooks (we're single-tenant, it's not worth the complexity). Set this up once in the Mixpost admin UI, then the NRS receiver at `/api/webhooks/mixpost` handles everything.

## 1. Create the webhook in Mixpost

1. Log into `https://mixpost.notrealsmart.com.au/mixpost`
2. Select the NRS workspace
3. Navigate to **Settings → Webhooks → Create webhook**
4. Fill in:
   - **URL**: `https://www.notrealsmart.com.au/api/webhooks/mixpost`
   - **Method**: `POST`
   - **Content type**: `application/json`
   - **Events** — tick ALL of:
     - `post.created`
     - `post.updated`
     - `post.scheduled`
     - `post.published`
     - `post.publishing_failed`
     - `post.deleted`
     - `account.added`
     - `account.updated`
     - `account.deleted`
5. **Secret** — Mixpost will generate one. Copy it.

## 2. Store the secret

Add to Vercel production env:
```
MIXPOST_WEBHOOK_SECRET=<the secret from step 1>
```

Also paste into local `.env.local` so dev webhook tests work if you ever tunnel them with ngrok or similar.

## 3. Smoke test

From Mixpost admin UI → Webhook → "Send test payload" button. Check:

```bash
# On local machine — tail Vercel logs
vercel logs nrs-agency --follow | grep mixpost
```

Expected: `[mixpost-webhook] received event=post.published ...` with 200 response.

Failure modes to watch for:
- `403 Invalid signature` — secret not matching. Double-check both Vercel and Mixpost have the same string, no trailing whitespace.
- `404 Not Found` — URL typo. Must be exactly `/api/webhooks/mixpost` (not `/api/mixpost/webhook`).
- No delivery at all — check Mixpost's Webhook Deliveries log in the admin UI for outbound errors (expired SSL certs, DNS, etc.).

## 4. End-to-end verification

1. Create a draft in NRS Creator → submit → sync runs → draft appears in Mixpost within 30s.
2. Schedule the draft from inside the Mixpost iframe (in the NRS Review pane).
3. Within 5s, NRS `scheduled_posts.status` flips from `draft` to `scheduled` automatically — no polling, driven entirely by the `post.scheduled` webhook.
4. When Mixpost publishes, email notification fires via Resend (`buildPostPublishedEmail`), status becomes `published`.
5. If publishing fails (token expired, rate limit, platform down), status becomes `failed` and the error lands in `scheduled_posts.error`.

## Reference

- Event catalogue + HMAC signing format: `~/Obsidian/Reference/nrs-mixpost-webhooks.md`
- Receiver source: `src/app/api/webhooks/mixpost/route.ts`
- Dispatcher source (on VPS): `/var/www/html/vendor/inovector/mixpost-pro-team/src/Actions/Webhook/TriggerWebhook.php`

---
**Related entity:** [[Reference/wiki/entities/notrealsmart|notrealsmart]]

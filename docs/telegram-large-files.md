# Sending real video through the Telegram bot

## The problem

No file had ever arrived through the NRS Telegram bot. Not one, ever — checked
against production: zero `media_items` rows with `metadata.source = 'telegram'`,
while text messages went through fine.

It was never an NRS bug. **Telegram's cloud Bot API refuses to serve a bot any
file over 20 MB.** A phone video is 200 MB or more, so every real clip was
rejected by Telegram before a line of NRS code ran.

That limit cannot be worked around in a request, retried, or negotiated. The
only supported way past it is to run Telegram's Bot API server yourself, which
serves files up to 2 GB.

- Cloud limit: <https://core.telegram.org/bots/api#getfile>
- Self-hosted server: <https://github.com/tdlib/telegram-bot-api>

## What NRS already does

`TELEGRAM_API_BASE` controls where the Bot API lives. Unset, it uses Telegram's
cloud and enforces the 20 MB ceiling. Set it to a self-hosted server and the
ceiling becomes 2 GB automatically — `telegramFileLimitBytes()` follows it.

Until it is set, an oversized video gets a straight answer instead of silence:
that Telegram refuses files over 20 MB, and to upload on the web instead.

## Deploying the server

The VPS already runs Docker for Mixpost, so this is another service beside it.

### 1. Get API credentials — only Justin can do this

Sign in at <https://my.telegram.org/apps> with the phone number on the account
and create an application. It returns an `api_id` and an `api_hash`. These
identify the *application*, not the bot, and cannot be issued by anyone else —
this step needs Justin.

### 2. Run the server

Add to `/opt/mixpost/docker-compose.yml`:

```yaml
  telegram-bot-api:
    image: aiogram/telegram-bot-api:latest
    restart: unless-stopped
    environment:
      TELEGRAM_API_ID: "<api_id>"
      TELEGRAM_API_HASH: "<api_hash>"
      # NOT --local: local mode returns a filesystem path, which is useless to
      # NRS on Vercel. Without it the server serves files over HTTP the same way
      # the cloud API does, just without the 20 MB cap.
    volumes:
      - telegram-bot-api-data:/var/lib/telegram-bot-api
    ports:
      - "127.0.0.1:8081:8081"
```

Then `docker compose up -d telegram-bot-api`.

### 3. Put it behind HTTPS

Add an nginx server block on the VPS for `tg.notrealsmart.com.au` proxying to
`127.0.0.1:8081`, with a Let's Encrypt certificate — same pattern as the Mixpost
host. Set `client_max_body_size 2000m;` so large files are not truncated at the
proxy.

### 4. Point NRS at it

```
TELEGRAM_API_BASE=https://tg.notrealsmart.com.au
```

in Vercel production, then redeploy.

### 5. Re-register the webhook

A self-hosted server keeps its own webhook registration, so the webhook must be
set again against the new server:

```bash
curl -F "url=https://www.notrealsmart.com.au/api/webhooks/telegram" \
     -F "secret_token=$NRS_TELEGRAM_WEBHOOK_SECRET_TOKEN" \
     https://tg.notrealsmart.com.au/bot$NRS_TELEGRAM_BOT_TOKEN/setWebhook
```

### 6. Confirm

Send a real video to the bot. It should land in the library with
`metadata.source = 'telegram'`, get transcribed, and come back as drafts. The
check that matters:

```sql
select id, file_name, file_size_bytes, transcription_status
from media_items
where metadata->>'source' = 'telegram'
order by created_at desc;
```

Before this change that query returns nothing, however many videos have been
sent.

## Alternative if the server is not wanted

The Telegram Mini App (`/api/telegram/mini-app/*`) uploads through the browser
rather than the bot, so it is not bound by the 20 MB limit. It costs a tap to
open the app instead of sending a file straight into the chat.

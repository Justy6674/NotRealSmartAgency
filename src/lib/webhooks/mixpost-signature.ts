import crypto from 'node:crypto'

export type MixpostWebhookSignatureResult =
  | { ok: true }
  | { ok: false; reason: 'missing-secret' | 'missing-signature' | 'invalid-signature' }

interface MixpostWebhookSignatureOptions {
  secret?: string
  environment?: string
}

/**
 * Verify Mixpost's HMAC SHA-256 signature over the raw request body.
 *
 * Local development and tests may deliberately omit the secret so a developer
 * can exercise the route without a tunnel. Every deployed environment must
 * provide the secret: accepting an unsigned event there would let an attacker
 * mutate publishing state or trigger notifications.
 */
export function verifyMixpostWebhookSignature(
  rawBody: string,
  header: string | null,
  options: MixpostWebhookSignatureOptions = {},
): MixpostWebhookSignatureResult {
  const secret = options.secret ?? process.env.MIXPOST_WEBHOOK_SECRET
  const environment = options.environment ?? process.env.NODE_ENV

  if (!secret) {
    return environment === 'development' || environment === 'test'
      ? { ok: true }
      : { ok: false, reason: 'missing-secret' }
  }

  if (!header) return { ok: false, reason: 'missing-signature' }

  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex')
  if (header.length !== expected.length) return { ok: false, reason: 'invalid-signature' }

  try {
    return crypto.timingSafeEqual(
      Buffer.from(header, 'utf8'),
      Buffer.from(expected, 'utf8'),
    )
      ? { ok: true }
      : { ok: false, reason: 'invalid-signature' }
  } catch {
    return { ok: false, reason: 'invalid-signature' }
  }
}

import crypto from 'crypto'

export type WebhookVerifyResult =
  | { ok: true }
  | { ok: false; status: 401 | 503 }

/**
 * Fail-closed HMAC for Zernio webhooks.
 *
 * Official Node snippet uses 401 for a missing header and 400 for a mismatch.
 * NRS policy (D25): secret set + missing/wrong → 401; secret missing after
 * fail-closed → 503, no writes. Always hash the raw body — parsed JSON cannot
 * verify. (per ~/Obsidian/Reference/nrs-zernio-webhooks)
 */
export function verifyZernioWebhook(opts: {
  secret: string | undefined
  signature: string | null
  rawBody: string
}): WebhookVerifyResult {
  const secret = opts.secret?.trim() ?? ''
  if (secret === '') {
    return { ok: false, status: 503 }
  }

  const signature = (opts.signature ?? '').trim().toLowerCase()
  if (signature === '') {
    return { ok: false, status: 401 }
  }

  const expected = crypto.createHmac('sha256', secret).update(opts.rawBody).digest('hex')
  const expectedBuf = Buffer.from(expected, 'utf8')
  const givenBuf = Buffer.from(signature, 'utf8')
  if (expectedBuf.length !== givenBuf.length || !crypto.timingSafeEqual(expectedBuf, givenBuf)) {
    return { ok: false, status: 401 }
  }

  return { ok: true }
}

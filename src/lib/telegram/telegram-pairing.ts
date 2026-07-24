import { createHash, randomBytes } from 'node:crypto'

/** 192-bit code, rendered as lowercase hex for reliable Telegram deep links. */
export function newTelegramPairCode(
  random: (size: number) => Buffer = randomBytes,
): string {
  return random(24).toString('hex')
}

/** Store this only; the raw code is returned once to the authenticated owner. */
export function hashTelegramPairCode(code: string): string {
  return createHash('sha256').update(code, 'utf8').digest('hex')
}

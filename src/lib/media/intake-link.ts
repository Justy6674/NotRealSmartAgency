import { createHash, randomBytes, randomUUID } from 'node:crypto'

import { sanitizeIntakeFileName } from '@/lib/media/intake-validation'

export {
  MAX_MEDIA_INTAKE_BYTES,
  sanitizeIntakeFileName,
  isAllowedIntakeMime,
  validateIntakeFile,
  type IntakeFileDetails,
} from '@/lib/media/intake-validation'

const MEDIA_INTAKE_TOKEN_PREFIX = 'nrs_drop_'

/**
 * A distinct credential family for the public media drop. It is deliberately
 * not an MCP or Supabase credential and can only authorise one brand-locked
 * signed upload URL at a time.
 */
export function createMediaIntakeToken(): string {
  return `${MEDIA_INTAKE_TOKEN_PREFIX}${randomBytes(32).toString('base64url')}`
}

/** Store this value, never the raw capability URL/token. */
export function hashMediaIntakeToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

export function isValidMediaIntakeToken(token: string): boolean {
  return new RegExp(`^${MEDIA_INTAKE_TOKEN_PREFIX}[A-Za-z0-9_-]{43}$`).test(token)
}

export function intakeStoragePrefix(input: { ownerUserId: string; brandId: string; linkId: string }): string {
  return `${input.ownerUserId}/${input.brandId}/drop/${input.linkId}/`
}

export function buildIntakeStoragePath(input: {
  ownerUserId: string
  brandId: string
  linkId: string
  fileName: string
}): string {
  return `${intakeStoragePrefix(input)}${randomUUID()}_${sanitizeIntakeFileName(input.fileName)}`
}

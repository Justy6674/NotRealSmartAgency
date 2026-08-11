import { createHash, randomBytes, randomUUID } from 'node:crypto'

/** Browser-uploaded bytes go directly to Supabase; this is NRS's product ceiling. */
export const MAX_MEDIA_INTAKE_BYTES = 500 * 1024 * 1024

const MEDIA_INTAKE_TOKEN_PREFIX = 'nrs_drop_'
const ALLOWED_MEDIA_PREFIXES = ['image/', 'video/', 'audio/'] as const

export interface IntakeFileDetails {
  fileName: string
  fileType: string
  fileSize: number
}

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

export function isAllowedIntakeMime(fileType: string): boolean {
  const normalised = fileType.trim().toLowerCase()
  return ALLOWED_MEDIA_PREFIXES.some((prefix) => normalised.startsWith(prefix))
}

export function sanitizeIntakeFileName(fileName: string): string {
  const cleaned = fileName.trim().replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 160)
  return cleaned || 'upload'
}

export function validateIntakeFile({ fileName, fileType, fileSize }: IntakeFileDetails): string | null {
  if (!fileName.trim() || !fileType.trim()) return 'A file name and media type are required.'
  if (!isAllowedIntakeMime(fileType)) return 'Upload an image, video, or audio file.'
  if (!Number.isFinite(fileSize) || fileSize <= 0) return 'The file must not be empty.'
  if (fileSize > MAX_MEDIA_INTAKE_BYTES) return 'That file is over the 500 MB limit.'
  return null
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

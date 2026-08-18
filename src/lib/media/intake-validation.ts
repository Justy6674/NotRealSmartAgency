/** Browser-uploaded bytes go directly to Supabase; this is NRS's product ceiling. */
export const MAX_MEDIA_INTAKE_BYTES = 500 * 1024 * 1024

const ALLOWED_MEDIA_PREFIXES = ['image/', 'video/', 'audio/'] as const

export interface IntakeFileDetails {
  fileName: string
  fileType: string
  fileSize: number
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

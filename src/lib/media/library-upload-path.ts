import { randomUUID } from 'node:crypto'
import { sanitizeIntakeFileName } from '@/lib/media/intake-validation'

/** Prefix every browser library upload must live under for this user + brand. */
export function libraryUploadPrefix(userId: string, brandId: string): string {
  return `${userId}/${brandId}/`
}

export function buildLibraryUploadStoragePath(input: {
  userId: string
  brandId: string
  fileName: string
  uploadId?: string
}): string {
  const uploadId = input.uploadId ?? randomUUID()
  const timestamp = Date.now()
  const safeName = sanitizeIntakeFileName(input.fileName)
  return `${libraryUploadPrefix(input.userId, input.brandId)}${uploadId}_${timestamp}_${safeName}`
}

/**
 * Owner-facing file size. A 67-byte probe PNG was labelled "0KB" because
 * `if (!bytes)` treated small values as missing and integer KB rounded them
 * away. Quarantine is decode-failed (D29), not a byte cutoff — so a valid
 * tiny asset must still show its exact size.
 */
export function formatFileSize(bytes: number | null | undefined): string {
  if (bytes == null) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

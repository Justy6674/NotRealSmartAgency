/** Custom event — focus the on-page media drop zone or open the file picker. */
export const NRS_MEDIA_UPLOAD_FOCUS = 'nrs:media-upload-focus'

export type MediaUploadFocusMode = 'dropzone' | 'picker'

export interface MediaUploadFocusDetail {
  mode: MediaUploadFocusMode
}

export function requestMediaUploadFocus(mode: MediaUploadFocusMode = 'dropzone'): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(
    new CustomEvent<MediaUploadFocusDetail>(NRS_MEDIA_UPLOAD_FOCUS, { detail: { mode } }),
  )
}

/** Owner phrases in chat that should surface the upload control, not send them hunting. */
export function messageRequestsMediaUploadFocus(text: string): MediaUploadFocusMode | null {
  const normalised = text.trim().toLowerCase()
  if (!normalised) return null
  if (/\bopen\s+media\b/.test(normalised)) return 'dropzone'
  if (/\b(upload|add|attach)\s+(a\s+)?(video|photo|image|media|file|clip)\b/.test(normalised)) {
    return 'picker'
  }
  if (/\b(upload|open)\s+media\b/.test(normalised)) return 'picker'
  return null
}

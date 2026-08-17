/**
 * What a list tile should load. Quarantine is decode-failed (D29), not a
 * byte cutoff — this helper only chooses the URL. Never hand a video file
 * to <img> or <video src=full.mov preload=metadata>; that is the grey-box
 * bug on phone clips.
 */
export function mediaTileUrl(item: {
  file_type?: string | null
  file_url?: string | null
  thumbnail_url?: string | null
}): string | null {
  if (item.thumbnail_url) return item.thumbnail_url
  if ((item.file_type ?? '').startsWith('image/') && item.file_url) return item.file_url
  return null
}

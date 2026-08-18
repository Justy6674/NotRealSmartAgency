/**
 * Handing the publisher a file, and describing it properly once it has one.
 *
 * Depended on by: the media library and upload queue (S5), and the composer's
 * attachment strip (S3).
 *
 * ── What is ours and what is theirs ────────────────────────────────────
 * The media library stays NRS's. Zernio has no `GET /v1/media` — no list, no
 * browse, no delete — so there is nothing to migrate to and nothing to lose by
 * keeping ours. What is used here is only the last step: giving the publisher a
 * URL it can fetch at publish time, and (rarely) pushing a small file straight
 * at it.
 *
 * ── The field that was being dropped ───────────────────────────────────
 * `toZernioMediaItem` is the reason this file exists at all. NRS captured alt
 * text in an `AltTextDialog`, stored it, showed it back — and never sent it.
 * Same for video covers and Instagram Reel covers. A media item built here
 * carries all three to the wire.
 */

import { getZernioClient } from './client'
import { unwrapZernio, ZernioError } from './errors'
import {
  ZERNIO_MEDIA_CONTENT_TYPES,
  type ZernioMediaContentType,
  type ZernioMediaItem,
} from './types'

/** `uploadMediaDirect` refuses anything larger. Presign for the rest. */
export const ZERNIO_DIRECT_UPLOAD_MAX_BYTES = 25 * 1024 * 1024

export function isZernioMediaContentType(value: unknown): value is ZernioMediaContentType {
  return typeof value === 'string'
    && (ZERNIO_MEDIA_CONTENT_TYPES as readonly string[]).includes(value)
}

const CONTENT_TYPE_BY_EXTENSION: Record<string, ZernioMediaContentType> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
  mp4: 'video/mp4',
  m4v: 'video/x-m4v',
  mov: 'video/quicktime',
  webm: 'video/webm',
  avi: 'video/x-msvideo',
  mpeg: 'video/mpeg',
  mpg: 'video/mpeg',
  pdf: 'application/pdf',
  mp3: 'audio/mpeg',
  m4a: 'audio/x-m4a',
  aac: 'audio/aac',
  ogg: 'audio/ogg',
  wav: 'audio/wav',
}

/**
 * A browser mime or a filename → one of the twenty values the API accepts.
 *
 * The enum is closed: `image/jpg` is on it and `image/heic` is not, so passing
 * a phone's own mime straight through is a 400 at the moment of upload. Returns
 * null rather than a guess, and the caller says so in plain words.
 */
export function zernioContentTypeOf(input: {
  mimeType?: string | null
  filename?: string | null
}): ZernioMediaContentType | null {
  const mime = input.mimeType?.trim().toLowerCase()
  if (mime && isZernioMediaContentType(mime)) return mime

  const name = input.filename?.trim().toLowerCase() ?? ''
  const extension = name.includes('.') ? name.split('.').pop() ?? '' : ''
  return CONTENT_TYPE_BY_EXTENSION[extension] ?? null
}

export interface ZernioPresignedUpload {
  /** PUT the bytes here. Valid for one hour. */
  uploadUrl: string
  /** Where the file will live afterwards — this is what a post references. */
  publicUrl: string
  key: string
}

/**
 * Ask for somewhere to put a file.
 *
 * Size is pre-validated upstream against a 5 GB ceiling, so sending it turns a
 * failed 4 GB upload into an immediate, cheap refusal.
 */
export async function createZernioUpload(params: {
  filename: string
  contentType: ZernioMediaContentType
  size?: number
}): Promise<ZernioPresignedUpload> {
  const zernio = getZernioClient('media.getMediaPresignedUrl')
  const result = await zernio.media.getMediaPresignedUrl({
    body: {
      filename: params.filename,
      contentType: params.contentType,
      ...(params.size ? { size: params.size } : {}),
    },
  })
  const data = unwrapZernio<Record<string, unknown>>('media.getMediaPresignedUrl', result as never)

  const uploadUrl = typeof data.uploadUrl === 'string' ? data.uploadUrl : ''
  const publicUrl = typeof data.publicUrl === 'string' ? data.publicUrl : ''
  if (!uploadUrl || !publicUrl) {
    throw new ZernioError(
      'media.getMediaPresignedUrl',
      'The publisher did not return anywhere to put the file.',
    )
  }
  return { uploadUrl, publicUrl, key: typeof data.key === 'string' ? data.key : '' }
}

/**
 * Push a small file straight at the publisher.
 *
 * Filed under `messages` in the SDK despite being general media — that is the
 * vendor's filing, not a hint about what it is for. Hard 25 MB ceiling, checked
 * here so a 40 MB video fails in a sentence rather than after a long upload.
 */
export async function uploadZernioMediaDirect(params: {
  file: Blob
  contentType?: string
}): Promise<string> {
  if (params.file.size > ZERNIO_DIRECT_UPLOAD_MAX_BYTES) {
    throw new ZernioError(
      'messages.uploadMediaDirect',
      'That file is too big to send this way. Files over 25 MB have to be uploaded first.',
    )
  }
  const zernio = getZernioClient('messages.uploadMediaDirect')
  const result = await zernio.messages.uploadMediaDirect({
    body: {
      file: params.file,
      ...(params.contentType ? { contentType: params.contentType } : {}),
    },
  })
  const data = unwrapZernio<Record<string, unknown>>('messages.uploadMediaDirect', result as never)
  const url = data.url ?? data.publicUrl ?? (data.media as Record<string, unknown> | undefined)?.url
  if (typeof url !== 'string' || !url) {
    throw new ZernioError('messages.uploadMediaDirect', 'The file uploaded but came back without a link.')
  }
  return url
}

/**
 * Build the media item a post carries — alt text and covers included.
 *
 * `type` is worked out from the path, never from the whole URL: a Supabase
 * signed URL is `clip.mp4?token=…`, and typing on the full string made every
 * real video an image, which the publisher then refused after the caption had
 * already been written.
 */
export function toZernioMediaItem(input: {
  url: string
  altText?: string | null
  /** Cover for Facebook and LinkedIn video. */
  thumbnail?: string | null
  /** Cover for an Instagram Reel. Wins over the platform-data equivalents. */
  instagramThumbnail?: string | null
  title?: string | null
  filename?: string | null
  mimeType?: string | null
  size?: number | null
}): ZernioMediaItem {
  let path = input.url
  try {
    path = new URL(input.url).pathname
  } catch {
    path = input.url.split('?')[0]?.split('#')[0] ?? input.url
  }
  const lower = path.toLowerCase()
  const type: ZernioMediaItem['type'] = lower.endsWith('.mp4') || lower.endsWith('.mov')
    || lower.endsWith('.webm') || lower.endsWith('.m4v')
    ? 'video'
    : lower.endsWith('.gif')
      ? 'gif'
      : lower.endsWith('.pdf')
        ? 'document'
        : 'image'

  const trimmed = (value: string | null | undefined) => {
    const out = value?.trim()
    return out ? out : undefined
  }

  return {
    url: input.url,
    type,
    ...(trimmed(input.altText) ? { altText: trimmed(input.altText)! } : {}),
    ...(trimmed(input.thumbnail) ? { thumbnail: trimmed(input.thumbnail)! } : {}),
    ...(trimmed(input.instagramThumbnail)
      ? { instagramThumbnail: trimmed(input.instagramThumbnail)! }
      : {}),
    ...(trimmed(input.title) ? { title: trimmed(input.title)! } : {}),
    ...(trimmed(input.filename) ? { filename: trimmed(input.filename)! } : {}),
    ...(trimmed(input.mimeType) ? { mimeType: trimmed(input.mimeType)! } : {}),
    ...(typeof input.size === 'number' && input.size > 0 ? { size: input.size } : {}),
  }
}

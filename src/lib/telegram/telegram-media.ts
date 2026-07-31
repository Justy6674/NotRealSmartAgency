import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Take a video or photo sent to the bot and put it in the media library.
 *
 * The owner films things between patients on a phone. The bot ignored any
 * message that was not text, so a video sent to it simply vanished — no error,
 * no file, nothing — and the only way to get footage into the agency was to
 * open a laptop and use the web uploader.
 *
 * Telegram hands over a file id, not the bytes. The file has to be looked up,
 * fetched, and stored before anything can be done with it.
 */

/** What Telegram gives us, whichever kind of attachment it is. */
export interface TelegramAttachment {
  fileId: string
  /** Telegram's own byte count, when it bothers to send one. */
  fileSize?: number
  kind: 'video' | 'photo' | 'audio' | 'document'
  /** Caption typed alongside the file, which is usually the instruction. */
  caption?: string
  mimeType?: string
}

/**
 * Pull an attachment off a Telegram message.
 *
 * Photos arrive as an array of sizes, smallest first; the last is the largest
 * and the only one worth keeping.
 */
export function readAttachment(message: Record<string, unknown>): TelegramAttachment | null {
  const caption = typeof message.caption === 'string' ? message.caption : undefined

  const video = message.video as Record<string, unknown> | undefined
  if (video?.file_id) {
    return {
      fileId: String(video.file_id),
      fileSize: typeof video.file_size === 'number' ? video.file_size : undefined,
      kind: 'video',
      mimeType: typeof video.mime_type === 'string' ? video.mime_type : 'video/mp4',
      caption,
    }
  }

  // A video sent as a file rather than as media arrives as a document.
  const doc = message.document as Record<string, unknown> | undefined
  if (doc?.file_id) {
    const mime = typeof doc.mime_type === 'string' ? doc.mime_type : 'application/octet-stream'
    return {
      fileId: String(doc.file_id),
      fileSize: typeof doc.file_size === 'number' ? doc.file_size : undefined,
      kind: mime.startsWith('video/') ? 'video' : mime.startsWith('image/') ? 'photo' : 'document',
      mimeType: mime,
      caption,
    }
  }

  const audio = (message.audio ?? message.voice) as Record<string, unknown> | undefined
  if (audio?.file_id) {
    return {
      fileId: String(audio.file_id),
      fileSize: typeof audio.file_size === 'number' ? audio.file_size : undefined,
      kind: 'audio',
      mimeType: typeof audio.mime_type === 'string' ? audio.mime_type : 'audio/ogg',
      caption,
    }
  }

  const photos = message.photo as Array<Record<string, unknown>> | undefined
  if (Array.isArray(photos) && photos.length) {
    const largest = photos[photos.length - 1]
    return {
      fileId: String(largest.file_id),
      fileSize: typeof largest.file_size === 'number' ? largest.file_size : undefined,
      kind: 'photo',
      mimeType: 'image/jpeg',
      caption,
    }
  }

  return null
}

/** Telegram's bot API will not serve a file larger than this. */
export const TELEGRAM_FILE_LIMIT_BYTES = 20 * 1024 * 1024

export interface StoredMedia {
  mediaItemId: string
  fileUrl: string
  bytes: number
}

/**
 * Fetch the file from Telegram and store it against the project.
 *
 * Returns null with a reason the owner can act on rather than throwing — a
 * file that is too big is a normal thing to be told, not an error.
 */
export async function storeTelegramMedia({
  supabase,
  botToken,
  userId,
  brandId,
  attachment,
}: {
  supabase: SupabaseClient
  botToken: string
  userId: string
  brandId: string
  attachment: TelegramAttachment
}): Promise<{ media: StoredMedia } | { error: string }> {
  if (attachment.fileSize && attachment.fileSize > TELEGRAM_FILE_LIMIT_BYTES) {
    return {
      error: `That file is ${Math.round(attachment.fileSize / 1024 / 1024)} MB. Telegram only lets a bot fetch files up to 20 MB — send a shorter clip, or upload it on the web.`,
    }
  }

  const lookup = await fetch(`https://api.telegram.org/bot${botToken}/getFile?file_id=${attachment.fileId}`)
  if (!lookup.ok) return { error: 'That file could not be read from Telegram. Try sending it again.' }

  const info = (await lookup.json()) as { ok?: boolean; result?: { file_path?: string } }
  const remotePath = info.result?.file_path
  if (!info.ok || !remotePath) {
    return { error: 'Telegram would not hand over that file. It may be too large for a bot to fetch.' }
  }

  const download = await fetch(`https://api.telegram.org/file/bot${botToken}/${remotePath}`)
  if (!download.ok) return { error: 'That file could not be downloaded. Try again shortly.' }

  const bytes = Buffer.from(await download.arrayBuffer())
  const extension = remotePath.includes('.') ? remotePath.split('.').pop() : 'bin'
  const fileName = `telegram-${Date.now()}.${extension}`
  const storagePath = `${userId}/${brandId}/${fileName}`

  const { error: uploadError } = await supabase.storage
    .from('media')
    .upload(storagePath, bytes, { contentType: attachment.mimeType ?? 'application/octet-stream', upsert: true })

  if (uploadError) return { error: `That file could not be saved: ${uploadError.message}` }

  const fileUrl = supabase.storage.from('media').getPublicUrl(storagePath).data.publicUrl

  const { data: row, error: rowError } = await supabase
    .from('media_items')
    .insert({
      user_id: userId,
      brand_id: brandId,
      file_url: fileUrl,
      file_name: fileName,
      file_type: attachment.mimeType ?? 'application/octet-stream',
      file_size_bytes: bytes.length,
      metadata: {
        source: 'telegram',
        caption: attachment.caption ?? null,
        kind: attachment.kind,
      },
    })
    .select('id')
    .single()

  if (rowError || !row) return { error: 'That file was stored but could not be filed against the project.' }

  return { media: { mediaItemId: row.id as string, fileUrl, bytes: bytes.length } }
}

/** What to say back the moment a file arrives, before any processing. */
export function acknowledgeAttachment(attachment: TelegramAttachment, projectName: string): string {
  const noun =
    attachment.kind === 'video' ? 'video'
    : attachment.kind === 'audio' ? 'recording'
    : attachment.kind === 'photo' ? 'photo'
    : 'file'

  return attachment.kind === 'video' || attachment.kind === 'audio'
    ? `Got the ${noun} for ${projectName}. Transcribing it, then I'll write captions from what you actually said.`
    : `Got the ${noun} for ${projectName}. Reading it, then I'll come back with captions.`
}

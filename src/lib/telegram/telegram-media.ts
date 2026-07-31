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
  /**
   * Telegram's album id. Selecting several photos and sending them together
   * arrives as N SEPARATE messages that share this value — there is no single
   * "album" update. Ignoring it turned an eight-image carousel into eight
   * unrelated single-image posts.
   */
  mediaGroupId?: string
}

/** Read Telegram's album id, present only when several files were sent together. */
function readMediaGroupId(message: Record<string, unknown>): string | undefined {
  return typeof message.media_group_id === 'string' ? message.media_group_id : undefined
}

/**
 * Pull an attachment off a Telegram message.
 *
 * Photos arrive as an array of sizes, smallest first; the last is the largest
 * and the only one worth keeping.
 */
export function readAttachment(message: Record<string, unknown>): TelegramAttachment | null {
  const caption = typeof message.caption === 'string' ? message.caption : undefined
  const mediaGroupId = readMediaGroupId(message)

  const video = message.video as Record<string, unknown> | undefined
  if (video?.file_id) {
    return {
      fileId: String(video.file_id),
      fileSize: typeof video.file_size === 'number' ? video.file_size : undefined,
      kind: 'video',
      mimeType: typeof video.mime_type === 'string' ? video.mime_type : 'video/mp4',
      caption,
      mediaGroupId,
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
      mediaGroupId,
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
      mediaGroupId,
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
      mediaGroupId,
    }
  }

  return null
}

/**
 * Telegram's CLOUD bot API refuses to serve a bot any file over 20 MB.
 *
 * This is the reason no file had ever arrived through the bot: a phone video is
 * 200 MB or more, so every real clip the owner sent was refused before any NRS
 * code ran. It is a limit of api.telegram.org, not something that can be
 * worked around in a request.
 *
 * A self-hosted Bot API server (tdlib/telegram-bot-api) lifts it — that server
 * will serve files up to 2 GB. Point TELEGRAM_API_BASE at it and the ceiling
 * rises accordingly.
 */
export const TELEGRAM_CLOUD_FILE_LIMIT_BYTES = 20 * 1024 * 1024

/** What a self-hosted Bot API server will serve. */
export const TELEGRAM_LOCAL_FILE_LIMIT_BYTES = 2000 * 1024 * 1024

/** Kept for existing imports. */
export const TELEGRAM_FILE_LIMIT_BYTES = TELEGRAM_CLOUD_FILE_LIMIT_BYTES

/**
 * Where the Bot API lives. Defaults to Telegram's cloud; set TELEGRAM_API_BASE
 * to a self-hosted server to accept the owner's actual footage.
 */
export function telegramApiBase(env: Record<string, string | undefined> = process.env): string {
  return (env.TELEGRAM_API_BASE ?? 'https://api.telegram.org').replace(/\/+$/, '')
}

/** True when pointed at a self-hosted server rather than Telegram's cloud. */
export function usingSelfHostedBotApi(env: Record<string, string | undefined> = process.env): boolean {
  return telegramApiBase(env) !== 'https://api.telegram.org'
}

/** The largest file that can actually be fetched, given where the API lives. */
export function telegramFileLimitBytes(env: Record<string, string | undefined> = process.env): number {
  return usingSelfHostedBotApi(env)
    ? TELEGRAM_LOCAL_FILE_LIMIT_BYTES
    : TELEGRAM_CLOUD_FILE_LIMIT_BYTES
}

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
  const apiBase = telegramApiBase()
  const limit = telegramFileLimitBytes()

  if (attachment.fileSize && attachment.fileSize > limit) {
    const sizeMb = Math.round(attachment.fileSize / 1024 / 1024)
    return {
      error: usingSelfHostedBotApi()
        ? `That file is ${sizeMb} MB, over the ${Math.round(limit / 1024 / 1024)} MB the Bot API will serve. Send a shorter clip, or upload it on the web.`
        : `That file is ${sizeMb} MB. Telegram's own bot API refuses anything over 20 MB, so I cannot fetch it — this is their limit, not a fault here. Upload it on the web instead, or point NRS at a self-hosted Bot API server to lift the cap.`,
    }
  }

  const lookup = await fetch(`${apiBase}/bot${botToken}/getFile?file_id=${attachment.fileId}`)
  if (!lookup.ok) return { error: 'That file could not be read from Telegram. Try sending it again.' }

  const info = (await lookup.json()) as { ok?: boolean; result?: { file_path?: string } }
  const remotePath = info.result?.file_path
  if (!info.ok || !remotePath) {
    return { error: 'Telegram would not hand over that file. It may be too large for a bot to fetch.' }
  }

  const download = await fetch(`${apiBase}/file/bot${botToken}/${remotePath}`)
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
        // Recorded so the separate messages of an album can be reassembled
        // into one carousel instead of becoming N unrelated posts.
        ...(attachment.mediaGroupId ? { telegram_media_group_id: attachment.mediaGroupId } : {}),
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

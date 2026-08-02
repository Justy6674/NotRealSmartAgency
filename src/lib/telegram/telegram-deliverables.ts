/**
 * What a finished Director job actually made, so Telegram can hand it over.
 *
 * The Director's answer is prose. When the work was a carousel, the files sat
 * in the media library and the owner was told, in words, that they were ready
 * — which is no use on a phone, and no use at all for TikTok, where the only
 * way to post a photo set is to have the slides on the device.
 *
 * This finds the media the job produced so the caller can send it as an album.
 */

import type { SupabaseClient } from '@supabase/supabase-js'

/** Telegram will not fetch a photo larger than this for a media group. */
export const TELEGRAM_REMOTE_PHOTO_LIMIT_BYTES = 10 * 1024 * 1024

export interface DeliverableMedia {
  mediaItemId: string
  url: string
  kind: 'photo' | 'video'
}

export interface JobDeliverables {
  media: DeliverableMedia[]
  /** Set when the media came from a draft, for the message that goes with it. */
  postId?: string
  platform?: string
  /** Files left out because Telegram would refuse them. */
  skipped: number
}

interface MediaRow {
  id: string
  file_url: string | null
  file_type: string | null
  file_size: number | null
}

function toDeliverable(row: MediaRow): DeliverableMedia | null {
  if (!row.file_url) return null
  const type = row.file_type ?? ''
  if (type.startsWith('video/')) {
    return { mediaItemId: row.id, url: row.file_url, kind: 'video' }
  }
  if (!type.startsWith('image/')) return null
  // Telegram fetches the URL itself and gives up past its own limit. A GIF is
  // an image row here but Telegram treats it as an animation in a media group,
  // where it is rejected — leave it for the media library.
  if (type === 'image/gif') return null
  if (typeof row.file_size === 'number' && row.file_size > TELEGRAM_REMOTE_PHOTO_LIMIT_BYTES) return null
  return { mediaItemId: row.id, url: row.file_url, kind: 'photo' }
}

/** Keep the draft's order — a carousel out of sequence is a different post. */
function orderByIds(rows: MediaRow[], ids: readonly string[]): MediaRow[] {
  const byId = new Map(rows.map((row) => [row.id, row]))
  return ids.flatMap((id) => {
    const row = byId.get(id)
    return row ? [row] : []
  })
}

/**
 * Find what this job produced, newest draft first.
 *
 * `since` is the moment the job started running, which is what keeps the
 * owner's own upload out of the reply: a photo he sent is stored before the
 * job is queued, so it is already older than this cutoff. Sending his own
 * pictures back would be noise.
 */
export async function findJobDeliverables({
  supabase,
  brandId,
  since,
  limit = 10,
}: {
  supabase: SupabaseClient
  brandId: string
  since: string
  limit?: number
}): Promise<JobDeliverables | null> {
  // A draft is the strongest signal: it is media the Director deliberately
  // assembled into a post, in the order it meant.
  const { data: drafts } = await supabase
    .from('scheduled_posts')
    .select('id, platform, media_item_ids, media_item_id, created_at')
    .eq('brand_id', brandId)
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(1)

  const draft = drafts?.[0] as
    | { id: string; platform: string | null; media_item_ids: string[] | null; media_item_id: string | null }
    | undefined

  if (draft) {
    const ids = (draft.media_item_ids?.length ? draft.media_item_ids : [draft.media_item_id])
      .filter((id): id is string => typeof id === 'string' && id.length > 0)

    if (ids.length > 0) {
      const { data: rows } = await supabase
        .from('media_items')
        .select('id, file_url, file_type, file_size')
        .in('id', ids)

      const ordered = orderByIds((rows ?? []) as MediaRow[], ids)
      const media = ordered.flatMap((row) => {
        const item = toDeliverable(row)
        return item ? [item] : []
      })

      if (media.length > 0) {
        return {
          media: media.slice(0, limit),
          postId: draft.id,
          ...(draft.platform ? { platform: draft.platform } : {}),
          skipped: ids.length - media.length,
        }
      }
    }
  }

  // No draft, but the Director may still have generated images — a set of
  // concepts to look at, say. Those are worth handing over too.
  const { data: fresh } = await supabase
    .from('media_items')
    .select('id, file_url, file_type, file_size, created_at')
    .eq('brand_id', brandId)
    .gte('created_at', since)
    .order('created_at', { ascending: true })
    .limit(limit)

  const media = ((fresh ?? []) as MediaRow[]).flatMap((row) => {
    const item = toDeliverable(row)
    return item ? [item] : []
  })

  if (media.length === 0) return null
  return { media, skipped: (fresh?.length ?? 0) - media.length }
}

/**
 * The line that goes with the album.
 *
 * It says where the files also live, because the album is a copy — the draft
 * is still the thing that gets published, and nobody should think saving these
 * to the camera roll is what publishes them.
 */
export function describeDeliverables(
  deliverables: JobDeliverables,
  projectName: string,
): string {
  const count = deliverables.media.length
  const noun = count === 1 ? 'file' : 'files'
  const lines = [`${projectName} — ${count} ${noun}. Hold to save them to your phone.`]

  if (deliverables.postId) {
    lines.push('The draft is in NRS Review, and in Mixpost, ready to go out.')
  }
  if (deliverables.skipped > 0) {
    lines.push(
      `${deliverables.skipped} ${deliverables.skipped === 1 ? 'file was' : 'files were'} too large to send here — download ${deliverables.skipped === 1 ? 'it' : 'them'} from the media library.`,
    )
  }

  return lines.join('\n')
}

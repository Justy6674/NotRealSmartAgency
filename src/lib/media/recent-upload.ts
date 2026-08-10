import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Has this project had media put into it recently enough that a bare question
 * is probably about it?
 *
 * "check now" is a question about a video. Nothing in those two words says so
 * — the turn that carried the file does, and by the time the follow-up arrives
 * that turn is gone from the request string. Without this the Director had no
 * way to know the message referred to anything, so no evidence was required of
 * it, and it told the owner his upload had never landed while it sat in his
 * library, transcribed, as the newest row.
 *
 * The window is deliberately generous. A false positive costs one query_media
 * call. A false negative costs the owner his confidence that the system can
 * see what he just gave it, which is the whole product.
 */
export const RECENT_UPLOAD_WINDOW_MS = 60 * 60 * 1000

export function isWithinRecentUploadWindow(
  createdAtIso: string | null | undefined,
  nowMs: number,
): boolean {
  if (!createdAtIso) return false
  const createdMs = new Date(createdAtIso).getTime()
  if (Number.isNaN(createdMs)) return false
  // A row stamped in the future is a clock problem, not a reason to ignore it.
  return createdMs <= nowMs + 60_000 && nowMs - createdMs <= RECENT_UPLOAD_WINDOW_MS
}

/**
 * True when the owner attached files to THIS turn, or put something in the
 * library within the window.
 *
 * Never throws: this decides whether to require extra evidence, and a database
 * hiccup must not be able to turn that requirement off silently. It fails
 * closed — an error is treated as "assume there is media", so the Director is
 * made to look rather than allowed to guess.
 */
export async function hasRecentMediaContext(
  supabase: SupabaseClient,
  brandId: string,
  options: { attachedNow?: readonly string[] | null, nowMs?: number } = {},
): Promise<boolean> {
  if (options.attachedNow && options.attachedNow.length > 0) return true

  const nowMs = options.nowMs ?? Date.now()
  const since = new Date(nowMs - RECENT_UPLOAD_WINDOW_MS).toISOString()

  try {
    const { data, error } = await supabase
      .from('media_items')
      .select('id')
      .eq('brand_id', brandId)
      .gte('created_at', since)
      .limit(1)

    if (error) return true
    return (data?.length ?? 0) > 0
  } catch {
    return true
  }
}

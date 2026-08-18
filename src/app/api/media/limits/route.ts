import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { validateZernioMedia } from '@/lib/zernio/validate'
import { zernioConfigured } from '@/lib/zernio/client'
import {
  formatBytes,
  platformsThatWillRefuse,
  refusalsFromLiveLimits,
  tooLargeSentence,
} from '@/components/agency/studio/media/platform-limits'

export const runtime = 'nodejs'

/**
 * "Will anything refuse this file?" — asked of the publisher, for one file.
 *
 * THE FAULT THIS CLOSES: the publisher has had a free, non-writing media
 * validator all along and nothing in NRS ever called it. The library carried a
 * hand-typed table of byte ceilings instead, and a hand-typed table is right
 * until the day it is not — at which point the owner is told a file is fine,
 * writes a caption for it, schedules it for Tuesday, and finds out on Tuesday.
 * This route asks the real thing, at upload time, while the file is still in
 * front of him and swapping it costs nothing.
 *
 * It never blocks and never writes. A file that Bluesky refuses is still a good
 * file for Facebook, so the answer is a sentence, not a gate.
 *
 * When the publisher is not configured — or cannot be reached — the local
 * table answers instead and says so in `source`. Falling silent here would be
 * the worst of the three options: it reads on screen as "everything is fine".
 */
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json(
      { error: 'Your session expired. Tap Reload once and sign in again.' },
      { status: 401 },
    )
  }

  const body = (await request.json().catch(() => null)) as {
    mediaItemId?: unknown
    url?: unknown
    fileType?: unknown
    size?: unknown
  } | null

  let url = typeof body?.url === 'string' ? body.url.trim() : ''
  let fileType = typeof body?.fileType === 'string' ? body.fileType : ''
  let size = typeof body?.size === 'number' && body.size > 0 ? body.size : 0

  // A media item id is the preferred form: it is the one shape that cannot be
  // used to point this route at somebody else's file, because the row is read
  // through the signed-in session and RLS answers for the tenancy.
  const mediaItemId = typeof body?.mediaItemId === 'string' ? body.mediaItemId : ''
  if (mediaItemId) {
    const { data: item } = await supabase
      .from('media_items')
      .select('file_url, file_type, file_size_bytes')
      .eq('id', mediaItemId)
      .maybeSingle()
    if (!item) {
      return NextResponse.json({ error: 'That file is not in your library.' }, { status: 404 })
    }
    url = item.file_url
    fileType = item.file_type ?? fileType
    size = item.file_size_bytes ?? size
  }

  if (!url) {
    return NextResponse.json({ error: 'Nothing to check.' }, { status: 400 })
  }

  const localRefusals = platformsThatWillRefuse(size)

  if (!zernioConfigured()) {
    return NextResponse.json({
      source: 'local',
      size,
      sizeFormatted: size ? formatBytes(size) : null,
      refusedBy: localRefusals,
      message: tooLargeSentence({ fileType, refusedBy: localRefusals }),
    })
  }

  try {
    const live = await validateZernioMedia(url)
    const refusedBy = refusalsFromLiveLimits(live.platformLimits)
    const liveSize = typeof live.size === 'number' && live.size > 0 ? live.size : size
    return NextResponse.json({
      source: 'live',
      size: liveSize,
      sizeFormatted: live.sizeFormatted ?? (liveSize ? formatBytes(liveSize) : null),
      refusedBy,
      message: tooLargeSentence({ fileType: live.contentType ?? fileType, refusedBy }),
    })
  } catch (error) {
    // The detail stays in the log. The owner gets the local answer, which is
    // the same answer nine times out of ten and never a silence.
    console.error('[media/limits] live check failed', error)
    return NextResponse.json({
      source: 'local',
      size,
      sizeFormatted: size ? formatBytes(size) : null,
      refusedBy: localRefusals,
      message: tooLargeSentence({ fileType, refusedBy: localRefusals }),
    })
  }
}

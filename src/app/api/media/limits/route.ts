import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { validateZernioMedia } from '@/lib/zernio/validate'
import { zernioConfigured } from '@/lib/zernio/client'
import { connectedAccountsForBrand } from '@/lib/posts/desk-post-accounts'
import {
  formatBytes,
  platformsThatWillRefuse,
  refusalsFromLiveLimits,
  tooLargeSentence,
} from '@/components/agency/studio/media/platform-limits'

export const runtime = 'nodejs'

/**
 * The platforms one business actually posts from, remembered for a minute.
 *
 * The library asks this route once per flagged file, so a two-hundred-item
 * grid would otherwise list the connected accounts two hundred times to answer
 * the same question with the same answer. A minute is short enough that
 * connecting an account and going back to the library shows the new answer.
 */
const CONNECTED_TTL_MS = 60_000
const connectedCache = new Map<string, { at: number; platforms: string[] }>()

async function connectedPlatforms(
  brand: { id: string; name: string; slug: string; social_urls: unknown },
): Promise<string[] | null> {
  const cached = connectedCache.get(brand.id)
  if (cached && Date.now() - cached.at < CONNECTED_TTL_MS) return cached.platforms
  try {
    const accounts = await connectedAccountsForBrand(brand)
    const platforms = accounts.map((account) => account.platform)
    connectedCache.set(brand.id, { at: Date.now(), platforms })
    return platforms
  } catch (error) {
    // An unscoped answer is worse than a scoped one and far better than none:
    // it may name a platform he does not use, but it will not miss one he does.
    console.error('[media/limits] connected accounts unavailable', error)
    return null
  }
}

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
  /** null means "we could not find out", which is not the same as "none". */
  let connected: string[] | null = null

  // A media item id is the preferred form: it is the one shape that cannot be
  // used to point this route at somebody else's file, because the row is read
  // through the signed-in session and RLS answers for the tenancy.
  const mediaItemId = typeof body?.mediaItemId === 'string' ? body.mediaItemId : ''
  if (mediaItemId) {
    const { data: item } = await supabase
      .from('media_items')
      .select('file_url, file_type, file_size_bytes, brand_id')
      .eq('id', mediaItemId)
      .maybeSingle()
    if (!item) {
      return NextResponse.json({ error: 'That file is not in your library.' }, { status: 404 })
    }
    url = item.file_url
    fileType = item.file_type ?? fileType
    size = item.file_size_bytes ?? size

    // Scoped to the accounts this business has, so a refusal is news rather
    // than trivia. Scent Sell posts to four platforms; being told that five
    // networks he has never opened would refuse a file is noise, and noise is
    // what taught him to ignore this line in the first place. Read through the
    // signed-in session, so RLS answers for the tenancy.
    if (item.brand_id) {
      const { data: brand } = await supabase
        .from('brands')
        .select('id, name, slug, social_urls')
        .eq('id', item.brand_id)
        .maybeSingle()
      if (brand) connected = await connectedPlatforms(brand)
    }
  }

  if (!url) {
    return NextResponse.json({ error: 'Nothing to check.' }, { status: 400 })
  }

  const localRefusals = platformsThatWillRefuse(size, { fileType, connected })

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
    const refusedBy = refusalsFromLiveLimits(live.platformLimits, { connected })
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

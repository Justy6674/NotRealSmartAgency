/**
 * Download every slide of a carousel as one zip.
 *
 * The existing download route hands back a text file with the caption and a
 * link. That is fine for a single image and useless for an eight-slide
 * carousel: the owner had to click Download eight times in the media library,
 * in order, and rename them so they stayed in order. This is the missing half
 * — the actual files, numbered, in one archive.
 *
 * It is also the TikTok path. TikTok photo posts are not published through
 * Mixpost here, so the only way to post one is to have the slides on the
 * device and finish in the TikTok app.
 *
 * NODE RUNTIME — it buffers the files to build the archive.
 */

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { buildZip, safeEntryName, type ZipEntry } from '@/lib/zip/store-zip'

export const runtime = 'nodejs'
export const maxDuration = 120

/**
 * Refuse rather than exhaust the function's memory. Ten 4K stills sit far
 * under this; a set of long videos would not, and a failed request that says
 * why beats an opaque crash.
 */
const MAX_ARCHIVE_BYTES = 200 * 1024 * 1024

const EXTENSION_BY_TYPE: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'video/mp4': 'mp4',
  'video/quicktime': 'mov',
}

interface MediaRow {
  id: string
  file_url: string | null
  file_name: string | null
  file_type: string | null
}

/** Keep the caller's order — a carousel read out of sequence is a new post. */
function orderByIds(rows: MediaRow[], ids: readonly string[]): MediaRow[] {
  const byId = new Map(rows.map((row) => [row.id, row]))
  return ids.flatMap((id) => {
    const row = byId.get(id)
    return row ? [row] : []
  })
}

function entryName(row: MediaRow, index: number): string {
  const position = String(index + 1).padStart(2, '0')
  const extension = EXTENSION_BY_TYPE[row.file_type ?? ''] ?? 'bin'
  const fallback = `${position}-slide.${extension}`
  if (!row.file_name) return fallback
  // Prefix the position so the archive unzips in carousel order regardless of
  // what the source files were called.
  return safeEntryName(`${position}-${row.file_name}`, fallback)
}

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const postId = searchParams.get('postId')
  const collectionId = searchParams.get('collectionId')
  if (!postId && !collectionId) {
    return NextResponse.json({ error: 'postId or collectionId required' }, { status: 400 })
  }

  // RLS decides what this user may read. Nothing here trusts the id itself.
  let mediaItemIds: string[] = []
  let archiveName = 'carousel'

  if (postId) {
    const { data: post, error } = await supabase
      .from('scheduled_posts')
      .select('id, platform, media_item_ids, media_item_id')
      .eq('id', postId)
      .maybeSingle()

    if (error || !post) return NextResponse.json({ error: 'Post not found' }, { status: 404 })

    const ids = Array.isArray(post.media_item_ids) ? (post.media_item_ids as string[]) : []
    mediaItemIds = ids.length > 0
      ? ids
      : typeof post.media_item_id === 'string' ? [post.media_item_id] : []
    archiveName = `${post.platform ?? 'post'}-${String(post.id).slice(0, 8)}`
  } else {
    const { data: collection, error } = await supabase
      .from('media_collections')
      .select('id, name, media_collection_items(media_item_id, position)')
      .eq('id', collectionId!)
      .maybeSingle()

    if (error || !collection) return NextResponse.json({ error: 'Collection not found' }, { status: 404 })

    const items = (collection.media_collection_items ?? []) as Array<{ media_item_id: string; position: number | null }>
    mediaItemIds = [...items]
      .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
      .map((item) => item.media_item_id)
    archiveName = safeEntryName(String(collection.name ?? 'collection'), 'collection')
  }

  if (mediaItemIds.length === 0) {
    return NextResponse.json({ error: 'There is no media attached to download.' }, { status: 404 })
  }

  const { data: mediaRows, error: mediaError } = await supabase
    .from('media_items')
    .select('id, file_url, file_name, file_type')
    .in('id', mediaItemIds)

  if (mediaError) return NextResponse.json({ error: 'Could not read the media.' }, { status: 500 })

  const ordered = orderByIds((mediaRows ?? []) as MediaRow[], mediaItemIds)
  if (ordered.length === 0) {
    return NextResponse.json({ error: 'The attached media is no longer available.' }, { status: 404 })
  }

  const entries: ZipEntry[] = []
  const missing: string[] = []
  let total = 0

  for (const [index, row] of ordered.entries()) {
    if (!row.file_url) {
      missing.push(entryName(row, index))
      continue
    }
    try {
      const response = await fetch(row.file_url)
      if (!response.ok) {
        missing.push(entryName(row, index))
        continue
      }
      const data = new Uint8Array(await response.arrayBuffer())
      total += data.length
      if (total > MAX_ARCHIVE_BYTES) {
        return NextResponse.json(
          { error: 'That set is too large to zip in one go. Download the videos individually from the media library.' },
          { status: 413 },
        )
      }
      entries.push({ name: entryName(row, index), data })
    } catch {
      missing.push(entryName(row, index))
    }
  }

  if (entries.length === 0) {
    return NextResponse.json({ error: 'None of the files could be fetched.' }, { status: 502 })
  }

  // Say so inside the archive rather than silently handing over a short set —
  // a carousel missing slide 4 looks complete until it is posted.
  if (missing.length > 0) {
    entries.push({
      name: 'MISSING-FILES.txt',
      data: new TextEncoder().encode(
        `These files could not be included and are still in the NRS media library:\n\n${missing.join('\n')}\n`,
      ),
    })
  }

  const zip = buildZip(entries)

  return new NextResponse(new Uint8Array(zip), {
    headers: {
      'content-type': 'application/zip',
      'content-disposition': `attachment; filename="${archiveName}.zip"`,
      'content-length': String(zip.length),
      'cache-control': 'private, no-store',
      ...(missing.length > 0 ? { 'x-nrs-missing-files': String(missing.length) } : {}),
    },
  })
}

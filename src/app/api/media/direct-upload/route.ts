import { after, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { generateDeterministicTags } from '@/lib/media/auto-tagger'
import { runMediaProcessingPipeline } from '@/lib/media/process-pipeline'
import { sanitizeIntakeFileName } from '@/lib/media/intake-link'
import { createZernioUpload, zernioContentTypeOf } from '@/lib/zernio/media'
import { zernioConfigured } from '@/lib/zernio/client'

export const runtime = 'nodejs'
export const maxDuration = 60

/**
 * A place to put a big file that is not this server.
 *
 * THE FAULT THIS CLOSES: the presigned-upload helpers were written, commented,
 * typed — and never called by anything. Every byte of every upload went through
 * a Node function with a request-body ceiling and a wall-clock limit, so the
 * failure mode for a long clip was a timeout partway up with nothing saved and
 * nothing to retry from.
 *
 * The browser asks here for somewhere to put the file, PUTs the bytes straight
 * there, and comes back with the link. This server never touches the file. That
 * is the whole point: a 400 MB clip and a 400 KB still cost us the same.
 *
 * The library row is still ours, and it is still born the same way every other
 * media row is — inserted here, then handed to `runMediaProcessingPipeline`,
 * which owns every mutation of `media_items` from that point on. Note there is
 * no `status` column on that table: an update carrying one is rejected wholesale
 * by PostgREST and takes every other field in the same statement down with it.
 */

const NOT_SET_UP =
  'Large uploads are not switched on for this desk yet. Smaller files still upload normally — ' +
  'ask us to turn this on.'

/** The publisher pre-validates size against this before it will hand out a URL. */
const MAX_DIRECT_BYTES = 5 * 1024 * 1024 * 1024

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json(
      { error: 'Your session expired. Tap Reload once, sign in again, then try the upload.' },
      { status: 401 },
    )
  }

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
  const action = typeof body?.action === 'string' ? body.action : ''
  const brandId = typeof body?.brand_id === 'string' ? body.brand_id : ''
  if (!brandId) {
    return NextResponse.json({ error: 'Choose a business before uploading.' }, { status: 400 })
  }

  // Read through the signed-in session, so RLS decides whether this business is
  // his. A brandId out of a request body proves nothing on its own.
  const { data: brand } = await supabase
    .from('brands')
    .select('id, name, niche, content_pillars, compliance_flags')
    .eq('id', brandId)
    .maybeSingle()
  if (!brand) {
    return NextResponse.json({ error: 'That business could not be found in NRS.' }, { status: 404 })
  }

  const fileName = typeof body?.file_name === 'string' ? body.file_name.trim() : ''
  const fileType = typeof body?.file_type === 'string' ? body.file_type.trim().toLowerCase() : ''
  const fileSize = typeof body?.file_size === 'number' ? body.file_size : 0

  if (!fileName) {
    return NextResponse.json({ error: 'That file has no name NRS could read.' }, { status: 400 })
  }

  if (action === 'presign') {
    if (!zernioConfigured()) {
      return NextResponse.json({ error: NOT_SET_UP }, { status: 503 })
    }
    if (fileSize > MAX_DIRECT_BYTES) {
      return NextResponse.json(
        { error: 'That file is over 5 GB, which is more than any of your accounts will take.' },
        { status: 400 },
      )
    }

    // The accepted list is closed — a phone's own HEIC mime is a refusal at the
    // moment of upload, not a conversion. Say which file, and say it before the
    // bytes move rather than after.
    const contentType = zernioContentTypeOf({ mimeType: fileType, filename: fileName })
    if (!contentType) {
      return NextResponse.json(
        { error: `Your accounts will not take a ${fileType || 'file'} like this one. Save it as a JPEG, PNG or MP4 and try again.` },
        { status: 400 },
      )
    }

    try {
      const presigned = await createZernioUpload({
        filename: fileName,
        contentType,
        ...(fileSize > 0 ? { size: fileSize } : {}),
      })
      return NextResponse.json({
        upload_url: presigned.uploadUrl,
        public_url: presigned.publicUrl,
        key: presigned.key,
        content_type: contentType,
      })
    } catch (error) {
      console.error('[media/direct-upload] presign failed', error)
      return NextResponse.json(
        { error: 'NRS could not prepare this upload just now. Nothing has been changed — try again in a moment.' },
        { status: 502 },
      )
    }
  }

  if (action !== 'complete') {
    return NextResponse.json({ error: 'Unknown upload action.' }, { status: 400 })
  }

  const publicUrl = typeof body?.public_url === 'string' ? body.public_url.trim() : ''
  const key = typeof body?.key === 'string' ? body.key.trim() : ''
  if (!publicUrl.startsWith('https://') || (key && !publicUrl.includes(key))) {
    return NextResponse.json(
      { error: 'The file uploaded but the link did not come back in one piece. Try the upload again.' },
      { status: 400 },
    )
  }

  const isImage = fileType.startsWith('image/')
  const metadata = {
    source: 'direct_upload',
    storage: 'publisher',
    upload_key: key,
  }

  const { data: mediaItem, error: mediaError } = await supabase
    .from('media_items')
    .insert({
      user_id: user.id,
      brand_id: brandId,
      file_url: publicUrl,
      thumbnail_url: null,
      file_name: sanitizeIntakeFileName(fileName),
      file_type: fileType || 'application/octet-stream',
      file_size_bytes: fileSize > 0 ? fileSize : null,
      transcription_status: isImage ? 'transcribed' : 'pending',
      file_created_at: new Date().toISOString(),
      uploaded_by_name: user.user_metadata?.full_name ?? user.email ?? 'Unknown',
      source_type: 'upload' as const,
      tags: generateDeterministicTags(brand, fileType, fileName),
      metadata,
    })
    .select('id')
    .single()

  if (mediaError || !mediaItem) {
    console.error('[media/direct-upload] could not file the upload', mediaError)
    return NextResponse.json(
      { error: 'The file uploaded but could not be saved to your library.' },
      { status: 500 },
    )
  }

  after(async () => {
    const result = await runMediaProcessingPipeline({
      supabase: createAdminClient(),
      mediaItemId: mediaItem.id,
    })
    if (!result.success) {
      console.error(`[media/direct-upload:${mediaItem.id}] processing failed: ${result.error}`)
    }
  })

  return NextResponse.json({ media_item_id: mediaItem.id, status: 'processing' })
}

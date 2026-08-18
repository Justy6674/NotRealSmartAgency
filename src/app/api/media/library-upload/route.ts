import { after, NextResponse } from 'next/server'
import { randomUUID } from 'node:crypto'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { generateDeterministicTags } from '@/lib/media/auto-tagger'
import { buildLibraryUploadStoragePath, libraryUploadPrefix } from '@/lib/media/library-upload-path'
import { sanitizeIntakeFileName, validateIntakeFile } from '@/lib/media/intake-link'
import { runMediaProcessingPipeline } from '@/lib/media/process-pipeline'

export const runtime = 'nodejs'
export const maxDuration = 300

/**
 * Signed-URL upload for the Media library and Compose drop zones.
 *
 * The browser never calls supabase.auth.getSession() for uploads — that call
 * can hang forever on a contended Web Lock while the UI shows "Uploading…"
 * with no progress. Auth runs once here on the server; bytes go straight to
 * Storage via a signed PUT URL.
 */
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json(
      { error: 'Your session expired. Tap Reload once, sign in again, then try the upload.' },
      { status: 401 },
    )
  }

  const body = await request.json().catch(() => null) as {
    action?: unknown
    brand_id?: unknown
    file_name?: unknown
    file_type?: unknown
    file_size?: unknown
    storage_path?: unknown
    client_upload_id?: unknown
  } | null

  const brandId = typeof body?.brand_id === 'string' ? body.brand_id : ''
  if (!brandId) {
    return NextResponse.json({ error: 'Choose a business before uploading.' }, { status: 400 })
  }

  const { data: brand, error: brandError } = await supabase
    .from('brands')
    .select('id, name, niche, content_pillars, compliance_flags')
    .eq('id', brandId)
    .maybeSingle()

  if (brandError || !brand) {
    return NextResponse.json({ error: 'That business could not be found in NRS.' }, { status: 404 })
  }

  const action = body?.action
  const fileName = typeof body?.file_name === 'string' ? body.file_name : ''
  const fileType = typeof body?.file_type === 'string' ? body.file_type.trim().toLowerCase() : ''
  const fileSize = typeof body?.file_size === 'number' ? body.file_size : 0
  const fileError = validateIntakeFile({ fileName, fileType, fileSize })
  if (fileError && action !== 'start') {
    return NextResponse.json({ error: fileError }, { status: 400 })
  }

  const admin = createAdminClient()
  const prefix = libraryUploadPrefix(user.id, brandId)
  const requestedUploadId = typeof body?.client_upload_id === 'string' ? body.client_upload_id : ''
  const isUploadId = (value: string) =>
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
  const clientUploadId = isUploadId(requestedUploadId) ? requestedUploadId : randomUUID()

  if (action === 'start') {
    if (fileError) return NextResponse.json({ error: fileError }, { status: 400 })

    const storagePath = buildLibraryUploadStoragePath({
      userId: user.id,
      brandId,
      fileName,
      uploadId: clientUploadId,
    })

    const { data, error } = await admin.storage.from('media').createSignedUploadUrl(storagePath)
    if (error || !data) {
      return NextResponse.json({ error: 'NRS could not prepare this upload. Tap Reload once and try again.' }, { status: 500 })
    }

    return NextResponse.json({
      signed_url: data.signedUrl,
      storage_path: storagePath,
      client_upload_id: clientUploadId,
    })
  }

  if (action !== 'complete') {
    return NextResponse.json({ error: 'Unknown upload action.' }, { status: 400 })
  }

  const storagePath = typeof body?.storage_path === 'string' ? body.storage_path : ''
  if (!storagePath.startsWith(prefix)) {
    return NextResponse.json({ error: 'That upload did not belong to your signed-in session.' }, { status: 403 })
  }

  const folder = storagePath.slice(0, storagePath.lastIndexOf('/'))
  const filePart = storagePath.slice(storagePath.lastIndexOf('/') + 1)
  const { data: objects } = await admin.storage.from('media').list(folder, { search: filePart })
  const uploaded = objects?.find((object) => object.name === filePart)
  if (!uploaded) {
    return NextResponse.json(
      { error: 'The file did not finish uploading. Check your connection and try again.' },
      { status: 409 },
    )
  }

  const actualSize = (uploaded.metadata as { size?: number } | null)?.size ?? 0
  const actualFileError = validateIntakeFile({ fileName, fileType, fileSize: actualSize })
  if (actualFileError || actualSize !== fileSize) {
    return NextResponse.json({ error: 'The uploaded file did not match what NRS expected.' }, { status: 409 })
  }

  const metadata = {
    source: 'media_library',
    storage_path: storagePath,
    client_upload_id: clientUploadId,
  }

  const { data: existing, error: existingError } = await supabase
    .from('media_items')
    .select('id')
    .eq('brand_id', brandId)
    .contains('metadata', metadata)
    .maybeSingle()

  if (existingError) {
    return NextResponse.json({ error: 'NRS could not check the uploaded file.' }, { status: 500 })
  }

  if (existing?.id) {
    return NextResponse.json({ media_item_id: existing.id, already_filed: true, status: 'processing' })
  }

  const fileUrl = admin.storage.from('media').getPublicUrl(storagePath).data.publicUrl
  const isImage = fileType.startsWith('image/')
  const deterministicTags = generateDeterministicTags(brand, fileType, fileName)

  const { data: mediaItem, error: mediaError } = await supabase
    .from('media_items')
    .insert({
      user_id: user.id,
      brand_id: brandId,
      file_url: fileUrl,
      thumbnail_url: null,
      file_name: sanitizeIntakeFileName(fileName),
      file_type: fileType,
      file_size_bytes: actualSize,
      transcription_status: isImage ? 'transcribed' : 'pending',
      file_created_at: new Date().toISOString(),
      uploaded_by_name: user.user_metadata?.full_name ?? user.email ?? 'Unknown',
      tags: deterministicTags,
      metadata,
    })
    .select('id')
    .single()

  if (mediaError?.code === '23505') {
    const { data: concurrentlyFiled } = await supabase
      .from('media_items')
      .select('id')
      .eq('brand_id', brandId)
      .contains('metadata', metadata)
      .maybeSingle()
    if (concurrentlyFiled?.id) {
      return NextResponse.json({ media_item_id: concurrentlyFiled.id, already_filed: true, status: 'processing' })
    }
  }

  if (mediaError || !mediaItem) {
    return NextResponse.json({ error: 'The file uploaded but could not be saved to your library.' }, { status: 500 })
  }

  after(async () => {
    const result = await runMediaProcessingPipeline({
      supabase: admin,
      mediaItemId: mediaItem.id,
    })
    if (!result.success) console.error(`[library-upload:${mediaItem.id}] processing failed: ${result.error}`)
  })

  return NextResponse.json({ media_item_id: mediaItem.id, status: 'processing' })
}

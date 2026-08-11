import { after, NextResponse } from 'next/server'
import { randomUUID } from 'node:crypto'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { runMediaProcessingPipeline } from '@/lib/media/process-pipeline'
import {
  buildDesktopInboxStoragePath,
  canWriteDesktopInboxBrand,
  desktopInboxStoragePrefix,
  isDesktopInboxBrandSlug,
  type TeamMembershipForUpload,
} from '@/lib/media/desktop-inbox'
import { sanitizeIntakeFileName, validateIntakeFile } from '@/lib/media/intake-link'

export const runtime = 'nodejs'
export const maxDuration = 300

interface InboxBrand {
  id: string
  name: string
  slug: string
  user_id: string
}

function unavailableBrandResponse() {
  // Do not reveal other brand records from a URL someone alters by hand.
  return NextResponse.json({ error: 'This shared inbox is not available for that brand.' }, { status: 404 })
}

/**
 * Signed-in desktop upload endpoint.
 *
 * It is deliberately separate from the public phone capability endpoint. An
 * authenticated NRS owner/admin selects one of four approved brands, receives
 * a single signed Storage URL, and files the result under the brand owner. It
 * cannot list media, send a Director job, create a draft or publish anything.
 */
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Sign in to NRS before using the shared desktop inbox.' }, { status: 401 })

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
  if (!brandId) return NextResponse.json({ error: 'Choose a brand before uploading.' }, { status: 400 })

  const { data: selectedBrand, error: brandError } = await supabase
    .from('brands')
    .select('id, name, slug, user_id')
    .eq('id', brandId)
    .maybeSingle()
  const brand = selectedBrand as InboxBrand | null
  if (brandError || !brand || !isDesktopInboxBrandSlug(brand.slug)) return unavailableBrandResponse()

  // brands_select predates per-brand team restrictions, so apply the precise
  // write test here before using the service client to create a signed URL.
  if (brand.user_id !== user.id) {
    const admin = createAdminClient()
    const { data: membership } = await admin
      .from('team_members')
      .select('role, status, brand_ids')
      .eq('owner_id', brand.user_id)
      .eq('member_id', user.id)
      .maybeSingle()
    if (!canWriteDesktopInboxBrand(membership as TeamMembershipForUpload | null, brand.id)) {
      return NextResponse.json({ error: 'Your NRS access does not allow uploads for this brand.' }, { status: 403 })
    }
  }

  const action = body?.action
  const fileName = typeof body?.file_name === 'string' ? body.file_name : ''
  const fileType = typeof body?.file_type === 'string' ? body.file_type.trim().toLowerCase() : ''
  const fileSize = typeof body?.file_size === 'number' ? body.file_size : 0
  const fileError = validateIntakeFile({ fileName, fileType, fileSize })
  if (fileError) return NextResponse.json({ error: fileError }, { status: 400 })
  const requestedUploadId = typeof body?.client_upload_id === 'string' ? body.client_upload_id : ''
  const requestedStoragePath = typeof body?.storage_path === 'string' ? body.storage_path : ''
  const storedUploadId = requestedStoragePath.slice(requestedStoragePath.lastIndexOf('/') + 1).split('_')[0] ?? ''
  const isUploadId = (value: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
  const clientUploadId = isUploadId(requestedUploadId)
    ? requestedUploadId
    : isUploadId(storedUploadId)
      ? storedUploadId
      : randomUUID()

  const admin = createAdminClient()

  if (action === 'start') {
    const storagePath = buildDesktopInboxStoragePath({
      ownerUserId: brand.user_id,
      brandId: brand.id,
      uploaderUserId: user.id,
      uploadId: clientUploadId,
      fileName,
      sanitizeFileName: sanitizeIntakeFileName,
    })
    const { data, error } = await admin.storage.from('media').createSignedUploadUrl(storagePath)
    if (error || !data) return NextResponse.json({ error: 'NRS could not prepare this upload.' }, { status: 500 })

    return NextResponse.json({ signed_url: data.signedUrl, storage_path: storagePath, brand_name: brand.name })
  }

  if (action !== 'complete') return NextResponse.json({ error: 'Unknown upload action.' }, { status: 400 })

  const storagePath = typeof body?.storage_path === 'string' ? body.storage_path : ''
  const prefix = desktopInboxStoragePrefix({
    ownerUserId: brand.user_id,
    brandId: brand.id,
    uploaderUserId: user.id,
  })
  if (!storagePath.startsWith(prefix)) {
    return NextResponse.json({ error: 'That upload was not started by your signed-in NRS inbox.' }, { status: 403 })
  }

  const folder = storagePath.slice(0, storagePath.lastIndexOf('/'))
  const filePart = storagePath.slice(storagePath.lastIndexOf('/') + 1)
  const { data: objects } = await admin.storage.from('media').list(folder, { search: filePart })
  const uploaded = objects?.find((object) => object.name === filePart)
  if (!uploaded) return NextResponse.json({ error: 'The file did not finish uploading. Check the connection and try again.' }, { status: 409 })

  const actualSize = (uploaded.metadata as { size?: number } | null)?.size ?? 0
  const actualFileError = validateIntakeFile({ fileName, fileType, fileSize: actualSize })
  if (actualFileError || actualSize !== fileSize) {
    return NextResponse.json({ error: 'The uploaded file did not match the approved upload.' }, { status: 409 })
  }

  // The path is the idempotency key. Retrying after a lost browser response
  // cannot create another NRS media item or make a second processing request.
  const metadata = { source: 'desktop_media_inbox', uploader_user_id: user.id, storage_path: storagePath, client_upload_id: clientUploadId }
  const { data: existing, error: existingError } = await admin
    .from('media_items')
    .select('id')
    .eq('user_id', brand.user_id)
    .eq('brand_id', brand.id)
    .contains('metadata', metadata)
    .maybeSingle()
  if (existingError) return NextResponse.json({ error: 'NRS could not check the uploaded file.' }, { status: 500 })
  if (existing?.id) {
    return NextResponse.json({ media_item_id: existing.id, brand_name: brand.name, already_filed: true, status: 'processing' })
  }

  const fileUrl = admin.storage.from('media').getPublicUrl(storagePath).data.publicUrl
  const { data: mediaItem, error: mediaError } = await admin
    .from('media_items')
    .insert({
      user_id: brand.user_id,
      brand_id: brand.id,
      file_url: fileUrl,
      file_name: sanitizeIntakeFileName(fileName),
      file_type: fileType,
      file_size_bytes: actualSize,
      transcription_status: fileType.startsWith('image/') ? 'transcribed' : 'pending',
      uploaded_by_name: user.user_metadata?.full_name ?? user.email ?? 'NRS desktop inbox',
      metadata,
    })
    .select('id')
    .single()
  // The database index makes completion genuinely idempotent. A duplicate-key
  // result means another overlapping completion filed this exact storage object
  // first, so return that row rather than starting processing twice.
  if (mediaError?.code === '23505') {
    const { data: concurrentlyFiled } = await admin
      .from('media_items')
      .select('id')
      .eq('user_id', brand.user_id)
      .eq('brand_id', brand.id)
      .contains('metadata', metadata)
      .maybeSingle()
    if (concurrentlyFiled?.id) {
      return NextResponse.json({ media_item_id: concurrentlyFiled.id, brand_name: brand.name, already_filed: true, status: 'processing' })
    }
  }
  if (mediaError || !mediaItem) return NextResponse.json({ error: 'The file uploaded but could not be filed in NRS.' }, { status: 500 })

  // Enrichment is not a posting action. A 500 MB file is already safely in its
  // correct library before thumbnailing, transcription or AI tagging begins.
  after(async () => {
    const result = await runMediaProcessingPipeline({
      supabase: admin,
      mediaItemId: mediaItem.id,
      runStages: ['thumbnail', 'transcription', 'ai'],
    })
    if (!result.success) console.error(`[desktop-media-inbox:${mediaItem.id}] processing failed: ${result.error}`)
  })

  return NextResponse.json({ media_item_id: mediaItem.id, brand_name: brand.name, status: 'processing' })
}

import { after, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { runMediaProcessingPipeline } from '@/lib/media/process-pipeline'
import {
  buildIntakeStoragePath,
  hashMediaIntakeToken,
  intakeStoragePrefix,
  isValidMediaIntakeToken,
  sanitizeIntakeFileName,
  validateIntakeFile,
} from '@/lib/media/intake-link'

export const runtime = 'nodejs'
export const maxDuration = 300

interface MediaIntakeLink {
  id: string
  brand_id: string
  owner_user_id: string
  label: string
  status: 'active' | 'revoked'
  expires_at: string | null
  brands: { name: string; slug: string } | Array<{ name: string; slug: string }> | null
}

function bearerToken(request: Request): string {
  const value = request.headers.get('authorization') ?? ''
  return value.startsWith('Bearer ') ? value.slice('Bearer '.length).trim() : ''
}

function brandName(link: MediaIntakeLink): string {
  const brand = Array.isArray(link.brands) ? link.brands[0] : link.brands
  return brand?.name ?? 'this brand'
}

async function resolveLiveLink(request: Request): Promise<MediaIntakeLink | null> {
  const token = bearerToken(request)
  if (!isValidMediaIntakeToken(token)) return null

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('media_intake_links')
    .select('id, brand_id, owner_user_id, label, status, expires_at, brands(name, slug)')
    .eq('token_hash', hashMediaIntakeToken(token))
    .eq('status', 'active')
    .is('revoked_at', null)
    .maybeSingle()

  if (error || !data) return null
  const link = data as MediaIntakeLink
  if (link.expires_at && new Date(link.expires_at) <= new Date()) return null
  return link
}

function invalidLinkResponse() {
  // One response for missing, expired and revoked links prevents the public
  // endpoint being used as an oracle for capability-link validity.
  return NextResponse.json({ error: 'This quick-add link is no longer available. Ask your NRS admin for a new one.' }, { status: 401 })
}

/**
 * Public, upload-only capability endpoint.
 *
 * The link may only issue a signed storage URL below its own immutable prefix,
 * then file the exact uploaded object into its one NRS brand. It never lists
 * files, returns another user's media, invokes the Director, or publishes.
 */
export async function POST(request: Request) {
  const link = await resolveLiveLink(request)
  if (!link) return invalidLinkResponse()

  const body = await request.json().catch(() => null) as {
    action?: unknown
    file_name?: unknown
    file_type?: unknown
    file_size?: unknown
    storage_path?: unknown
  } | null
  const action = body?.action

  if (action === 'describe') {
    return NextResponse.json({
      brand_name: brandName(link),
      link_label: link.label,
      max_upload_mb: 500,
      accepts: ['image', 'video', 'audio'],
    })
  }

  const fileName = typeof body?.file_name === 'string' ? body.file_name : ''
  const fileType = typeof body?.file_type === 'string' ? body.file_type : ''
  const normalisedFileType = fileType.trim().toLowerCase()
  const fileSize = typeof body?.file_size === 'number' ? body.file_size : 0
  const fileError = validateIntakeFile({ fileName, fileType: normalisedFileType, fileSize })
  if (fileError) return NextResponse.json({ error: fileError }, { status: 400 })

  const admin = createAdminClient()

  if (action === 'start') {
    const storagePath = buildIntakeStoragePath({
      ownerUserId: link.owner_user_id,
      brandId: link.brand_id,
      linkId: link.id,
      fileName,
    })
    const { data, error } = await admin.storage.from('media').createSignedUploadUrl(storagePath)
    if (error || !data) return NextResponse.json({ error: 'Could not start the upload.' }, { status: 500 })

    return NextResponse.json({
      signed_url: data.signedUrl,
      storage_path: storagePath,
      brand_name: brandName(link),
    })
  }

  if (action !== 'complete') return NextResponse.json({ error: 'Unknown upload action.' }, { status: 400 })

  const storagePath = typeof body?.storage_path === 'string' ? body.storage_path : ''
  const prefix = intakeStoragePrefix({
    ownerUserId: link.owner_user_id,
    brandId: link.brand_id,
    linkId: link.id,
  })
  if (!storagePath.startsWith(prefix)) {
    return NextResponse.json({ error: 'That upload does not belong to this quick-add link.' }, { status: 403 })
  }

  const folder = storagePath.slice(0, storagePath.lastIndexOf('/'))
  const filePart = storagePath.slice(storagePath.lastIndexOf('/') + 1)
  const { data: objects } = await admin.storage.from('media').list(folder, { search: filePart })
  const uploaded = objects?.find((object) => object.name === filePart)
  if (!uploaded) return NextResponse.json({ error: 'The file did not finish uploading. Check the connection and try again.' }, { status: 409 })

  const actualSize = (uploaded.metadata as { size?: number } | null)?.size ?? 0
  const actualFileError = validateIntakeFile({ fileName, fileType: normalisedFileType, fileSize: actualSize })
  if (actualFileError || actualSize !== fileSize) {
    return NextResponse.json({ error: 'The uploaded file did not match the approved upload.' }, { status: 409 })
  }

  // Completion is retried by mobile browsers after a lost response. The storage
  // path is the stable idempotency key, so a retry cannot produce another item.
  const metadata = { source: 'media_drop', intake_link_id: link.id, storage_path: storagePath }
  const { data: existing, error: existingError } = await admin
    .from('media_items')
    .select('id')
    .eq('user_id', link.owner_user_id)
    .eq('brand_id', link.brand_id)
    .contains('metadata', metadata)
    .maybeSingle()
  if (existingError) return NextResponse.json({ error: 'Could not check the uploaded file.' }, { status: 500 })

  const mediaItemId = existing?.id
  if (mediaItemId) {
    return NextResponse.json({ media_item_id: mediaItemId, brand_name: brandName(link), already_filed: true, status: 'processing' })
  }

  const fileUrl = admin.storage.from('media').getPublicUrl(storagePath).data.publicUrl
  const { data: mediaItem, error: mediaError } = await admin
    .from('media_items')
    .insert({
      user_id: link.owner_user_id,
      brand_id: link.brand_id,
      file_url: fileUrl,
      file_name: sanitizeIntakeFileName(fileName),
      file_type: normalisedFileType,
      file_size_bytes: actualSize,
      transcription_status: normalisedFileType.startsWith('image/') ? 'transcribed' : 'pending',
      uploaded_by_name: 'NRS quick add',
      metadata,
    })
    .select('id')
    .single()
  if (mediaError || !mediaItem) return NextResponse.json({ error: 'The file uploaded but could not be filed in NRS.' }, { status: 500 })

  await admin
    .from('media_intake_links')
    .update({ last_used_at: new Date().toISOString(), last_media_item_id: mediaItem.id })
    .eq('id', link.id)

  // Processing is useful but must never make a 500 MB upload look failed. The
  // original file is already in the library; only this background enrichment
  // can fail. No Director job or publishing action is started here.
  after(async () => {
    const result = await runMediaProcessingPipeline({
      supabase: admin,
      mediaItemId: mediaItem.id,
      runStages: ['thumbnail', 'transcription', 'ai'],
    })
    if (!result.success) console.error(`[media-intake:${mediaItem.id}] processing failed: ${result.error}`)
  })

  return NextResponse.json({ media_item_id: mediaItem.id, brand_name: brandName(link), status: 'processing' })
}

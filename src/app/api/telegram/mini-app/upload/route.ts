import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getNRSTelegramConfig } from '@/lib/telegram/nrs-telegram-config'
import { resolveTelegramMiniAppContext, validateTelegramMiniAppInitData } from '@/lib/telegram/mini-app'

/**
 * Upload real footage from inside Telegram.
 *
 * Telegram's cloud Bot API refuses to serve a bot any file over 20 MB, and a
 * phone video is 200 MB or more — which is why no video had ever reached NRS
 * through the bot, however many were sent. The Mini App runs in Telegram's own
 * browser, so it can upload a file the bot could never fetch.
 *
 * The bytes go BROWSER → SUPABASE directly via a signed URL. They deliberately
 * do not pass through here: a serverless function has a request body limit of a
 * few megabytes, so proxying a 224 MB video would fail just as surely as the
 * bot did.
 *
 *   start    → check the session, hand back a signed upload URL
 *   (browser uploads straight to storage)
 *   complete → file it in the library; the accompanying message owns the
 *              processing and Director turn for the whole attachment set
 */

export const runtime = 'nodejs'
export const maxDuration = 300

/** Supabase storage accepts well beyond this; the app's own ceiling. */
const MAX_UPLOAD_BYTES = 500 * 1024 * 1024

const ALLOWED_PREFIXES = ['video/', 'image/', 'audio/']

export async function POST(request: Request) {
  const config = getNRSTelegramConfig()
  if (!config?.enabled) {
    return NextResponse.json({ error: 'Telegram Mini App is not enabled.' }, { status: 503 })
  }

  const body = (await request.json().catch(() => null)) as {
    init_data?: unknown
    action?: unknown
    file_name?: unknown
    file_type?: unknown
    file_size?: unknown
    storage_path?: unknown
  } | null

  const initData = typeof body?.init_data === 'string' ? body.init_data : ''
  const auth = validateTelegramMiniAppInitData(initData, config.botToken)
  if (!auth) {
    return NextResponse.json({ error: 'Invalid or expired Telegram session.' }, { status: 401 })
  }

  const admin = createAdminClient()
  const context = await resolveTelegramMiniAppContext(admin, auth)
  if (!context?.activeSession) {
    return NextResponse.json({ error: 'Choose a project before sending a file.' }, { status: 409 })
  }

  const grant = context.grants.find(
    (candidate) =>
      candidate.grantId === context.activeSession?.grantId &&
      candidate.projectId === context.activeSession?.projectId,
  )
  if (!grant || !grant.capabilities.includes('director:chat')) {
    return NextResponse.json({ error: 'The selected project cannot run Director work.' }, { status: 403 })
  }

  const action = body?.action === 'complete' ? 'complete' : 'start'

  // ── start ────────────────────────────────────────────────────────────────
  if (action === 'start') {
    const fileName = typeof body?.file_name === 'string' ? body.file_name : ''
    const fileType = typeof body?.file_type === 'string' ? body.file_type : ''
    const fileSize = typeof body?.file_size === 'number' ? body.file_size : 0

    if (!fileName || !fileType) {
      return NextResponse.json({ error: 'A file name and type are required.' }, { status: 400 })
    }
    if (!ALLOWED_PREFIXES.some((prefix) => fileType.startsWith(prefix))) {
      return NextResponse.json({ error: 'Send a video, image or audio file.' }, { status: 400 })
    }
    if (fileSize > MAX_UPLOAD_BYTES) {
      return NextResponse.json(
        { error: `That file is ${Math.round(fileSize / 1024 / 1024)} MB. The limit is 500 MB.` },
        { status: 400 },
      )
    }

    const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_')
    const storagePath = `${context.actorUserId}/${grant.projectId}/${Date.now()}_${safeName}`

    const { data, error } = await admin.storage
      .from('media')
      .createSignedUploadUrl(storagePath)

    if (error || !data) {
      return NextResponse.json({ error: 'Could not start the upload.' }, { status: 500 })
    }

    return NextResponse.json({
      storage_path: storagePath,
      signed_url: data.signedUrl,
      token: data.token,
      project_name: grant.projectName,
    })
  }

  // ── complete ─────────────────────────────────────────────────────────────
  const storagePath = typeof body?.storage_path === 'string' ? body.storage_path : ''
  const fileName = typeof body?.file_name === 'string' ? body.file_name : 'upload'
  const fileType = typeof body?.file_type === 'string' ? body.file_type : 'application/octet-stream'

  // The path is built here at start, so a caller cannot point this at
  // someone else's file by inventing one.
  if (!storagePath.startsWith(`${context.actorUserId}/${grant.projectId}/`)) {
    return NextResponse.json({ error: 'That upload does not belong to this project.' }, { status: 403 })
  }

  const { data: stat } = await admin.storage
    .from('media')
    .list(storagePath.split('/').slice(0, -1).join('/'), {
      search: storagePath.split('/').pop(),
    })
  const uploaded = stat?.[0]
  if (!uploaded) {
    return NextResponse.json({ error: 'That file did not finish uploading.' }, { status: 409 })
  }

  // Mobile clients retry after a lost response. Refiling the same storage path
  // would produce duplicate media rows, then duplicate Director work, so the
  // path is a stable idempotency key for the Mini App completion step.
  const metadata = { source: 'telegram', via: 'mini_app', storage_path: storagePath }
  const { data: alreadyFiled, error: existingError } = await admin
    .from('media_items')
    .select('id')
    .eq('user_id', context.actorUserId)
    .eq('brand_id', grant.projectId)
    .contains('metadata', metadata)
    .maybeSingle()
  if (existingError) {
    return NextResponse.json({ error: 'Could not check the uploaded file.' }, { status: 500 })
  }
  if (alreadyFiled?.id) {
    return NextResponse.json({ media_item_id: alreadyFiled.id, project_name: grant.projectName, already_filed: true })
  }

  const fileUrl = admin.storage.from('media').getPublicUrl(storagePath).data.publicUrl

  const { data: media, error: mediaError } = await admin
    .from('media_items')
    .insert({
      user_id: context.actorUserId,
      brand_id: grant.projectId,
      file_url: fileUrl,
      file_name: fileName,
      file_type: fileType,
      file_size_bytes: (uploaded.metadata as { size?: number } | null)?.size ?? 0,
      transcription_status: fileType.startsWith('image/') ? 'transcribed' : 'pending',
      metadata,
    })
    .select('id')
    .single()

  if (mediaError || !media) {
    return NextResponse.json({ error: 'The file uploaded but could not be filed.' }, { status: 500 })
  }

  return NextResponse.json({
    media_item_id: media.id,
    project_name: grant.projectName,
  })
}

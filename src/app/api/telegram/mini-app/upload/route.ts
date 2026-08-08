import { after } from 'next/server'
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getNRSTelegramConfig } from '@/lib/telegram/nrs-telegram-config'
import { resolveTelegramMiniAppContext, validateTelegramMiniAppInitData } from '@/lib/telegram/mini-app'
import { runMediaProcessingPipeline } from '@/lib/media/process-pipeline'
import { startVideoBrief } from '@/lib/telegram/video-brief-run'
import { proposeAndStore } from '@/lib/telegram/mini-app-proposal'

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
 *   complete → file it in the library, process it, put the Director to work
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
    instruction?: unknown
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
  const instruction = typeof body?.instruction === 'string' ? body.instruction.trim() : ''
  const instructionGiven = instruction.length > 0

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
      metadata: { source: 'telegram', via: 'mini_app' },
    })
    .select('id')
    .single()

  if (mediaError || !media) {
    return NextResponse.json({ error: 'The file uploaded but could not be filed.' }, { status: 500 })
  }

  // Transcribe and describe first, then take a first pass at the post.
  //
  // Nothing is drafted and nothing reaches Mixpost here. Several clips can be
  // sent one after another and each comes back carrying a hook and a caption to
  // react to; the Director is only involved once there is something to discuss.
  // Anything typed alongside the file is treated as an angle for Content & Copy
  // rather than an order, because at upload time it is a hint, not a brief.
  after(async () => {
    await runMediaProcessingPipeline({ supabase: admin, mediaItemId: media.id }).catch(() => {
      /* a proposal off the file name alone is still better than nothing */
    })

    // A video starts a conversation, not a caption.
    //
    // This used to write a finished post for one platform before the owner had
    // said a word — no idea what it was for, who it was for, or where it was
    // going — so the only thing to do with it was accept it or complain. Now
    // NRS says what it heard and asks the first question.
    //
    // Typing an instruction alongside the file is a different matter: that IS
    // a brief, so it goes straight to the copy as it always did.
    if (instructionGiven) {
      await proposeAndStore({
        supabase: admin,
        userId: context.actorUserId,
        brandId: grant.projectId,
        mediaItemId: media.id,
        fileName,
        angle: instruction,
      })
    } else {
      await startVideoBrief({
        admin,
        userId: context.actorUserId,
        brandId: grant.projectId,
        mediaItemId: media.id,
      })
    }
  })

  return NextResponse.json({
    media_item_id: media.id,
    project_name: grant.projectName,
  })
}

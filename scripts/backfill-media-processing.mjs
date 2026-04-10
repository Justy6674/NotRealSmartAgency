/**
 * Backfill processing for a specific media_items row.
 *
 * Runs the same server-side pipeline that /api/media/process does, but via
 * the admin client so it can be fired from the terminal. Used to retroactively
 * fill thumbnail_url + transcription for media that was uploaded before the
 * server-side pipeline existed.
 *
 * Usage: node scripts/backfill-media-processing.mjs <media_item_id>
 */
import { readFile, unlink, mkdtemp } from 'fs/promises'
import { existsSync, readFileSync } from 'fs'
import { resolve, join } from 'path'
import { tmpdir } from 'os'
import { spawn } from 'child_process'
import { createClient } from '@supabase/supabase-js'

const envPath = resolve(import.meta.dirname, '..', '.env.local')
const envContent = readFileSync(envPath, 'utf8')
const env = {}
for (const line of envContent.split('\n')) {
  const match = line.match(/^([A-Z_]+)=(.+)$/)
  if (match) env[match[1]] = match[2].replace(/^["']|["']$/g, '')
}

const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const mediaItemId = process.argv[2]
if (!mediaItemId) {
  console.error('Usage: node scripts/backfill-media-processing.mjs <media_item_id>')
  process.exit(1)
}

console.log(`\n━━━ BACKFILL ${mediaItemId} ━━━`)

const { data: mediaItem, error: fetchErr } = await admin
  .from('media_items')
  .select('*')
  .eq('id', mediaItemId)
  .single()

if (fetchErr || !mediaItem) {
  console.error('❌', fetchErr?.message ?? 'Not found')
  process.exit(1)
}

console.log(`file: ${mediaItem.file_name}`)
console.log(`type: ${mediaItem.file_type}`)
console.log(`url:  ${mediaItem.file_url}`)

if (!mediaItem.file_type.startsWith('video/')) {
  console.log('Not a video — nothing to do.')
  process.exit(0)
}

// ── Thumbnail via ffmpeg ────────────────────────────────────────────────────
console.log('\n[1/2] Generating thumbnail via ffmpeg URL stream…')
const dir = await mkdtemp(join(tmpdir(), 'nrs-backfill-'))
const outputPath = join(dir, 'thumb.jpg')

const ffArgs = [
  '-ss', '1',
  '-rw_timeout', '15000000',
  '-i', mediaItem.file_url,
  '-frames:v', '1',
  '-vf', 'scale=720:-1',
  '-q:v', '3',
  '-y',
  outputPath,
]

await new Promise((resolvePromise, rejectPromise) => {
  const proc = spawn('ffmpeg', ffArgs)
  let stderr = ''
  proc.stderr.on('data', (d) => { stderr += d.toString() })
  proc.on('error', rejectPromise)
  proc.on('exit', (code) => {
    if (code === 0) resolvePromise()
    else rejectPromise(new Error(`ffmpeg exited ${code}: ${stderr.slice(-300)}`))
  })
  setTimeout(() => { proc.kill('SIGKILL'); rejectPromise(new Error('ffmpeg timeout')) }, 30_000)
})

if (!existsSync(outputPath)) {
  console.error('❌ ffmpeg produced no output')
  process.exit(1)
}
const thumbBuffer = await readFile(outputPath)
console.log(`✓ thumbnail: ${thumbBuffer.length} bytes`)

// Parse the main storage path from file_url
const mainUrlMatch = mediaItem.file_url.match(/\/storage\/v1\/object\/public\/media\/(.+)$/)
if (!mainUrlMatch) {
  console.error('❌ could not parse storage path from file_url')
  process.exit(1)
}
const mainStoragePath = decodeURIComponent(mainUrlMatch[1])
const thumbStoragePath = `${mainStoragePath}_thumb.jpg`

// Upload thumbnail
const { error: uploadErr } = await admin.storage
  .from('media')
  .upload(thumbStoragePath, thumbBuffer, {
    contentType: 'image/jpeg',
    upsert: true,
  })

if (uploadErr) {
  console.error('❌ thumbnail upload:', uploadErr.message)
  process.exit(1)
}

const { data: thumbUrlData } = admin.storage.from('media').getPublicUrl(thumbStoragePath)
console.log(`✓ uploaded to: ${thumbStoragePath}`)

// Clean up tmp
await unlink(outputPath).catch(() => {})

// ── Update DB row ──────────────────────────────────────────────────────────
console.log('\n[2/2] Updating media_items row…')
const { error: updateErr } = await admin
  .from('media_items')
  .update({
    thumbnail_url: thumbUrlData.publicUrl,
    metadata: {
      ...(mediaItem.metadata ?? {}),
      processing: {
        thumbnail: { status: 'ok', source: 'backfill-ffmpeg' },
        transcription: { status: 'skipped', reason: 'backfill script — thumbnail only' },
        ai: { status: 'skipped' },
        completed_at: new Date().toISOString(),
      },
    },
  })
  .eq('id', mediaItemId)

if (updateErr) {
  console.error('❌', updateErr.message)
  process.exit(1)
}

console.log('✓ row updated')
console.log(`\nThumbnail URL: ${thumbUrlData.publicUrl}`)
console.log('Refresh Media tab to see it.\n')

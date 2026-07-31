/**
 * Prove the Mini App upload path with a real large video.
 *
 * The bot could never fetch a file over 20 MB, and a serverless function could
 * never accept a 224 MB request body. The Mini App gets past both by having the
 * browser PUT straight to Supabase on a signed URL. That mechanism is the part
 * worth proving, so this exercises exactly it: signed URL → direct upload →
 * media_items row → the canonical pipeline.
 *
 * The only thing not covered is Telegram's initData HMAC, which needs the bot
 * token, and which gates the route rather than moving any bytes.
 *
 * Usage: npx tsx scripts/verify-miniapp-upload.ts <filePath> <brandId>
 */
import { readFileSync, statSync } from 'fs'
import { basename, resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { createClient } from '@supabase/supabase-js'
import { runMediaProcessingPipeline } from '@/lib/media/process-pipeline'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
for (const line of readFileSync(resolve(root, '.env.local'), 'utf8').split('\n')) {
  const match = line.match(/^\s*(?:export\s+)?([A-Z_0-9]+)\s*=\s*(.*)$/)
  if (!match || process.env[match[1]]) continue
  process.env[match[1]] = match[2].trim().replace(/^["']|["']$/g, '')
}

async function main() {
  const [, , filePath, brandId] = process.argv
  if (!filePath || !brandId) {
    console.error('Usage: npx tsx scripts/verify-miniapp-upload.ts <filePath> <brandId>')
    process.exit(1)
  }

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )

  const { data: brand } = await admin.from('brands').select('user_id, name').eq('id', brandId).single()
  const userId = brand!.user_id as string

  const stat = statSync(filePath)
  const sizeMb = stat.size / 1024 / 1024
  console.log(`File: ${basename(filePath)} — ${sizeMb.toFixed(1)} MB`)
  console.log(`Telegram's bot ceiling is 20 MB, so this is ${(sizeMb / 20).toFixed(0)}x what the bot could fetch.\n`)

  // 1. What the route hands back on `start`.
  const storagePath = `${userId}/${brandId}/${Date.now()}_miniapp-${basename(filePath).replace(/[^a-zA-Z0-9._-]/g, '_')}`
  const { data: signed, error: signError } = await admin.storage
    .from('media')
    .createSignedUploadUrl(storagePath)
  if (signError || !signed) throw new Error(`signed URL failed: ${signError?.message}`)
  console.log('1. Signed upload URL issued')

  // 2. What the browser does with it — a direct PUT, not through any function.
  const body = readFileSync(filePath)
  const started = Date.now()
  const put = await fetch(signed.signedUrl, {
    method: 'PUT',
    headers: { 'content-type': 'video/quicktime' },
    body,
  })
  if (!put.ok) throw new Error(`upload failed: ${put.status} ${await put.text()}`)
  console.log(`2. Uploaded ${sizeMb.toFixed(1)} MB directly to storage in ${((Date.now() - started) / 1000).toFixed(0)}s`)

  // 3. What `complete` files.
  const fileUrl = admin.storage.from('media').getPublicUrl(storagePath).data.publicUrl
  const { data: media, error: mediaError } = await admin
    .from('media_items')
    .insert({
      user_id: userId,
      brand_id: brandId,
      file_url: fileUrl,
      file_name: basename(filePath),
      file_type: 'video/quicktime',
      file_size_bytes: stat.size,
      transcription_status: 'pending',
      metadata: { source: 'telegram', via: 'mini_app' },
    })
    .select('id')
    .single()
  if (mediaError || !media) throw new Error(`media_items insert failed: ${mediaError?.message}`)
  console.log(`3. Filed in the library as ${media.id} with source 'telegram'`)

  // 4. The same pipeline every other upload goes through.
  const result = await runMediaProcessingPipeline({ supabase: admin, mediaItemId: media.id })
  console.log(`4. Pipeline: ${result.success ? 'ok' : 'FAILED'} — ${JSON.stringify(result.report)}`)

  const { data: processed } = await admin
    .from('media_items')
    .select('transcription, ai_description, thumbnail_url, duration_seconds')
    .eq('id', media.id)
    .single()

  console.log('\nWhat NRS now knows about it:')
  console.log(`  thumbnail : ${processed?.thumbnail_url ? 'yes' : 'no'}`)
  console.log(`  duration  : ${processed?.duration_seconds ?? '?'}s`)
  console.log(`  transcript: ${(processed?.transcription ?? '').length} chars`)
  console.log(`  describes : ${(processed?.ai_description ?? '').slice(0, 90)}`)
  console.log(`\nmedia_item_id for the Director: ${media.id}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

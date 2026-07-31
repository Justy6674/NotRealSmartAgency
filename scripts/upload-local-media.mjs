/**
 * Upload a local file into the NRS media library exactly the way
 * /api/media/upload does — same bucket, same path convention, same row shape.
 */
import { readFileSync, statSync } from 'fs'
import { basename, resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

// The app's secrets live in .env.local, not .env.
dotenv.config({
  path: resolve(dirname(fileURLToPath(import.meta.url)), '..', '.env.local'),
})

const [, , filePath, brandId, displayName] = process.argv

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } },
)

const { data: brand, error: brandErr } = await admin
  .from('brands')
  .select('id, name, user_id')
  .eq('id', brandId)
  .single()
if (brandErr || !brand) throw new Error(`Brand not found: ${brandErr?.message}`)

const userId = brand.user_id
const stat = statSync(filePath)
const fileName = displayName ?? basename(filePath)
const ext = fileName.split('.').pop().toLowerCase()
const contentType =
  ext === 'mov' ? 'video/quicktime' : ext === 'mp4' ? 'video/mp4' : 'application/octet-stream'

// Duplicate guard — same rule the route uses.
const { data: dupe } = await admin
  .from('media_items')
  .select('id')
  .eq('brand_id', brandId)
  .eq('file_name', fileName)
  .eq('file_size_bytes', stat.size)
  .maybeSingle()
if (dupe) {
  console.log(JSON.stringify({ id: dupe.id, skipped: true }))
  process.exit(0)
}

const timestamp = Date.now()
const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_')
const storagePath = `${userId}/${brandId}/${timestamp}_${safeName}`

console.error(`uploading ${(stat.size / 1024 / 1024).toFixed(1)}MB → ${storagePath}`)
const body = readFileSync(filePath)
const { error: upErr } = await admin.storage
  .from('media')
  .upload(storagePath, body, { contentType, upsert: false })
if (upErr) throw new Error(`Upload failed: ${upErr.message}`)

const { data: urlData } = admin.storage.from('media').getPublicUrl(storagePath)

const { data: item, error: dbErr } = await admin
  .from('media_items')
  .insert({
    user_id: userId,
    brand_id: brandId,
    file_url: urlData.publicUrl,
    file_name: fileName,
    file_type: contentType,
    file_size_bytes: stat.size,
    transcription_status: 'pending',
    metadata: {},
  })
  .select('id, file_url')
  .single()
if (dbErr) throw new Error(dbErr.message)

console.log(JSON.stringify({ id: item.id, brand: brand.name, url: item.file_url }, null, 1))

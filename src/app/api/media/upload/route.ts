export const maxDuration = 60

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const formData = await request.formData()
  const file = formData.get('file') as File | null
  const brandId = formData.get('brandId') as string | null

  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })
  if (!brandId) return NextResponse.json({ error: 'No brandId provided' }, { status: 400 })

  const allowedTypes = ['video/mp4', 'video/quicktime', 'audio/mpeg', 'audio/mp4', 'audio/m4a', 'video/webm']
  if (!allowedTypes.some(t => file.type.startsWith(t.split('/')[0]))) {
    return NextResponse.json({ error: 'Unsupported file type. Upload MP4, MOV, MP3, M4A, or WebM.' }, { status: 400 })
  }

  // Max 100MB
  if (file.size > 100 * 1024 * 1024) {
    return NextResponse.json({ error: 'File too large. Maximum 100MB.' }, { status: 400 })
  }

  const timestamp = Date.now()
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
  const storagePath = `${user.id}/${brandId}/${timestamp}_${safeName}`

  // Upload to Supabase Storage
  const { error: uploadError } = await supabase.storage
    .from('media')
    .upload(storagePath, file, {
      contentType: file.type,
      upsert: false,
    })

  if (uploadError) {
    return NextResponse.json({ error: `Upload failed: ${uploadError.message}` }, { status: 500 })
  }

  // Get public URL
  const { data: urlData } = supabase.storage.from('media').getPublicUrl(storagePath)

  // Create media_items record
  const { data: mediaItem, error: dbError } = await supabase
    .from('media_items')
    .insert({
      user_id: user.id,
      brand_id: brandId,
      file_url: urlData.publicUrl,
      file_name: file.name,
      file_type: file.type,
      file_size_bytes: file.size,
      transcription_status: 'pending',
    })
    .select()
    .single()

  if (dbError) {
    return NextResponse.json({ error: dbError.message }, { status: 500 })
  }

  return NextResponse.json(mediaItem)
}

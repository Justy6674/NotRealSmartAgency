import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const maxDuration = 60 // exports can take time

const CANVA_BASE_URL = 'https://api.canva.com/rest/v1'

/**
 * POST /api/canva/import-to-media
 *
 * Exports a Canva design to PNG/JPG, downloads it, uploads to Supabase Storage,
 * and creates a media_items record.
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  const body = await req.json()
  const { designId, brandId, format = 'png', tags = [] } = body as {
    designId: string
    brandId: string
    format?: 'png' | 'jpg' | 'pdf'
    tags?: string[]
  }

  if (!designId || !brandId) {
    return NextResponse.json({ error: 'designId and brandId required' }, { status: 400 })
  }

  // Verify brand belongs to user
  const { data: brand } = await supabase
    .from('brands')
    .select('id, name')
    .eq('id', brandId)
    .single()
  if (!brand) {
    return NextResponse.json({ error: 'Brand not found' }, { status: 404 })
  }

  // Get Canva token
  const { data: integration } = await supabase
    .from('user_integrations')
    .select('cached_data')
    .eq('user_id', user.id)
    .eq('provider', 'canva')
    .single()

  let apiKey: string | null = (integration?.cached_data?.api_key as string) ?? null
  if (!apiKey) apiKey = process.env.CANVA_API_KEY ?? null
  if (!apiKey) {
    return NextResponse.json({ error: 'Canva not connected' }, { status: 400 })
  }

  try {
    // Step 1: Get design info
    const designRes = await fetch(`${CANVA_BASE_URL}/designs/${designId}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    })
    if (!designRes.ok) {
      return NextResponse.json({ error: 'Failed to fetch design from Canva' }, { status: 502 })
    }
    const designData = await designRes.json()
    const designTitle = designData.design?.title ?? designData.title ?? 'Canva Design'

    // Step 2: Start export
    const exportRes = await fetch(`${CANVA_BASE_URL}/exports`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        design_id: designId,
        format: { type: format },
      }),
    })

    if (!exportRes.ok) {
      const err = await exportRes.json().catch(() => ({}))
      console.error('[canva/import] Export start failed:', err)
      return NextResponse.json({ error: 'Failed to start Canva export' }, { status: 502 })
    }

    const exportData = await exportRes.json()
    const exportId = exportData.job?.id ?? exportData.id

    if (!exportId) {
      return NextResponse.json({ error: 'No export job ID returned' }, { status: 502 })
    }

    // Step 3: Poll for export completion (max 30 seconds)
    let downloadUrl: string | null = null
    for (let i = 0; i < 15; i++) {
      await new Promise(resolve => setTimeout(resolve, 2000))

      const pollRes = await fetch(`${CANVA_BASE_URL}/exports/${exportId}`, {
        headers: { Authorization: `Bearer ${apiKey}` },
      })
      if (!pollRes.ok) continue

      const pollData = await pollRes.json()
      const status = pollData.job?.status ?? pollData.status
      if (status === 'completed' || status === 'success') {
        downloadUrl = pollData.job?.urls?.[0] ?? pollData.urls?.[0] ?? pollData.job?.result?.url ?? null
        break
      }
      if (status === 'failed') {
        return NextResponse.json({ error: 'Canva export failed' }, { status: 502 })
      }
    }

    if (!downloadUrl) {
      return NextResponse.json({ error: 'Export timed out' }, { status: 504 })
    }

    // Step 4: Download the file
    const fileRes = await fetch(downloadUrl)
    if (!fileRes.ok) {
      return NextResponse.json({ error: 'Failed to download exported file' }, { status: 502 })
    }

    const fileBuffer = Buffer.from(await fileRes.arrayBuffer())
    const mimeType = format === 'jpg' ? 'image/jpeg' : format === 'pdf' ? 'application/pdf' : 'image/png'
    const extension = format === 'jpg' ? 'jpg' : format === 'pdf' ? 'pdf' : 'png'
    const fileName = `${designTitle.replace(/[^a-zA-Z0-9-_ ]/g, '')}.${extension}`
    const storagePath = `${user.id}/${brandId}/${Date.now()}_${fileName}`

    // Step 5: Upload to Supabase Storage
    const { error: uploadError } = await supabase
      .storage
      .from('media')
      .upload(storagePath, fileBuffer, {
        contentType: mimeType,
        upsert: false,
      })

    if (uploadError) {
      console.error('[canva/import] Storage upload failed:', uploadError)
      return NextResponse.json({ error: 'Failed to upload to storage' }, { status: 500 })
    }

    const { data: publicUrlData } = supabase
      .storage
      .from('media')
      .getPublicUrl(storagePath)

    const fileUrl = publicUrlData.publicUrl

    // Step 6: Create media_items record
    const { data: mediaItem, error: insertError } = await supabase
      .from('media_items')
      .insert({
        user_id: user.id,
        brand_id: brandId,
        file_url: fileUrl,
        file_name: fileName,
        file_type: mimeType,
        file_size_bytes: fileBuffer.length,
        tags: [brand.name.toLowerCase(), 'canva', ...tags],
        source_type: 'import',
        ai_description: `Imported from Canva: ${designTitle}`,
        transcription_status: 'transcribed', // images don't need transcription
        metadata: {
          canva_design_id: designId,
          canva_design_title: designTitle,
          import_format: format,
        },
      })
      .select()
      .single()

    if (insertError) {
      console.error('[canva/import] DB insert failed:', insertError)
      return NextResponse.json({ error: 'Failed to create media record' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      mediaItem: {
        id: mediaItem.id,
        file_url: fileUrl,
        file_name: fileName,
        tags: mediaItem.tags,
      },
    })
  } catch (err) {
    console.error('[canva/import] Error:', err)
    return NextResponse.json({ error: 'Import failed' }, { status: 500 })
  }
}

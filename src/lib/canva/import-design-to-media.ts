import type { SupabaseClient } from '@supabase/supabase-js'
import { getCanvaState } from './status'

const CANVA_BASE_URL = 'https://api.canva.com/rest/v1'

export type CanvaExportFormat = 'png' | 'jpg' | 'pdf'

export type ImportCanvaDesignResult =
  | {
      ok: true
      media: { id: string; fileUrl: string; fileName: string; tags: string[] }
    }
  | { ok: false; error: string; status: number }

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function formatDetails(format: CanvaExportFormat) {
  if (format === 'jpg') return { mimeType: 'image/jpeg', extension: 'jpg' }
  if (format === 'pdf') return { mimeType: 'application/pdf', extension: 'pdf' }
  return { mimeType: 'image/png', extension: 'png' }
}

/**
 * Export a provider-issued Canva design and immediately retain the exported
 * file as a normal NRS media receipt.  Canva's URLs expire; a reviewable
 * carousel cannot depend on an expiring provider link.
 */
export async function importCanvaDesignToMedia({
  supabase,
  userId,
  brandId,
  designId,
  format = 'png',
  tags = [],
}: {
  supabase: SupabaseClient
  userId: string
  brandId: string
  designId: string
  format?: CanvaExportFormat
  tags?: string[]
}): Promise<ImportCanvaDesignResult> {
  const { data: brand } = await supabase
    .from('brands')
    .select('id, name')
    .eq('id', brandId)
    .maybeSingle()
  if (!brand) return { ok: false, status: 404, error: 'Brand not found.' }

  const canva = await getCanvaState(supabase, userId)
  if (canva.state !== 'ready') return { ok: false, status: 409, error: canva.message }

  try {
    const headers = { Authorization: `Bearer ${canva.token}` }
    const designResponse = await fetch(`${CANVA_BASE_URL}/designs/${designId}`, { headers })
    if (!designResponse.ok) {
      return { ok: false, status: 502, error: 'Canva could not retrieve that design for export.' }
    }
    const designPayload = await designResponse.json() as Record<string, unknown>
    const design = designPayload.design as Record<string, unknown> | undefined
    const designTitle = typeof design?.title === 'string'
      ? design.title
      : typeof designPayload.title === 'string'
        ? designPayload.title
        : 'Canva Design'

    const exportResponse = await fetch(`${CANVA_BASE_URL}/exports`, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ design_id: designId, format: { type: format } }),
    })
    if (!exportResponse.ok) {
      return { ok: false, status: 502, error: 'Canva could not start the export. No media was saved.' }
    }
    const exportPayload = await exportResponse.json() as Record<string, unknown>
    const exportJob = exportPayload.job as Record<string, unknown> | undefined
    const exportId = typeof exportJob?.id === 'string'
      ? exportJob.id
      : typeof exportPayload.id === 'string'
        ? exportPayload.id
        : null
    if (!exportId) return { ok: false, status: 502, error: 'Canva did not return an export receipt.' }

    let downloadUrl: string | null = null
    for (let attempt = 0; attempt < 15; attempt++) {
      await sleep(2_000)
      const poll = await fetch(`${CANVA_BASE_URL}/exports/${exportId}`, { headers })
      if (!poll.ok) continue
      const payload = await poll.json() as Record<string, unknown>
      const job = (payload.job ?? payload) as Record<string, unknown>
      const status = job.status
      if (status === 'failed') {
        return { ok: false, status: 502, error: 'Canva export failed. No media was saved.' }
      }
      if (status === 'success' || status === 'completed') {
        const urls = Array.isArray(job.urls) ? job.urls : []
        const first = urls[0]
        downloadUrl = typeof first === 'string'
          ? first
          : first && typeof first === 'object' && typeof (first as Record<string, unknown>).url === 'string'
            ? (first as Record<string, string>).url
            : typeof (job.result as Record<string, unknown> | undefined)?.url === 'string'
              ? (job.result as Record<string, string>).url
              : null
        break
      }
    }
    if (!downloadUrl) return { ok: false, status: 504, error: 'Canva export timed out. No media was saved.' }

    const download = await fetch(downloadUrl)
    if (!download.ok) return { ok: false, status: 502, error: 'NRS could not download Canva’s exported file.' }
    const bytes = Buffer.from(await download.arrayBuffer())
    const { mimeType, extension } = formatDetails(format)
    const safeTitle = designTitle.replace(/[^a-zA-Z0-9-_ ]/g, '').trim() || 'Canva Design'
    const fileName = `${safeTitle}.${extension}`
    const storagePath = `${userId}/${brandId}/${Date.now()}_${fileName}`

    const { error: uploadError } = await supabase.storage.from('media').upload(storagePath, bytes, {
      contentType: mimeType,
      upsert: false,
    })
    if (uploadError) return { ok: false, status: 500, error: 'NRS could not save Canva’s exported file.' }

    const { data: publicUrl } = supabase.storage.from('media').getPublicUrl(storagePath)
    const fileUrl = publicUrl.publicUrl
    const savedTags = [String(brand.name).toLowerCase(), 'canva', ...tags]
    const { data: media, error: insertError } = await supabase
      .from('media_items')
      .insert({
        user_id: userId,
        brand_id: brandId,
        file_url: fileUrl,
        file_name: fileName,
        file_type: mimeType,
        file_size_bytes: bytes.length,
        tags: savedTags,
        source_type: 'import',
        ai_description: `Imported from Canva: ${designTitle}`,
        transcription_status: 'transcribed',
        metadata: {
          canva_design_id: designId,
          canva_design_title: designTitle,
          import_format: format,
        },
      })
      .select('id, file_url, file_name, tags')
      .single()
    if (insertError || !media) return { ok: false, status: 500, error: 'NRS could not save the Canva media receipt.' }

    return {
      ok: true,
      media: {
        id: media.id as string,
        fileUrl: media.file_url as string,
        fileName: media.file_name as string,
        tags: (media.tags ?? []) as string[],
      },
    }
  } catch (error) {
    console.error('[canva/import-design-to-media]', error)
    return { ok: false, status: 500, error: 'Canva import did not complete. No media was saved.' }
  }
}

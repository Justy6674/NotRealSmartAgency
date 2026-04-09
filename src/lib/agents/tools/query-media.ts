import { tool } from 'ai'
import { z } from 'zod/v3'
import type { SupabaseClient } from '@supabase/supabase-js'

function formatDuration(seconds: number | null): string {
  if (!seconds) return ''
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

const STATUS_LABELS: Record<string, string> = {
  pending: 'pending transcription',
  transcribing: 'transcribing...',
  transcribed: 'transcribed',
  captions_generated: 'captions generated',
  failed: 'transcription failed',
}

export function createQueryMediaTool(
  supabase: SupabaseClient,
  userId: string,
  brandId: string
) {
  return tool({
    description:
      'Check the media library for uploaded videos, images, and audio files. Returns each item with its UUID (labelled "ID:"), filename, file type, transcription status, and public URL. When you need to attach media to a post, grab the UUID from this output and pass it to publish_to_social via media_ids (array) or draft_post via media_id (single). NEVER guess or hallucinate a media UUID — always call this tool first to get real IDs.',
    inputSchema: z.object({
      status: z
        .enum(['pending', 'transcribing', 'transcribed', 'failed'])
        .optional()
        .describe('Filter by transcription status'),
      limit: z
        .number()
        .min(1)
        .max(10)
        .default(5)
        .describe('Number of items to show'),
    }),
    execute: async ({ status, limit }) => {
      let query = supabase
        .from('media_items')
        .select('id, file_name, file_url, file_type, duration_seconds, transcription, transcription_status, metadata, created_at')
        .eq('brand_id', brandId)
        .order('created_at', { ascending: false })

      if (status) {
        query = query.eq('transcription_status', status)
      }

      const { data: items, error } = await query.limit(limit)

      if (error) {
        return `Could not fetch media library: ${error.message}`
      }

      if (!items || items.length === 0) {
        const filterNote = status ? ` with status "${status}"` : ''
        return `## Your Media Library\n\nNo media items found${filterNote}. Upload a video or audio file in the Media section, then ask me to process it.`
      }

      const lines: string[] = [`## Your Media Library (${items.length} item${items.length === 1 ? '' : 's'})\n`]

      items.forEach((item, idx) => {
        const name = item.file_name ?? 'Untitled'
        const duration = formatDuration(item.duration_seconds as number | null)
        const itemStatus = item.transcription_status as string
        const statusLabel = STATUS_LABELS[itemStatus] ?? itemStatus
        const statusIcon = itemStatus === 'transcribed' || itemStatus === 'captions_generated' ? ' ✓' : ''
        const fileUrl = item.file_url as string | null
        const fileType = (item.file_type as string | null) ?? 'unknown'
        const metadata = (item.metadata as Record<string, unknown>) ?? {}
        const tags = metadata.tags as string[] | undefined
        const visualAnalysis = metadata.visual_analysis as
          | { summary?: string; scenes?: string[]; products?: string[]; mood?: string }
          | undefined

        let line = `${idx + 1}. **${name}** (${fileType})`
        if (duration) line += ` — ${duration}`
        line += `, ${statusLabel}${statusIcon}`
        if (tags?.length) line += ` [${tags.join(', ')}]`
        lines.push(line)
        // CRITICAL: always include the UUID so callers can attach this media to posts.
        // Without this line, the Director hallucinates IDs when asked to publish media.
        lines.push(`   ID: \`${item.id}\``)
        if (fileUrl) lines.push(`   URL: ${fileUrl}`)

        // Visual analysis summary (if previously run via /api/media/[id]/analyze)
        // so creation sessions don't need to re-call Claude multimodal vision.
        if (visualAnalysis?.summary) {
          lines.push(`   Scene: ${visualAnalysis.summary}`)
          if (visualAnalysis.products?.length) {
            lines.push(`   Products visible: ${visualAnalysis.products.join(', ')}`)
          }
          if (visualAnalysis.mood) {
            lines.push(`   Mood: ${visualAnalysis.mood}`)
          }
        }

        // Show transcription preview for transcribed items
        const transcription = item.transcription as string | null
        if (transcription) {
          const preview = transcription.length > 100
            ? `"${transcription.slice(0, 100)}..."`
            : `"${transcription}"`
          lines.push(`   ${preview}`)
        }

        lines.push('')
      })

      // Helpful prompt
      const pending = items.filter((i) => i.transcription_status === 'pending').length
      const transcribed = items.filter((i) => i.transcription_status === 'transcribed').length

      if (pending > 0) {
        lines.push(`${pending} item${pending === 1 ? '' : 's'} waiting to be transcribed. Want me to process ${pending === 1 ? 'it' : 'them'}?`)
      } else if (transcribed > 0) {
        lines.push('Want me to generate captions or repurpose any of these into social content?')
      } else {
        lines.push('Want me to process or repurpose any of these?')
      }

      return lines.join('\n')
    },
  })
}

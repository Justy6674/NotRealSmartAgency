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
      'Check the media library for uploaded videos and audio files. Shows transcription status and previews. Use this when the user asks about their media, videos, or uploaded content.',
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
        const tags = (item.metadata as Record<string, unknown>)?.tags as string[] | undefined

        let line = `${idx + 1}. **${name}**`
        if (duration) line += ` — ${duration}`
        line += `, ${statusLabel}${statusIcon}`
        if (tags?.length) line += ` [${tags.join(', ')}]`
        lines.push(line)
        if (fileUrl) lines.push(`   URL: ${fileUrl}`)

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

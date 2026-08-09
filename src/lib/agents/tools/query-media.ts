import { tool } from 'ai'
import { userSafeError } from '@/lib/errors/user-safe'
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
  brandId: string,
) {
  return tool({
    description:
      'Check the media library for uploaded videos, images, and audio files. Returns each item with its UUID (labelled "ID:"), filename, file type, transcription status, public URL, AI description, tags, and (in analysis mode) the full transcription. When you need to attach media to a post, grab the UUID from this output and pass it to publish_to_social via media_ids (array) or draft_post via media_id (single). Supply media_ids when the owner attached files to this turn: that is the only safe way to analyse those exact files rather than a similarly named older upload. NEVER guess or hallucinate a media UUID — always call this tool first to get real IDs. Use mode="analysis" for strategic content reviews — it returns the FULL transcription and AI description so you can analyse the actual content of each item, not just the filename.',
    inputSchema: z.object({
      media_ids: z
        .array(z.string().uuid())
        .min(1)
        .max(10)
        .optional()
        .describe('Exact media item IDs to inspect. Use this for files attached to the current owner request.'),
      status: z
        .enum(['pending', 'transcribing', 'transcribed', 'failed'])
        .optional()
        .describe('Filter by transcription status'),
      limit: z
        .number()
        .min(1)
        .max(20)
        .default(5)
        .describe('Number of items to show'),
      mode: z
        .enum(['list', 'analysis'])
        .default('list')
        .describe('list = compact summary with 100-char transcript snippet (default). analysis = full transcript + ai_description + all tags so the Director can do strategic content review.'),
    }),
    execute: async ({ media_ids: mediaIds, status, limit, mode }) => {
      let query = supabase
        .from('media_items')
        .select(
          // Top-level columns the consolidated pipeline writes:
          //   tags (text[]), ai_description (text), thumbnail_url, transcription,
          //   transcription_status, duration_seconds, file_size_bytes
          // metadata.processing is the new per-stage report; metadata.visual_analysis
          // is the legacy shape that some pre-pipeline rows still have. Both are
          // surfaced below.
          'id, file_name, file_url, file_type, file_size_bytes, duration_seconds, thumbnail_url, transcription, transcription_status, ai_description, tags, metadata, created_at',
        )
        .eq('brand_id', brandId)
        .order('created_at', { ascending: false })

      if (mediaIds?.length) {
        query = query.in('id', mediaIds)
      }

      if (status) {
        query = query.eq('transcription_status', status)
      }

      // A current Mini App attachment turn names the exact files to inspect.
      // Never let the ordinary browse default hide files 6–10 of that set.
      const effectiveLimit = mediaIds?.length ?? limit
      const { data: items, error } = await query.limit(effectiveLimit)

      if (error) {
        return userSafeError('query-media', error, 'Could not read the media library just now. Try again in a moment.')
      }

      if (!items || items.length === 0) {
        const filterNote = status ? ` with status "${status}"` : ''
        return `## Your Media Library\n\nNo media items found${filterNote}. Upload a video or audio file in the Media section, then ask me to process it.`
      }

      const isAnalysisMode = mode === 'analysis'

      const lines: string[] = [
        `## Your Media Library (${items.length} item${items.length === 1 ? '' : 's'}${isAnalysisMode ? ' — analysis mode' : ''})\n`,
      ]

      if (isAnalysisMode) {
        lines.push(
          '> Strategic content review mode. Each item below includes the full transcription and AI description so you can analyse the actual content — NOT just the filename. Apply the brand strategy and target audience when recommending what to use.\n',
        )
      }

      items.forEach((item, idx) => {
        const name = item.file_name ?? 'Untitled'
        const fileType = (item.file_type as string | null) ?? 'unknown'
        const duration = formatDuration(item.duration_seconds as number | null)
        const itemStatus = item.transcription_status as string
        const statusLabel = STATUS_LABELS[itemStatus] ?? itemStatus
        const statusIcon =
          itemStatus === 'transcribed' || itemStatus === 'captions_generated' ? ' ✓' : ''
        const sizeBytes = item.file_size_bytes as number | null
        const sizeLabel = sizeBytes ? `${(sizeBytes / 1024 / 1024).toFixed(1)}MB` : null

        // Top-level columns from the consolidated pipeline
        const aiDescription = item.ai_description as string | null
        const tags = (item.tags as string[] | null) ?? []
        const transcription = item.transcription as string | null

        // Legacy fallback — some rows pre-pipeline used metadata.visual_analysis
        // and metadata.tags. Keep both paths working until those rows are
        // backfilled.
        const metadata = (item.metadata as Record<string, unknown>) ?? {}
        const legacyVisual = metadata.visual_analysis as
          | { summary?: string; scenes?: string[]; products?: string[]; mood?: string }
          | undefined
        const legacyTags = metadata.tags as string[] | undefined
        const allTags = [...new Set([...tags, ...(legacyTags ?? [])])]

        // Header line
        let header = `### ${idx + 1}. ${name}`
        lines.push(header)
        const sublineBits: string[] = [fileType]
        if (duration) sublineBits.push(duration)
        if (sizeLabel) sublineBits.push(sizeLabel)
        sublineBits.push(`${statusLabel}${statusIcon}`)
        lines.push(sublineBits.join(' · '))

        // CRITICAL: always include the UUID so callers can attach this media to posts.
        // Without this line, the Director hallucinates IDs when asked to publish media.
        lines.push(`ID: \`${item.id}\``)
        if (item.file_url) lines.push(`URL: ${item.file_url}`)
        if (allTags.length) lines.push(`Tags: ${allTags.join(', ')}`)

        // AI description — top-level column populated by the pipeline's AI stage
        // (Claude vision for images, Claude transcript analysis for video/audio).
        if (aiDescription) {
          lines.push(`**What's in it (AI):** ${aiDescription}`)
        }

        // Legacy visual_analysis fallback for pre-pipeline rows
        if (legacyVisual?.summary) {
          lines.push(`**What's in it (legacy):** ${legacyVisual.summary}`)
          if (legacyVisual.products?.length) {
            lines.push(`Products visible: ${legacyVisual.products.join(', ')}`)
          }
          if (legacyVisual.mood) {
            lines.push(`Mood: ${legacyVisual.mood}`)
          }
        }

        // Transcription — short snippet in list mode, full text in analysis mode
        if (transcription) {
          if (isAnalysisMode) {
            // Full transcript so the Director can do strategic content analysis.
            // Cap at 4000 chars to keep tokens reasonable; that's ~750 words,
            // enough for any single-video content review.
            const text =
              transcription.length > 4000 ? transcription.slice(0, 4000) + '... [truncated]' : transcription
            lines.push(`**Transcript:**`)
            lines.push(`${text}`)
          } else {
            const preview =
              transcription.length > 100 ? `"${transcription.slice(0, 100)}..."` : `"${transcription}"`
            lines.push(`Transcript snippet: ${preview}`)
          }
        }

        if (!aiDescription && !legacyVisual?.summary && !transcription) {
          lines.push(
            '_No AI description or transcript yet — call /api/media/process for this item to populate them._',
          )
        }

        lines.push('')
      })

      // Helpful prompt
      const pending = items.filter((i) => i.transcription_status === 'pending').length
      const transcribed = items.filter(
        (i) => i.transcription_status === 'transcribed' || i.transcription_status === 'captions_generated',
      ).length

      if (isAnalysisMode) {
        lines.push(
          `Now apply the brand strategy: which items align with the content pillars, what story angle pairs with the actual content, and which combinations would resonate with the target audience? Recommend specifically — name the items by ID and explain WHY based on what's actually in them, not their filenames.`,
        )
      } else if (pending > 0) {
        lines.push(
          `${pending} item${pending === 1 ? '' : 's'} waiting to be transcribed. Want me to process ${pending === 1 ? 'it' : 'them'}?`,
        )
      } else if (transcribed > 0) {
        lines.push('Want me to generate captions or repurpose any of these into social content?')
      } else {
        lines.push('Want me to process or repurpose any of these?')
      }

      // Mark userId as intentionally unused — query is brand-scoped via brandId
      // and the surrounding RLS policies enforce ownership.
      void userId

      return lines.join('\n')
    },
  })
}

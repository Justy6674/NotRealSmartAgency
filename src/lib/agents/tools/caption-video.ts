/**
 * Burn captions into a video, on request.
 *
 * On request rather than automatically, because captions change how a video
 * looks and that is the owner's call, not ours. But it is one sentence to ask
 * for — "add captions to that clip" — because the alternative on offer
 * everywhere else is exporting the file, running it through a separate tool,
 * and re-uploading it, which is how a clip ends up posted without them.
 *
 * The words and their timings were already captured when the clip was
 * transcribed. Nothing is re-listened to and nothing is guessed: if a word was
 * not heard, it does not appear.
 */

import { tool } from 'ai'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { burnSubtitlesFromUrl } from '@/lib/video/burn-subtitles'
import { buildCues } from '@/lib/video/subtitles'
import type { TranscriptionWord } from '@/lib/transcription/transcribe'

interface CaptionRecord {
  url: string
  bytes: number
  cues: number
  created_at: string
}

export function createCaptionVideoTool(brandId: string, userId: string) {
  return tool({
    description:
      'Burn subtitles into a video that has already been transcribed. Use when the owner asks for'
      + ' captions, subtitles or "words on screen". Social platforms only caption videos posted'
      + ' from inside their own app — a video scheduled through a tool arrives with none, and most'
      + ' of the audience is watching on mute. Returns the URL of the captioned copy; the original'
      + ' is left untouched. Say honestly if the clip has no speech in it.',
    inputSchema: z.object({
      media_item_id: z.string().describe('The video to caption. It must already be transcribed.'),
    }),
    execute: async ({ media_item_id }) => {
      const supabase = createAdminClient()

      const { data: item, error: readError } = await supabase
        .from('media_items')
        .select('id, file_url, file_type, metadata')
        .eq('id', media_item_id)
        .eq('brand_id', brandId)
        .eq('user_id', userId)
        .maybeSingle()

      if (readError) return { error: 'That clip could not be read from the library.' }
      if (!item) return { error: 'That clip is not in this project.' }
      if (!item.file_type?.startsWith('video/')) {
        return { error: 'Captions only apply to video. That one is not a video.' }
      }

      const metadata = (item.metadata ?? {}) as Record<string, unknown>

      // Already done — re-burning costs minutes and a generation of quality.
      const existing = metadata.captioned as CaptionRecord | undefined
      if (existing?.url) {
        return {
          already_done: true,
          url: existing.url,
          cues: existing.cues,
          note: 'This clip is already captioned. That version is the one that will publish.',
        }
      }

      const words = metadata.transcript_words as TranscriptionWord[] | undefined
      if (!Array.isArray(words) || words.length === 0) {
        return {
          error:
            'That clip has no word timings stored, so there is nothing to caption from. Ask for it'
            + ' to be transcribed first — and if it has no speech in it, captions are not possible.',
        }
      }

      let result
      try {
        result = await burnSubtitlesFromUrl(item.file_url, words)
      } catch (error) {
        console.error(`[caption_video:${media_item_id}]`, error)
        return { error: 'The captions could not be rendered. The original clip is untouched.' }
      }

      const pathMatch = new URL(item.file_url).pathname
        .match(/\/storage\/v1\/object\/public\/media\/(.+)$/)
      if (!pathMatch) return { error: 'That clip is not stored where captions can be written beside it.' }
      const captionedPath = `${decodeURIComponent(pathMatch[1])}_captioned.mp4`

      const { error: uploadError } = await supabase.storage
        .from('media')
        .upload(captionedPath, result.buffer, { contentType: 'video/mp4', upsert: true })
      if (uploadError) {
        console.error(`[caption_video:${media_item_id}] upload`, uploadError)
        return { error: 'The captions rendered but could not be saved. Nothing was changed.' }
      }

      const { data: publicUrl } = supabase.storage.from('media').getPublicUrl(captionedPath)
      const record: CaptionRecord = {
        url: publicUrl.publicUrl,
        bytes: result.bytes,
        cues: result.cueCount,
        created_at: new Date().toISOString(),
      }

      const { error: writeError } = await supabase
        .from('media_items')
        .update({ metadata: { ...metadata, captioned: record } })
        .eq('id', media_item_id)

      if (writeError) {
        // The file exists but nothing points at it, so publishing would still
        // send the uncaptioned original. Say so rather than report success.
        console.error(`[caption_video:${media_item_id}] metadata`, writeError)
        return { error: 'The captions rendered but could not be attached to the clip. Try again.' }
      }

      return {
        url: record.url,
        cues: record.cues,
        // The full text back, so a misheard brand or fragrance name can be
        // spotted here rather than after it is published.
        lines: buildCues(words).map((cue) => cue.text),
        note:
          'Captioned. This version is what will publish now. Read the lines back — anything'
          + ' misheard needs fixing before this goes out.',
      }
    },
  })
}

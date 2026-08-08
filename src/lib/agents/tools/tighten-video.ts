/**
 * Cut the dead air out of a clip, on request.
 *
 * The clip that never gets posted is rarely a bad clip. It is four seconds of
 * finding the record button, two-second gaps between thoughts, and an arm
 * reaching back for the phone — ten minutes of work in an editor nobody opens.
 * Scheduled and slightly rough beats polished and a fortnight late.
 */

import { tool } from 'ai'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { refreshDraftMedia } from '@/lib/mixpost/refresh-draft-media'
import { tightenFromUrl } from '@/lib/video/tighten-video'
import type { TranscriptionWord } from '@/lib/transcription/transcribe'

export interface TightenedRecord {
  url: string
  bytes: number
  cuts: number
  seconds_removed: number
  /** On the tightened clip's clock — captions burnt later must use these. */
  words: TranscriptionWord[]
  created_at: string
}

export function createTightenVideoTool(brandId: string, userId: string) {
  return tool({
    description:
      'Remove dead air from a transcribed video — the fumbling at the start, the long gaps between'
      + ' sentences, the reach for the phone at the end. Use when the owner says a clip is too long,'
      + ' rambling, slow, or asks to tighten or trim it. Natural conversational pauses are kept;'
      + ' only real dead air goes. The original is never touched. Report how much came off.',
    inputSchema: z.object({
      media_item_id: z.string().describe('The video to tighten. It must already be transcribed.'),
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
        return { error: 'That one is not a video.' }
      }

      const metadata = (item.metadata ?? {}) as Record<string, unknown>

      const existing = metadata.tightened as TightenedRecord | undefined
      if (existing?.url) {
        return {
          already_done: true,
          url: existing.url,
          seconds_removed: existing.seconds_removed,
          note: 'This clip is already tightened. That version is the one that will publish.',
        }
      }

      // Captions are burnt into the picture, so they cannot be re-timed
      // afterwards. Tightening a captioned clip would leave the words on
      // screen belonging to sentences that are no longer where they were.
      if ((metadata.captioned as { url?: string } | undefined)?.url) {
        return {
          error:
            'This clip already has captions burnt in, so it cannot be tightened without the words'
            + ' going out of sync. Tighten first, then caption — say so and it can be redone from'
            + ' the original.',
        }
      }

      const words = metadata.transcript_words as TranscriptionWord[] | undefined
      if (!Array.isArray(words) || words.length === 0) {
        return {
          error:
            'That clip has no word timings stored, so there is no way to tell speech from silence.'
            + ' Ask for it to be transcribed first.',
        }
      }

      let result
      try {
        result = await tightenFromUrl(item.file_url, words)
      } catch (error) {
        const message = error instanceof Error ? error.message : ''
        if (message.includes('not enough dead air')) {
          return {
            no_change: true,
            note: 'That clip is already tight — there is not enough dead air in it to be worth'
              + ' re-encoding. Left as it is.',
          }
        }
        console.error(`[tighten_video:${media_item_id}]`, error)
        return { error: 'The clip could not be tightened. The original is untouched.' }
      }

      const pathMatch = new URL(item.file_url).pathname
        .match(/\/storage\/v1\/object\/public\/media\/(.+)$/)
      if (!pathMatch) return { error: 'That clip is not stored where an edit can be written beside it.' }
      const tightenedPath = `${decodeURIComponent(pathMatch[1])}_tight.mp4`

      const { error: uploadError } = await supabase.storage
        .from('media')
        .upload(tightenedPath, result.buffer, { contentType: 'video/mp4', upsert: true })
      if (uploadError) {
        console.error(`[tighten_video:${media_item_id}] upload`, uploadError)
        return { error: 'The edit rendered but could not be saved. Nothing was changed.' }
      }

      const { data: publicUrl } = supabase.storage.from('media').getPublicUrl(tightenedPath)
      const record: TightenedRecord = {
        url: publicUrl.publicUrl,
        bytes: result.bytes,
        cuts: result.plan.cuts,
        seconds_removed: Math.round(result.plan.secondsRemoved * 10) / 10,
        words: result.words,
        created_at: new Date().toISOString(),
      }

      const { error: writeError } = await supabase
        .from('media_items')
        .update({ metadata: { ...metadata, tightened: record } })
        .eq('id', media_item_id)

      if (writeError) {
        console.error(`[tighten_video:${media_item_id}] metadata`, writeError)
        return { error: 'The edit rendered but could not be attached to the clip. Try again.' }
      }

      const refreshed = await refreshDraftMedia({ oldUrl: item.file_url, newUrl: record.url })
        .catch(() => ({ updated: 0, failed: 1, noneFound: false }))

      return {
        url: record.url,
        cuts: record.cuts,
        drafts_updated: refreshed.updated,
        seconds_removed: record.seconds_removed,
        was: Math.round(result.plan.originalSeconds),
        now: Math.round(result.plan.tightenedSeconds),
        note:
          `Cut ${record.seconds_removed}s of dead air across ${record.cuts} edit`
          + `${record.cuts === 1 ? '' : 's'} — ${Math.round(result.plan.originalSeconds)}s down to`
          + ` ${Math.round(result.plan.tightenedSeconds)}s. This version is what will publish now.`
          + (refreshed.noneFound ? ''
            : refreshed.failed > 0
              ? ` WARNING: ${refreshed.failed} existing draft(s) still hold the ORIGINAL and could`
                + ' not be updated — say so plainly.'
              : ` ${refreshed.updated} existing draft(s) updated.`)
          + ' Worth watching back before it goes out.',
      }
    },
  })
}

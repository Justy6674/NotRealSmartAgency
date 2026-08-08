/**
 * Running the conversation a video starts.
 *
 * The step machine in `video-brief.ts` decides WHAT is asked and in what
 * order; this puts the words on the screen, reads the answers back, and stops
 * when there is enough to write from.
 *
 * Questions and answers are written as ordinary Director jobs, so they appear
 * in the one timeline in the right place with no special rendering. A question
 * NRS asks on its own has no owner message attached to it, which is already
 * how an internal directive is stored — the timeline shows the answer without
 * inventing a question the owner never typed.
 */

import { generateText, generateObject } from 'ai'
import { z } from 'zod'
import type { SupabaseClient } from '@supabase/supabase-js'
import { gateway } from '@ai-sdk/gateway'
import { getGatewayModel, getGatewayProviderOptions } from '@/lib/ai/model-routing'
import { resolveMentions, mentionsPrompt } from '@/lib/products/transcript-mentions'
import { connectedAccounts, platformNames } from '@/lib/mixpost/connected-platforms'
import { canCaption } from '@/lib/video/subtitles'
import { proposeAndStore } from './mini-app-proposal'
import { createCaptionVideoTool } from '@/lib/agents/tools/caption-video'
import { createTightenVideoTool } from '@/lib/agents/tools/tighten-video'
import {
  startBrief, currentStep, isOpen, applyAnswer, stalled, stepBrief, reaskBrief,
  type BriefState,
} from './video-brief'
import type { TranscriptionWord } from '@/lib/transcription/transcribe'

/** The clip whose conversation is still open, if any. */
export interface OpenBrief {
  mediaItemId: string
  state: BriefState
  metadata: Record<string, unknown>
}

/**
 * Find the clip currently being talked about.
 *
 * The most recent one with an unfinished brief. Uploading a second clip before
 * finishing the first moves the conversation to the second — which is what a
 * person means by sending it, and stops a stale half-answered brief from
 * swallowing replies meant for the new one.
 */
export async function findOpenBrief(
  admin: SupabaseClient,
  userId: string,
  brandId: string,
): Promise<OpenBrief | null> {
  const { data } = await admin
    .from('media_items')
    .select('id, metadata')
    .eq('user_id', userId)
    .eq('brand_id', brandId)
    .order('created_at', { ascending: false })
    .limit(5)

  for (const row of data ?? []) {
    const metadata = (row.metadata ?? {}) as Record<string, unknown>
    const state = metadata.brief as BriefState | undefined
    if (state?.mediaItemId && isOpen(state)) {
      return { mediaItemId: row.id as string, state, metadata }
    }
  }
  return null
}

/** Everything the wording needs, read once. */
async function briefContext(
  admin: SupabaseClient,
  brandId: string,
  mediaItemId: string,
): Promise<{
  summary: string
  canCaption: boolean
  platforms: string[]
  brandName: string
  productRules: string | null
  transcript: string | null
}> {
  const [{ data: media }, { data: brand }] = await Promise.all([
    admin.from('media_items').select('transcription, metadata').eq('id', mediaItemId).maybeSingle(),
    admin.from('brands').select('id, name, slug, name_full, name_never, social_urls')
      .eq('id', brandId).maybeSingle(),
  ])

  const transcript = typeof media?.transcription === 'string' ? media.transcription : null
  const metadata = (media?.metadata ?? {}) as Record<string, unknown>
  const words = metadata.transcript_words as TranscriptionWord[] | undefined

  const ownNames = [
    brand?.name, brand?.name_full,
    ...(Array.isArray(brand?.name_never) ? (brand.name_never as string[]) : []),
  ].filter((name): name is string => typeof name === 'string' && name.length > 0)

  const [mentions, accounts] = await Promise.all([
    resolveMentions(transcript, ownNames),
    brand
      ? connectedAccounts({
        id: brand.id as string,
        name: brand.name as string,
        slug: brand.slug as string,
        social_urls: (brand.social_urls ?? {}) as Record<string, string>,
      }).catch(() => [])
      : Promise.resolve([]),
  ])

  return {
    summary: transcript?.slice(0, 2200) ?? '',
    canCaption: canCaption(words),
    platforms: platformNames(accounts),
    brandName: (brand?.name as string) ?? 'this brand',
    productRules: mentionsPrompt(mentions),
    transcript,
  }
}

/** Write one message from NRS into the conversation. */
async function say(
  admin: SupabaseClient,
  { userId, brandId, text }: { userId: string; brandId: string; text: string },
): Promise<void> {
  await admin.from('mcp_jobs').insert({
    user_id: userId,
    brand_id: brandId,
    channel: 'telegram',
    api_key_id: null,
    job_type: 'director_chat',
    status: 'done',
    // No owner message: NRS spoke first. The timeline already knows not to
    // draw an empty bubble for a question nobody asked.
    input: { brand_id: brandId, message: '' },
    result: { response: text },
    completed_at: new Date().toISOString(),
  })
}

/** Ask the model for the wording, given a brief it must not exceed. */
async function compose(instruction: string, context: {
  brandName: string
  productRules: string | null
}): Promise<string> {
  const { text } = await generateText({
    model: gateway(getGatewayModel('fast')),
    providerOptions: getGatewayProviderOptions('fast', { tags: ['video-brief'] }),
    prompt: [
      `You are the NRS Director talking to the owner of ${context.brandName} in a chat.`,
      'Australian English. No greeting, no emoji, no hashtags, no sign-off. Under 55 words.',
      'Ask exactly ONE question and nothing else — the owner answers on a phone, often one-handed.',
      ...(context.productRules ? ['', context.productRules] : []),
      '',
      instruction,
    ].join('\n'),
  })
  return text.trim()
}

/**
 * Start the conversation for a freshly uploaded clip.
 *
 * Nothing is written yet. The old behaviour produced a finished caption here,
 * before anyone had said what the video was for or where it was going, so the
 * only options were to accept it or complain.
 */
export async function startVideoBrief({
  admin, userId, brandId, mediaItemId,
}: {
  admin: SupabaseClient
  userId: string
  brandId: string
  mediaItemId: string
}): Promise<void> {
  const context = await briefContext(admin, brandId, mediaItemId)
  const state = startBrief(mediaItemId, new Date().toISOString())

  const { data: row } = await admin
    .from('media_items').select('metadata').eq('id', mediaItemId).maybeSingle()
  await admin.from('media_items')
    .update({ metadata: { ...((row?.metadata ?? {}) as Record<string, unknown>), brief: state } })
    .eq('id', mediaItemId)

  const instruction = stepBrief('captions', context)
  if (!instruction) return
  await say(admin, { userId, brandId, text: await compose(instruction, context) })
}

/**
 * Read one reply and either ask the next question or write the copy.
 *
 * Returns false when there was no open brief, so the caller hands the message
 * to the Director as normal. A brief must never swallow a message that had
 * nothing to do with it.
 */
export async function advanceVideoBrief({
  admin, userId, brandId, message,
}: {
  admin: SupabaseClient
  userId: string
  brandId: string
  message: string
}): Promise<{ handled: boolean; reply?: string }> {
  const open = await findOpenBrief(admin, userId, brandId)
  if (!open) return { handled: false }

  const context = await briefContext(admin, brandId, open.mediaItemId)
  const step = currentStep(open.state)

  const answer = await interpret(step, message, context.platforms)
  const next = applyAnswer(open.state, answer)

  await admin.from('media_items')
    .update({ metadata: { ...open.metadata, brief: next } })
    .eq('id', open.mediaItemId)

  // Nothing in the reply answered the question — deal with what he actually
  // said, then put the same one again rather than marching on.
  if (stalled(open.state, next)) {
    return { handled: true, reply: await compose(reaskBrief(step, message), context) }
  }

  // Do the video work the moment it is agreed, not at the end. It takes
  // minutes on a long clip, and the next two questions are being answered
  // anyway — by the time the copy is written the file is ready.
  if (step === 'captions' && (next.trim || next.captions)) {
    void runVideoWork({
      admin, userId, brandId,
      mediaItemId: open.mediaItemId,
      trim: Boolean(next.trim),
      captions: Boolean(next.captions),
    })
  }

  const following = currentStep(next)
  if (following === 'writing') {
    return { handled: true, reply: await writeCopy(admin, { userId, brandId, state: next, context }) }
  }

  const instruction = stepBrief(following, context)
  if (!instruction) return { handled: true, reply: 'Ready when you are.' }
  return { handled: true, reply: await compose(instruction, context) }
}

/**
 * Call a Director tool directly, outside a model turn.
 *
 * These are the same tools the Director uses; nothing new is written to do the
 * work, so there is only one implementation to keep right. A thrown error is
 * turned into the tool's own shape rather than escaping, because this runs
 * detached and an unhandled rejection here would take down the request.
 */
async function runTool(
  built: unknown,
  mediaItemId: string,
  callId: string,
): Promise<Record<string, unknown> | undefined> {
  const execute = (built as {
    execute?: (args: Record<string, unknown>, options: unknown) => Promise<unknown>
  }).execute
  if (!execute) return { error: 'tool has no implementation' }

  try {
    const value = await execute({ media_item_id: mediaItemId }, { toolCallId: callId, messages: [] })
    return (value ?? {}) as Record<string, unknown>
  } catch (error) {
    console.error(`[video-brief:${callId}]`, error)
    return { error: String(error) }
  }
}

/**
 * Trim, then caption, then say what actually happened.
 *
 * The order is not a preference. Cutting the video moves every later word
 * earlier, so captions burnt from the original timings drift further out with
 * every cut — and the drift grows through the clip, so the first few seconds
 * look fine. Trimming stores re-timed words and captioning uses them.
 *
 * A failure is reported in the chat rather than swallowed. Silently publishing
 * a video without the captions someone asked for is the worst of the options
 * available, because it looks like it worked.
 */
async function runVideoWork({
  admin, userId, brandId, mediaItemId, trim, captions,
}: {
  admin: SupabaseClient
  userId: string
  brandId: string
  mediaItemId: string
  trim: boolean
  captions: boolean
}): Promise<void> {
  const done: string[] = []
  const failed: string[] = []

  if (trim) {
    const result = await runTool(createTightenVideoTool(brandId, userId), mediaItemId, 'brief-trim')
    if (result?.error) failed.push('cutting the dead air')
    else if (result?.no_change) done.push('nothing worth cutting — it is already tight')
    else if (typeof result?.seconds_removed === 'number') {
      done.push(`cut ${result.seconds_removed}s of dead air`)
    }
  }

  if (captions) {
    const result = await runTool(createCaptionVideoTool(brandId, userId), mediaItemId, 'brief-caption')
    if (result?.error) failed.push('burning the captions in')
    else if (typeof result?.cues === 'number') done.push(`captioned it — ${result.cues} lines`)
  }

  if (done.length === 0 && failed.length === 0) return
  const parts = [
    done.length > 0 ? `Done on the video: ${done.join(', ')}.` : null,
    failed.length > 0
      ? `I could not manage ${failed.join(' or ')} — the original is untouched, and the post can`
        + ' still go out without it. Say if you want me to try again.'
      : null,
  ].filter(Boolean)
  await say(admin, { userId, brandId, text: parts.join(' ') })
}

/** Turn a free-text reply into the one field the current step is waiting on. */
async function interpret(
  step: ReturnType<typeof currentStep>,
  message: string,
  platforms: readonly string[],
): Promise<{ captions?: boolean; trim?: boolean; feel?: string; platforms?: string[] }> {
  if (step === 'feel') {
    // Free text IS the answer here. Sending it to a model to be "extracted"
    // would only lose the owner's own words, which are the whole point.
    return { feel: message }
  }

  try {
    const { object } = await generateObject({
      model: gateway(getGatewayModel('fast')),
      providerOptions: getGatewayProviderOptions('fast', { tags: ['video-brief-parse'] }),
      schema: step === 'captions'
        ? z.object({
          captions: z.boolean().nullable()
            .describe('Words burnt onto the screen. null only if the reply does not address it.'),
          trim: z.boolean().nullable()
            .describe('Cutting the dead air. null only if the reply does not address it.'),
        })
        : z.object({
          platforms: z.array(z.string()).describe(`Any of: ${platforms.join(', ')}. Empty if unclear.`),
        }),
      prompt: step === 'captions'
        ? 'Two things were offered: burning captions onto the video, and cutting the dead air out'
          + ' of it. Which does this reply want? "Both", "yes", "do it" means both. "Just captions"'
          + ' means captions yes, trim no. "Neither" or "no" means both no. Use null for a thing'
          + ` the reply genuinely does not address. Reply: "${message}"`
        : `Which of these does the reply choose: ${platforms.join(', ')}? "All", "all of them" or`
          + ` "everywhere" means every one of them. Return only names from that list.`
          + ` Reply: "${message}"`,
    })

    if (step === 'captions') {
      const { captions, trim } = object as { captions: boolean | null; trim: boolean | null }
      if (captions === null && trim === null) return {}
      return { captions: captions ?? false, trim: trim ?? false }
    }
    const chosen = (object as { platforms: string[] }).platforms
      .filter((name) => platforms.some((known) => known.toLowerCase() === name.toLowerCase()))
    return chosen.length > 0 ? { platforms: chosen } : {}
  } catch {
    // A parse failure must not look like an answer, or the question is skipped
    // and never asked again.
    return {}
  }
}

/**
 * Write the copy, now that there is something to write from.
 *
 * The feel and the platforms go in as the angle, so Content & Copy is told
 * what the post is for rather than guessing — which is the whole reason for
 * the four questions before it.
 */
async function writeCopy(
  admin: SupabaseClient,
  { userId, brandId, state, context }: {
    userId: string
    brandId: string
    state: BriefState
    context: Awaited<ReturnType<typeof briefContext>>
  },
): Promise<string> {
  const platforms = state.platforms ?? context.platforms
  const angle = [
    state.feel ? `Feel the owner asked for: ${state.feel}` : null,
    `Going to: ${platforms.join(', ')}`,
    state.captions ? 'Captions are being burnt into the video.' : null,
  ].filter(Boolean).join('. ')

  const stored = await proposeAndStore({
    supabase: admin,
    userId,
    brandId,
    mediaItemId: state.mediaItemId,
    fileName: '',
    angle,
    ...(platforms[0] ? { platform: platformKey(platforms[0]) } : {}),
  })

  const { data: row } = await admin
    .from('media_items').select('metadata').eq('id', state.mediaItemId).maybeSingle()
  await admin.from('media_items').update({
    metadata: {
      ...((row?.metadata ?? {}) as Record<string, unknown>),
      brief: { ...state, proposedOutputId: stored?.outputId ?? 'failed' },
    },
  }).eq('id', state.mediaItemId)

  if (!stored) {
    return 'I could not get the copy written just then. Say "try again" and I will have another go —'
      + ' nothing has been lost, and your answers are still here.'
  }
  return `Here it is for ${platforms.join(', ')}. Edit anything straight in the box, or tell me`
    + ' what to change. Say approve and it goes to Mixpost as a draft.'
}

/** Mixpost speaks in lower-case provider names. */
function platformKey(label: string): string {
  const key = label.toLowerCase()
  return key === 'x' ? 'twitter' : key
}

import { generateText } from 'ai'
import { gateway } from '@ai-sdk/gateway'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createProposePostTool } from '@/lib/agents/tools/propose-post'
import { getGatewayModel, getGatewayProviderOptions } from '@/lib/ai/model-routing'

/**
 * Take the first pass at a post the moment a clip has finished transcribing.
 *
 * The point is that nothing arrives as a blank box. A clip uploaded from the
 * Mini App comes back already carrying a hook and a caption, so the owner (or
 * Hermes over MCP) has something to react to rather than something to start.
 *
 * A proposal is deliberately NOT a draft. `createDraftPost` is the one place a
 * draft is born and it pushes to Mixpost as it does so — which is exactly what
 * should not happen to a first pass nobody has read yet. So this writes an
 * `outputs` row with `is_approved: false` instead, and Mixpost only hears about
 * it once the copy has been agreed and something calls `draft_post`.
 *
 * Persisting matters for a second reason: `propose_post_from_media` returns its
 * proposal into the conversation and stores nothing. A proposal that lives only
 * in a chat turn cannot be listed, cannot be reopened, and cannot be seen by
 * Hermes at all.
 */

/** Content & Copy writes for one platform at a time; this is the first pass. */
const FIRST_PASS_PLATFORM = 'instagram'

export interface StoredProposal {
  outputId: string
  hook: string
  caption: string
  hashtags: string[]
  postType: string
  rationale: string
  /** What the Director says when it comes back, before the draft itself. */
  opener: string
}

/**
 * Open the conversation instead of dropping a card.
 *
 * A proposal appearing silently in a list reads as nothing having happened —
 * the owner sat watching a screen twice wondering whether his video had gone
 * anywhere. So the Director says what it watched and offers the obvious next
 * move, in his words, and he answers in the box.
 *
 * Written from the transcript rather than the caption: the point is to prove it
 * actually watched the thing, which a rephrased hook does not do.
 */
async function writeOpener({
  transcript,
  fileName,
  postType,
}: {
  transcript: string | null
  fileName: string
  postType: string
}): Promise<string> {
  if (!transcript?.trim()) {
    return `Got ${fileName}, but I couldn't make out any speech in it. Tell me what's in it and what you want, and I'll write from that.`
  }
  try {
    const { text } = await generateText({
      model: gateway(getGatewayModel('fast')),
      providerOptions: getGatewayProviderOptions('fast', { tags: ['miniapp-opener'] }),
      prompt: [
        'You are the NRS Director, replying to the owner in a chat straight after watching his video.',
        'Write TWO short sentences, Australian English, no greeting, no emoji, no hashtags:',
        '1. What the video is actually about — specific enough to prove you watched it.',
        `2. Offer the obvious next move and ask which he wants. A ${postType} draft is already written and waiting below.`,
        'Do not write a caption. Do not repeat the draft. Under 45 words.',
        '',
        'Transcript:',
        transcript.slice(0, 2000),
      ].join('\n'),
    })
    return text.trim() || `Watched ${fileName} — draft below. Want it as is, or shall I change the angle?`
  } catch {
    return `Watched ${fileName} — there's a ${postType} draft below. Want it as is, or shall I change the angle?`
  }
}

interface RawProposal {
  hook?: unknown
  caption?: unknown
  hashtags?: unknown
  post_type?: unknown
  rationale?: unknown
}

/**
 * Pull the structured proposal back out of the tool's reply.
 *
 * `propose_post_from_media` answers with markdown for the Director to read
 * aloud, and closes with the same proposal as a fenced JSON block so the next
 * iteration can be fed back in. That block is the machine-readable contract —
 * it is emitted by our own code, not by the model, so it is stable to read.
 * When Content & Copy fails to return JSON the tool falls back to prose and
 * there is no block, which is reported as "no proposal" rather than guessed at.
 */
export function extractProposalJson(toolOutput: string): RawProposal | null {
  const blocks = [...toolOutput.matchAll(/```json\s*([\s\S]*?)```/gi)]
  const last = blocks.at(-1)?.[1]
  if (!last) return null
  try {
    const parsed = JSON.parse(last.trim()) as RawProposal
    return parsed && typeof parsed === 'object' ? parsed : null
  } catch {
    return null
  }
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string') : []
}

export async function proposeAndStore({
  supabase,
  userId,
  brandId,
  mediaItemId,
  fileName,
  platform = FIRST_PASS_PLATFORM,
  angle,
}: {
  supabase: SupabaseClient
  userId: string
  brandId: string
  mediaItemId: string
  fileName: string
  platform?: string
  angle?: string
}): Promise<StoredProposal | null> {
  const tool = createProposePostTool(supabase, userId, brandId)
  const execute = (tool as unknown as {
    execute: (args: Record<string, unknown>) => Promise<string>
  }).execute

  let output: string
  try {
    output = await execute({
      media_ids: [mediaItemId],
      platform,
      ...(angle ? { angle } : {}),
    })
  } catch {
    return null
  }

  const raw = extractProposalJson(output)
  if (!raw || typeof raw.caption !== 'string' || !raw.caption.trim()) return null

  const { data: mediaRow } = await supabase
    .from('media_items')
    .select('transcription')
    .eq('id', mediaItemId)
    .maybeSingle()

  const postType = typeof raw.post_type === 'string' ? raw.post_type : 'single'
  const opener = await writeOpener({
    transcript: typeof mediaRow?.transcription === 'string' ? mediaRow.transcription : null,
    fileName,
    postType,
  })

  const proposal: StoredProposal = {
    outputId: '',
    opener,
    hook: typeof raw.hook === 'string' ? raw.hook : '',
    caption: raw.caption,
    hashtags: asStringArray(raw.hashtags),
    postType: typeof raw.post_type === 'string' ? raw.post_type : 'single',
    rationale: typeof raw.rationale === 'string' ? raw.rationale : '',
  }

  const { data, error } = await supabase
    .from('outputs')
    .insert({
      user_id: userId,
      brand_id: brandId,
      output_type: 'social_post',
      title: proposal.hook.trim() || fileName,
      content: proposal.caption,
      is_approved: false,
      metadata: {
        source: 'telegram_mini_app',
        stage: 'proposal',
        media_item_ids: [mediaItemId],
        file_name: fileName,
        hook: proposal.hook,
        hashtags: proposal.hashtags,
        post_type: proposal.postType,
        rationale: proposal.rationale,
        opener: proposal.opener,
        platform,
      },
    })
    .select('id')
    .single()

  if (error || !data) return null
  return { ...proposal, outputId: data.id as string }
}

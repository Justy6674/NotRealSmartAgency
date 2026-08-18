import { z } from 'zod/v3'
import { DESK_CREATIVE_STATES, type DeskCreativeState } from './creative-flow'

const UUID = z.string().uuid()

const DeskResultRefSchema = z.object({
  kind: z.enum(['asset', 'proposal', 'draft']),
  id: UUID,
})

export const DeskContextSchema = z.object({
  schema_version: z.literal(1),
  source: z.literal('nrs_desk'),
  state: z.enum(DESK_CREATIVE_STATES),
  media_item_ids: z.array(UUID).max(10),
  intent: z.string().trim().max(2_000).nullable(),
  platforms: z.array(z.string().trim().min(1).max(50)).max(10),
  policy_version: z.string().trim().min(1).max(100),
  result_refs: z.array(DeskResultRefSchema).max(50),
  actor_user_id: z.string().min(1),
})

export type DeskConversationContext = z.infer<typeof DeskContextSchema>
export type DeskResultRef = z.infer<typeof DeskResultRefSchema>

export function buildDeskContext(input: {
  actorUserId: string
  mediaItemIds?: string[]
  intent?: string | null
  platforms?: string[]
  state?: DeskCreativeState
  policyVersion?: string
  resultRefs?: DeskResultRef[]
}): DeskConversationContext {
  const mediaItemIds = input.mediaItemIds ?? []
  if (new Set(mediaItemIds).size !== mediaItemIds.length) {
    throw new Error('Each selected media item must appear once.')
  }

  return DeskContextSchema.parse({
    schema_version: 1,
    source: 'nrs_desk',
    state: input.state ?? 'collecting',
    media_item_ids: mediaItemIds,
    intent: input.intent?.trim() || null,
    platforms: [...new Set(input.platforms ?? [])],
    policy_version: input.policyVersion ?? 'nrs-desk-v1',
    result_refs: input.resultRefs ?? [],
    actor_user_id: input.actorUserId,
  })
}

export function createDeskConversationMetadata(context: DeskConversationContext): Record<string, unknown> {
  return { source: 'nrs_desk', desk_context: DeskContextSchema.parse(context) }
}

export function readDeskContext(metadata: unknown): DeskConversationContext | null {
  if (!metadata || typeof metadata !== 'object') return null
  const value = (metadata as Record<string, unknown>).desk_context
  const parsed = DeskContextSchema.safeParse(value)
  return parsed.success ? parsed.data : null
}

export function buildDeskDirectorContext(context: DeskConversationContext): string {
  const media = context.media_item_ids.length > 0
    ? context.media_item_ids.map((id, index) => `${index + 1}. ${id}`).join('\n')
    : 'No media is selected.'
  const platforms = context.platforms.length > 0 ? context.platforms.join(', ') : 'No platform chosen yet.'

  return [
    '## NRS DESK WORK CONTEXT',
    `Selected brand is fixed by the authenticated conversation.`,
    `Selected media IDs, in owner-chosen order:\n${media}`,
    `Requested platforms: ${platforms}`,
    context.intent ? `Requested result: ${context.intent}` : 'Requested result: infer only from the current owner message.',
    'Use only these media IDs for this request. If the set is empty or insufficient, ask plainly instead of substituting another library item.',
    'Nothing may be published from NRS Desk. Assets, proposals and drafts require truthful durable receipts.',
    'Hashtags: if you have not called a tool that returns real tags (saved hashtag groups, process_media platform captions, or query_outputs with measured performance), label them honestly as suggestions — e.g. "Suggested hashtags (not from your saved groups):" before the tag line. Never imply platform-science or performance data you did not fetch. TikTok: 3–5 niche tags max per benchmarks; Instagram: 3–5 relevant tags; LinkedIn: keywords in copy matter more than tags.',
  ].join('\n\n')
}

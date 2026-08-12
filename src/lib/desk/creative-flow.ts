/**
 * The small, deterministic contract that keeps NRS Desk owner-led.
 *
 * The Director still writes and revises the creative work, but this state
 * machine decides when a capability is available. A model prompt alone must
 * never be able to turn an upload into a saved post or Mixpost draft.
 */

export const DESK_CREATIVE_STATES = [
  'collecting',
  'awaiting_direction',
  'proposal_ready',
  'draft_approved',
  'working',
  'needs_input',
  'result_ready',
  'completed',
] as const

export type DeskCreativeState = (typeof DESK_CREATIVE_STATES)[number]

const MIXPOST_DRAFT_TARGET = /\b(?:mixpost\s+(?:review\s+)?drafts?|(?:review\s+)?drafts?\s+(?:in|to|on|for)\s+mixpost)\b/i
const DRAFT_ACTION = /\b(?:save|send|create|make|put)\b/i
const AFFIRMATION = /\b(?:yes|yep|yeah|please|go ahead|approved)\b/i

/** A bare “yes” approves neither a draft nor an external system boundary. */
export function isExplicitMixpostDraftApproval(message: string): boolean {
  return MIXPOST_DRAFT_TARGET.test(message) && (DRAFT_ACTION.test(message) || AFFIRMATION.test(message))
}

/**
 * Advance the Desk only from the owner's current message. In particular, the
 * very first request can never be interpreted as approval to save a draft.
 */
export function deskCreativeStateForMessage(
  current: DeskCreativeState,
  message: string,
): DeskCreativeState {
  if (current === 'proposal_ready' && isExplicitMixpostDraftApproval(message)) {
    return 'draft_approved'
  }

  if (current === 'awaiting_direction') return 'proposal_ready'
  if (current === 'proposal_ready') return 'proposal_ready'
  if (current === 'draft_approved') return 'draft_approved'

  return 'awaiting_direction'
}

const TOOL_NAMES_BY_STATE: Record<DeskCreativeState, readonly string[]> = {
  collecting: ['query_media'],
  awaiting_direction: ['query_media'],
  proposal_ready: ['query_media', 'propose_post_from_media'],
  draft_approved: ['query_media', 'manage_posts'],
  working: ['query_media'],
  needs_input: ['query_media'],
  result_ready: ['query_media'],
  completed: ['query_media'],
}

/** Remove all capabilities that do not belong to the current owner stage. */
export function restrictDeskTools<T extends Record<string, unknown>>(
  tools: T,
  state: DeskCreativeState,
): T {
  const allowed = new Set(TOOL_NAMES_BY_STATE[state])
  return Object.fromEntries(Object.entries(tools).filter(([name]) => allowed.has(name))) as T
}

export function buildDeskCreativeDirectorPrompt(state: DeskCreativeState): string {
  const common = [
    '## NRS DESK OWNER-LED CREATIVE FLOW',
    'NRS Desk is one conversation for an image, video, audio, multiple files, or a text-only request.',
    'Do not mention departments, agent runs, Creator, NRS outputs, implementation details, or internal tool names to the owner.',
    'Never invent a product name from a transcript. If a product identity is uncertain, call it generic and ask the owner to confirm it.',
  ]

  if (state === 'awaiting_direction' || state === 'collecting' || state === 'working' || state === 'needs_input') {
    return [
      ...common,
      'STAGE: SHARED UNDERSTANDING.',
      'For selected media, call query_media with mode="analysis" and use the saved AI description and transcript. For text-only requests, restate the request in plain language.',
      'First say what you understand the source/request to be, the point of the post, the audience and the strongest angle. Then ask one clear question that lets the owner correct the description, purpose, message or voice.',
      'Do not create a post, output, draft, schedule or publish anything in this stage. Do not present a finished caption yet.',
    ].join('\n\n')
  }

  if (state === 'proposal_ready') {
    return [
      ...common,
      'STAGE: PROPOSAL AND ITERATION.',
      'The owner has responded to the shared understanding. Briefly state the agreed description, purpose, message and voice before presenting the proposed post in this chat.',
      'For selected media, use propose_post_from_media. For a text-only request, write the proposal directly in chat. Keep the proposed hook, caption and hashtags easy to review and revise here.',
      'Do not create a post, output, draft, schedule or publish anything in this stage. Ask what the owner would change. When the owner is happy, say exactly: “yes, save these as Mixpost drafts”.',
    ].join('\n\n')
  }

  if (state === 'draft_approved') {
    return [
      ...common,
      'STAGE: EXPLICIT MIXPOST DRAFT AUTHORISATION.',
      'The owner has just explicitly asked for Mixpost drafts. Use manage_posts with action="create_draft" once for each selected platform, using only the agreed copy and selected media.',
      'Create unscheduled review drafts only. Do not queue, schedule, approve or publish anything.',
      'Report the returned Mixpost state exactly as synced, pending or failed. Do not call a pending or failed draft ready.',
    ].join('\n\n')
  }

  return [
    ...common,
    'STAGE: REVIEW COMPLETE. Ask what the owner would like to change or make next; do not publish.',
  ].join('\n\n')
}

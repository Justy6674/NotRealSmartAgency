/**
 * The conversation a video should start.
 *
 * Uploading a clip used to produce, instantly and unasked, a finished caption
 * for one platform — hook, body, eight hashtags — with no idea what the video
 * was for, who it was for, or where it was going. There was nothing to do with
 * it but accept it or type a complaint, and because everything landed in one
 * long chat there was no sense of which video anything referred to.
 *
 * A real conversation goes: here is what I saw, here is what I can do about
 * the captions, what feel do you want, and where is it going. One question at
 * a time, each one answerable in three words, each answer changing what gets
 * written. Then the copy — once, informed, rather than first and blind.
 *
 * THE ORDER IS A STATE MACHINE, NOT A PROMPT. A model asked to "walk the owner
 * through it" will merge two questions when it is feeling efficient, skip one
 * it thinks it can infer, and re-ask another after a vague answer. The steps
 * here are code; the model only writes the words and reads the replies.
 */

export const BRIEF_STEPS = ['captions', 'feel', 'platforms', 'writing', 'done'] as const
export type BriefStep = (typeof BRIEF_STEPS)[number]

export interface BriefState {
  mediaItemId: string
  /** Null until answered — false is a real answer and must not read as unset. */
  captions: boolean | null
  /** Cut the dead air. Offered in the same breath as captions, so captured with it. */
  trim: boolean | null
  feel: string | null
  platforms: string[] | null
  /** Set once the copy has been written, so it is not written twice. */
  proposedOutputId: string | null
  startedAt: string
}

export function startBrief(mediaItemId: string, startedAt: string): BriefState {
  return {
    mediaItemId,
    captions: null,
    trim: null,
    feel: null,
    platforms: null,
    proposedOutputId: null,
    startedAt,
  }
}

/**
 * The first thing still unanswered.
 *
 * Derived rather than stored. A stored `step` and stored answers are two
 * sources of truth for the same fact, and they come apart the first time a
 * write half-fails — leaving a brief that asks for a feel it already has.
 */
export function currentStep(state: BriefState): BriefStep {
  // Both are offered in one question, so the step is answered when either has
  // been settled — "just captions" answers both: yes to one, no to the other.
  if (state.captions === null || state.trim === null) return 'captions'
  if (!state.feel) return 'feel'
  if (!state.platforms || state.platforms.length === 0) return 'platforms'
  if (!state.proposedOutputId) return 'writing'
  return 'done'
}

export function isOpen(state: BriefState): boolean {
  return currentStep(state) !== 'done'
}

/**
 * Record one answer.
 *
 * Only the step being asked can be answered. Letting a stray reply set a
 * later field would skip a question the owner never saw.
 */
export function applyAnswer(
  state: BriefState,
  answer: { captions?: boolean; trim?: boolean; feel?: string; platforms?: string[] },
): BriefState {
  const step = currentStep(state)
  if (step === 'captions' && (typeof answer.captions === 'boolean' || typeof answer.trim === 'boolean')) {
    // "Just captions" says yes to one and no to the other. Only a reply that
    // settles neither leaves the question outstanding.
    return {
      ...state,
      captions: answer.captions ?? false,
      trim: answer.trim ?? false,
    }
  }
  if (step === 'feel' && answer.feel?.trim()) {
    return { ...state, feel: answer.feel.trim() }
  }
  if (step === 'platforms' && answer.platforms && answer.platforms.length > 0) {
    return { ...state, platforms: answer.platforms }
  }
  return state
}

/** Nothing in the reply answered the question that was asked. */
export function stalled(before: BriefState, after: BriefState): boolean {
  return currentStep(before) === currentStep(after)
}

/**
 * What the Director needs to say next, as a brief for the model.
 *
 * The wording is the model's; what must be asked, and what must not be asked
 * alongside it, is not.
 */
export function stepBrief(step: BriefStep, context: {
  summary: string
  canCaption: boolean
  platforms: string[]
  brandName: string
}): string | null {
  switch (step) {
    case 'captions':
      return [
        'Say in one or two sentences what the clip is actually about — specific enough to prove',
        'you watched it. Where a product name was checked, say so plainly; where it could not be,',
        'say that too and ask which was meant. Never state a name as fact that was not confirmed.',
        '',
        'Then ask ONE question: what to do to the video before it goes out.',
        context.canCaption
          ? 'Offer exactly two things, because they are the two that exist: burning the words onto'
            + ' the screen, and cutting the dead air — the fumbling at the start and the long gaps.'
            + ' Say most people watch on mute and no scheduler can add captions afterwards, so it'
            + ' is now or not at all. Say "neither" is a fine answer.'
          : 'Say plainly that you could not make out any speech, so captions are not possible.'
            + ' Offer to cut the dead air instead, and ask whether to carry on without words on'
            + ' screen.',
        'A still is already made from the clip for the thumbnail. If asked about a logo overlay on'
        + ' video, say honestly that it is not built yet rather than agreeing to it.',
        '',
        'What the clip is about:',
        context.summary,
      ].join('\n')

    case 'feel':
      return [
        'Ask ONE question: what feel the owner wants from this one.',
        `Offer three short, concrete options that suit ${context.brandName} — not adjectives in a`,
        'list, but recognisable directions, each five words at most. Say he can ignore them and',
        'describe it himself. Do not ask about anything else yet.',
      ].join('\n')

    case 'platforms':
      return [
        'Ask ONE question: where this is going.',
        `The connected accounts are: ${context.platforms.join(', ')}. Name them and no others —`,
        'offering a platform that is not connected creates work that cannot be done.',
        'Say "all of them" is a fine answer. Do not ask about anything else.',
      ].join('\n')

    default:
      return null
  }
}

/**
 * What to say when the reply did not answer the question.
 *
 * Re-asking verbatim is what makes a bot feel like a bot. It acknowledges the
 * reply, then puts the same question a different way, once.
 */
export function reaskBrief(step: BriefStep, said: string): string {
  return [
    `The owner replied "${said}", which does not answer the question you asked.`,
    'Answer whatever he actually raised, briefly and properly — then put the same question again,',
    'in different words, in one short sentence. Do not move on to any other question.',
    `The question still outstanding is about: ${
      step === 'captions' ? 'whether to burn captions into the video'
        : step === 'feel' ? 'what feel he wants'
          : 'which social accounts this is going to'
    }.`,
  ].join('\n')
}

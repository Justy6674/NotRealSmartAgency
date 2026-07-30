/**
 * The questions a marketing director asks before agreeing a goal.
 *
 * A form was the wrong answer. The founding principle of this product is that
 * the owner talks and the system does the work of knowing what to ask — a
 * blank field labelled "social targets" puts the thinking back on him, which
 * is exactly what he is paying not to do.
 *
 * So this is an interview: one question at a time, in the order a competent
 * director would ask them, each one earning the right to the next. The answers
 * become the goal. Nothing here invents an answer; it decides what to ask.
 *
 * The order matters. Outcome before audience, audience before action, action
 * before channel — because a channel chosen before you know who you are
 * talking to is a guess, and a number chosen before you know what you want
 * them to do measures the wrong thing.
 */

export type GoalField =
  | 'outcome'
  | 'audience'
  | 'action'
  | 'barrier'
  | 'channels'
  | 'metric'
  | 'baseline'
  | 'deadline'
  | 'guardrail'

export interface GoalQuestion {
  field: GoalField
  /** Asked verbatim. Plain language, no marketing vocabulary. */
  question: string
  /** Why a director asks it — shown if he asks "why do you need to know?" */
  why: string
  /** An example answer, offered only if he stalls. Never presented as the answer. */
  example: string
  /** True when this question can be skipped for this project. */
  optional?: boolean
}

/**
 * The full line of questioning.
 *
 * Nine questions is more than anyone wants to answer at once, which is why
 * they are asked one at a time and why the last three are optional — a goal
 * with the first six answered is already a usable goal.
 */
export const GOAL_QUESTIONS: readonly GoalQuestion[] = [
  {
    field: 'outcome',
    question: 'What would make the next three months a win for this business?',
    why: 'Everything else is chosen to serve this. Without it, work gets done that looks busy and changes nothing.',
    example: 'More people listing bottles they no longer wear.',
  },
  {
    field: 'audience',
    question: 'Who is the one person you most want to reach?',
    why: 'Copy written for everyone reads as written for nobody. Naming one person makes every caption sharper. Describe them the way you would describe a customer to a mate.',
    example: 'Someone with eight bottles, three they never wear, who lurks in fragrance groups but has never sold anything.',
  },
  {
    field: 'action',
    question: 'When that person sees your marketing, what do you want them to actually do?',
    why: 'A post with no action is a post that cannot work. This decides how every piece of copy ends.',
    example: 'List one bottle. Not browse, not follow — list.',
  },
  {
    field: 'barrier',
    question: 'What is stopping them from doing that right now?',
    why: 'Marketing that ignores the real objection argues with the wrong thing. The barrier is usually the message.',
    example: 'They think it is a hassle, and they are not sure what their bottle is worth.',
  },
  {
    field: 'channels',
    question: 'Where does that person already spend their time?',
    why: 'Posting everywhere spreads effort thin. Two channels done properly beat six done badly, so name only the places you actually want to show up.',
    example: 'Instagram mostly, some Facebook groups.',
  },
  {
    field: 'metric',
    question: 'What one number would tell you it is working?',
    why: 'Without a number, progress is a matter of opinion, and nobody can say whether a month was worth it.',
    example: 'Bottles listed per week.',
  },
  {
    field: 'baseline',
    question: 'Where is that number today — even roughly?',
    why: 'A target with no starting point cannot show progress. Roughly right beats precisely unknown.',
    example: 'Maybe two or three a week.',
    optional: true,
  },
  {
    field: 'deadline',
    question: 'By when?',
    why: 'A goal with no date never becomes urgent and never gets reviewed.',
    example: 'End of the year.',
    optional: true,
  },
  {
    field: 'guardrail',
    question: 'Anything we must never do or say for this business?',
    why: 'Cheaper to hear now than to see published. This becomes a rule every agent follows.',
    example: 'Never make it sound like a discount bin.',
    optional: true,
  },
]

export type GoalAnswers = Partial<Record<GoalField, string>>

/**
 * The next question to ask, or null when there is nothing left worth asking.
 *
 * Required questions come first, in order. Optional ones follow, so a goal is
 * usable long before the interview is exhausted — and he can stop whenever he
 * likes without leaving it half-set.
 */
export function nextGoalQuestion(answers: GoalAnswers): GoalQuestion | null {
  const answered = (q: GoalQuestion) => Boolean(answers[q.field]?.trim())

  const required = GOAL_QUESTIONS.filter((q) => !q.optional)
  const unansweredRequired = required.find((q) => !answered(q))
  if (unansweredRequired) return unansweredRequired

  const optional = GOAL_QUESTIONS.filter((q) => q.optional)
  return optional.find((q) => !answered(q)) ?? null
}

export interface InterviewProgress {
  /** Required questions answered, out of how many. */
  answeredRequired: number
  totalRequired: number
  /** True once there is enough to record a goal. */
  usable: boolean
  /** True when nothing further is worth asking. */
  complete: boolean
}

export function goalInterviewProgress(answers: GoalAnswers): InterviewProgress {
  const required = GOAL_QUESTIONS.filter((q) => !q.optional)
  const answeredRequired = required.filter((q) => Boolean(answers[q.field]?.trim())).length

  return {
    answeredRequired,
    totalRequired: required.length,
    usable: answeredRequired === required.length,
    complete: nextGoalQuestion(answers) === null,
  }
}

/**
 * The goal as the owner would describe it, assembled from his own answers.
 *
 * Deliberately his words, lightly framed. A title generated in marketing
 * language would be a goal he does not recognise as his, and he is the one who
 * has to agree it.
 */
export function draftGoalFromAnswers(answers: GoalAnswers): {
  title: string
  description: string
} | null {
  if (!answers.outcome?.trim()) return null

  const title = answers.outcome.trim().replace(/\s+/g, ' ')

  const parts: string[] = []
  if (answers.audience) parts.push(`Who it is for: ${answers.audience.trim()}`)
  if (answers.action) parts.push(`What they should do: ${answers.action.trim()}`)
  if (answers.barrier) parts.push(`What is in the way: ${answers.barrier.trim()}`)
  if (answers.channels) parts.push(`Where to show up: ${answers.channels.trim()}`)
  if (answers.metric) parts.push(`How we will know: ${answers.metric.trim()}`)
  if (answers.baseline) parts.push(`Where that stands today: ${answers.baseline.trim()}`)
  if (answers.guardrail) parts.push(`Never: ${answers.guardrail.trim()}`)

  return { title, description: parts.join('\n') }
}

/**
 * How the Director should conduct the interview.
 *
 * Injected into the prompt when a goal is being set, because the failure mode
 * is not asking the wrong questions — it is asking all nine at once, which
 * reads as a form with extra steps.
 */
export function buildInterviewDirective(
  projectName: string,
  answers: GoalAnswers,
): string {
  const next = nextGoalQuestion(answers)
  const progress = goalInterviewProgress(answers)

  if (!next) {
    return `## SETTING THE GOAL FOR ${projectName.toUpperCase()} — READY TO AGREE

Everything needed has been answered. Read the goal back to him in his own words, in three lines or fewer, and ask whether that is right before saving it. If he changes anything, use his correction verbatim.`
  }

  const known = Object.entries(answers)
    .filter(([, v]) => Boolean(v?.trim()))
    .map(([k, v]) => `- ${k}: ${v}`)

  return `## SETTING THE GOAL FOR ${projectName.toUpperCase()} — INTERVIEW IN PROGRESS

You are the director. Ask, do not present a form. ${progress.answeredRequired} of ${progress.totalRequired} essentials answered.

${known.length ? `Already answered — never ask these again:\n${known.join('\n')}\n` : 'Nothing answered yet.\n'}
**Ask exactly this, and nothing else, then stop and wait:**

"${next.question}"

Rules for this turn:
- ONE question. Not two, not a numbered list. Asking everything at once is the form he did not want.
- Do not answer it for him, and do not offer the answer you expect.
- If he asks why you need it, say: ${next.why}
- If he stalls or says he does not know, offer this as an illustration only, and make clear it is not his answer: "${next.example}"
- If his reply answers a later question too, keep it and skip that question rather than asking it again.
- If he gives a vague answer, accept it and move on. A rough answer he owns beats a precise one you invented.
- Never write the goal until the essentials are answered and he has agreed the wording.`
}

/**
 * The Director topic — the front door.
 *
 * "If I am talking to Director it should be across all of them, unless I ask,
 * and then if I want Scent Sell it's in that topic."
 *
 * That is the right shape and it was not what happened: the Director topic had
 * no brand attached, fell down the same path as an unmapped thread, and picked
 * up whichever project was last selected. So the owner asked a whole-agency
 * question and got an answer about one business.
 *
 * Here the conversation is scoped to the PERSON — every project they hold —
 * rather than to one brand. That is safe by construction: the list comes from
 * their own grants, so a colleague fenced to one brand has a "front door" that
 * spans exactly that one brand.
 */

export interface DirectorTopicProject {
  projectId: string
  projectName: string
  grantId: string
}

/**
 * Whether the message names one of the person's projects.
 *
 * Naming a brand in the front door means "this one" — it should not require
 * moving to another topic mid-thought. Matched loosely, longest name first, so
 * "Downscale" finds Downscale Weight Loss and "TeleCheck Clinic" is not taken
 * by TeleCheck.
 */
export function namedProjectIn<T extends DirectorTopicProject>(
  message: string,
  projects: readonly T[],
): T | null {
  const squash = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, '')
  const haystack = squash(message)
  if (!haystack) return null

  const byLength = [...projects].sort(
    (a, b) => squash(b.projectName).length - squash(a.projectName).length,
  )

  for (const project of byLength) {
    const full = squash(project.projectName)
    const first = squash(project.projectName.split(/\s+/)[0] ?? '')
    if (full.length >= 4 && haystack.includes(full)) return project
    if (first.length >= 5 && haystack.includes(first)) return project
  }
  return null
}

/**
 * What the Director is told when it answers in the front door.
 *
 * It names every project so a cross-brand question can actually be answered
 * across brands — and it forbids producing publishable copy without a brand,
 * because a caption written for "the agency" belongs to nobody and would be
 * filed against whichever project happened to be in scope.
 */
export function buildDirectorTopicDirective(projects: readonly DirectorTopicProject[]): string {
  const names = projects.map((project) => project.projectName)

  return [
    '',
    '',
    '[FRONT DOOR — this message came from the Director topic, which is not tied to one brand.',
    `The owner works across these projects: ${names.join(', ')}.`,
    'Answer across all of them. Compare, prioritise, and say which project each point is about.',
    '',
    'Do NOT write a caption, post, ad or any publishable copy from here, and do not create a',
    'draft: work that belongs to one brand belongs in that brand\'s topic, where it is filed',
    'correctly. If they ask for brand work here, answer the thinking and tell them to send it in',
    `the matching topic — one of: ${names.join(', ')}.`,
    'Never say you are "working on" a single brand in this topic.]',
  ].join('\n')
}

/** The acknowledgement for the front door — it must not name one brand. */
export function directorTopicAcknowledgement(projects: readonly DirectorTopicProject[]): string {
  const count = projects.length
  return count === 1
    ? 'Thinking about it — I will come back here.'
    : `Thinking across all ${count} of your projects — I will come back here.`
}

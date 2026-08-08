/**
 * Link a topic to a project the moment it is created, by its name.
 *
 * Setup was a command the owner had to run, whose failures he then had to
 * interpret. That was the wrong shape: he creates a topic called "Scent Sell"
 * because he wants Scent Sell in it, and nothing else needs saying.
 *
 * Telegram sends a service message when a topic is created or renamed —
 * ForumTopicCreated carries `name`, ForumTopicEdited carries the new `name` —
 * so the mapping can be made from what he already did, with no command, no
 * ordering to get right, and nothing to run twice.
 *
 * A name matching no project is simply left unlinked. Posting there falls back
 * to the selected project, exactly as an unmapped thread always has.
 */

export interface TopicNamed {
  chatId: string
  threadId: number
  name: string
  /** True when this is a rename rather than a creation. */
  renamed: boolean
}

/** Read a topic-created or topic-renamed service message. */
export function parseTopicNamed(update: unknown): TopicNamed | null {
  if (!update || typeof update !== 'object') return null
  const message = (update as Record<string, unknown>).message as Record<string, unknown> | undefined
  if (!message) return null

  const chat = message.chat as Record<string, unknown> | undefined
  const threadId = message.message_thread_id
  if (!chat || chat.id === undefined || typeof threadId !== 'number') return null

  const created = message.forum_topic_created as Record<string, unknown> | undefined
  if (created && typeof created.name === 'string') {
    return { chatId: String(chat.id), threadId, name: created.name, renamed: false }
  }

  const edited = message.forum_topic_edited as Record<string, unknown> | undefined
  // A rename that only changed the icon carries no name, and means nothing here.
  if (edited && typeof edited.name === 'string') {
    return { chatId: String(chat.id), threadId, name: edited.name, renamed: true }
  }

  return null
}

/** The front-door name. A topic called this is deliberately tied to no brand. */
const DIRECTOR_NAMES = ['director', 'directorchat', 'general', 'agency']

function squash(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '')
}

export interface LinkableProject {
  grantId: string
  projectId: string
  projectName: string
}

export type TopicLink =
  | { kind: 'brand'; project: LinkableProject }
  | { kind: 'director' }
  | { kind: 'none' }

/**
 * Which project a topic name means.
 *
 * Matched the way the owner writes: "Downscale" is Downscale Weight Loss,
 * "Endorse Me" is EndorseMe. Longest project name wins, so a topic named
 * "TeleCheck Clinic" cannot be taken by TeleCheck.
 */
export function linkForTopicName(
  name: string,
  available: readonly LinkableProject[],
): TopicLink {
  const key = squash(name)
  if (!key) return { kind: 'none' }

  if (DIRECTOR_NAMES.includes(key)) return { kind: 'director' }

  // An EXACT name wins outright, before any looser rule runs. Otherwise a
  // topic called "TeleCheck" is claimed by "TeleCheck Clinic", which starts
  // with it — the owner names a topic after a brand and gets a different one.
  const exact = available.find((project) => squash(project.projectName) === key)
  if (exact) return { kind: 'brand', project: exact }

  // Then the brand's own leading word: "Downscale" for Downscale Weight Loss.
  const byFirstWord = available.find(
    (project) => squash(project.projectName.split(/\s+/)[0] ?? '') === key && key.length >= 4,
  )
  if (byFirstWord) return { kind: 'brand', project: byFirstWord }

  // Finally a prefix — the brand starts with what he typed. Longest first, so
  // the most specific brand wins when several share an opening.
  const byLength = [...available].sort(
    (a, b) => squash(b.projectName).length - squash(a.projectName).length,
  )
  const prefixed = byLength.find(
    (project) => key.length >= 4 && squash(project.projectName).startsWith(key),
  )
  if (prefixed) return { kind: 'brand', project: prefixed }

  return { kind: 'none' }
}

/** What to say when a topic is linked. Nothing at all when it is not. */
export function describeTopicLink(link: TopicLink, topicName: string): string | null {
  if (link.kind === 'brand') {
    return `This topic is now ${link.project.projectName}. Anything you post here I work on for that project.`
  }
  if (link.kind === 'director') {
    return 'This is the front door. Post anything here and I will ask which project if it matters.'
  }
  // An unrecognised name is not an error — he may want a topic for something
  // that is not a brand at all. Saying nothing is the right amount to say.
  return null
}

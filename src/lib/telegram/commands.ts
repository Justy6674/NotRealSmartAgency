/**
 * The commands Telegram shows in the ⌘ menu.
 *
 * Registered with `setMyCommands`, which is the only way they appear. Without
 * it a bot's commands are invisible — you have to already know they exist and
 * type them exactly, which for a tool meant to be usable one-handed on a phone
 * is the same as not having them.
 *
 * Kept short deliberately. Telegram shows this list in a menu, and a menu of
 * thirty entries is a wall of text nobody reads. Everything else is a sentence
 * to the Director, which is the point of the thing.
 *
 * Descriptions are what the owner sees. Written in his language, not the
 * system's: "start something new" rather than "reset conversation context".
 */

export interface BotCommand {
  command: string
  description: string
}

/** Telegram's own limits: lowercase, ≤32 chars, description ≤256. */
export const NRS_COMMANDS: readonly BotCommand[] = [
  { command: 'start', description: 'Pick the project you are working on' },
  { command: 'project', description: 'Switch to a different project' },
  { command: 'new', description: 'Save what we settled and start something new' },
  { command: 'link', description: 'Link this topic to a project, for good' },
  { command: 'status', description: 'What NRS is working on right now' },
  { command: 'drafts', description: 'What is waiting for you in Mixpost' },
  { command: 'app', description: 'Open NRS Studio to upload video or photos' },
  { command: 'topics', description: 'Set up a topic per project' },
  { command: 'help', description: 'What I can do, in plain English' },
]

/**
 * Telegram rejects the whole list if any entry is malformed, so this is
 * checked rather than trusted. A silently rejected list looks exactly like a
 * bot with no commands.
 */
export function invalidCommands(commands: readonly BotCommand[] = NRS_COMMANDS): string[] {
  const problems: string[] = []
  const seen = new Set<string>()

  for (const entry of commands) {
    if (!/^[a-z0-9_]{1,32}$/.test(entry.command)) {
      problems.push(`"${entry.command}" must be 1-32 chars of lowercase, digits or underscore`)
    }
    if (seen.has(entry.command)) problems.push(`"${entry.command}" is listed twice`)
    seen.add(entry.command)

    if (entry.description.length < 3 || entry.description.length > 256) {
      problems.push(`"${entry.command}" description must be 3-256 characters`)
    }
  }
  return problems
}

/** The command in a message, without the @botname Telegram appends in groups. */
export function commandIn(text: string | undefined): string | null {
  if (!text) return null
  const match = /^\/([a-zA-Z0-9_]{1,32})(?:@[\w]+)?(?:\s|$)/.exec(text.trim())
  return match ? match[1].toLowerCase() : null
}

/** Everything after the command word, for `/link scent sell`. */
export function argsIn(text: string | undefined): string {
  if (!text) return ''
  return text.trim().replace(/^\/[a-zA-Z0-9_]{1,32}(?:@[\w]+)?\s*/, '').trim()
}

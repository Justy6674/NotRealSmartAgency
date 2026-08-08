/**
 * The slash commands, and what each one actually asks for.
 *
 * A command is not a feature — it is a well-written request the owner would
 * otherwise have to type. That is the whole value: "/idea" beats typing "give
 * me three post ideas for this brand that fit what we've been doing" at nine
 * at night on a phone, and it gets a better answer, because the expansion is
 * written once and carefully instead of improvised every time.
 *
 * So each entry carries the sentence it becomes. Everything downstream — the
 * Director, its tools, the name checking, the approval gate — is untouched and
 * behaves exactly as it does for a typed message. Nothing here can publish.
 *
 * Registered with `setMyCommands`, which is the only way Telegram shows them
 * in the ⌘ menu. Without that they are invisible and you have to already know
 * they exist, which for a tool meant to be used one-handed is the same as not
 * having them.
 */

export interface NRSCommand {
  /** Without the slash. Lowercase, digits and underscore only. */
  command: string
  /** What the owner sees in the menu. His language, not the system's. */
  description: string
  /**
   * The request it becomes. Null for commands the webhook handles itself —
   * switching project, opening the app — which never reach the Director.
   */
  expandsTo: string | null
  /** Needs a photo or video attached, or a recent one to work from. */
  wantsMedia?: boolean
}

/**
 * The actions. Ordered by how often they get used, because Telegram shows
 * this list as a menu and the top of it is what people reach for.
 */
export const ACTION_COMMANDS: readonly NRSCommand[] = [
  {
    command: 'idea',
    description: 'Give me a few post ideas for this brand',
    expandsTo:
      'Give me three post ideas for this brand. Each one: the hook, the format (reel, carousel,'
      + ' single image) and why it suits us right now. Ground them in what this brand actually'
      + ' sells and what we have posted lately — not generic marketing ideas. No captions yet,'
      + ' just the ideas, so I can pick one.',
  },
  {
    command: 'scanphoto',
    description: 'Look at this photo and tell me what we can do with it',
    wantsMedia: true,
    expandsTo:
      'Look at the photo I have sent and tell me what is actually in it — products, setting, mood,'
      + ' anything readable in the image. Check every product name against the catalogue before'
      + ' you write it, and say plainly which ones you could not confirm. Then tell me the two or'
      + ' three strongest ways to use it. Do not write a caption yet.',
  },
  {
    command: 'scanvideo',
    description: 'Watch this video and tell me what we can do with it',
    wantsMedia: true,
    expandsTo:
      'Watch the video I have sent — read the transcript properly — and tell me what it is about,'
      + ' specifically enough to prove you watched it. Check every product name against the'
      + ' catalogue and say which you could not confirm. Then tell me the strongest angle, whether'
      + ' it wants captions burnt in, and whether it needs the dead air cut. Do not write a'
      + ' caption yet.',
  },
  {
    command: 'carousel',
    description: 'Build a carousel from this',
    expandsTo:
      'Build a carousel. Give me the slide-by-slide copy — hook on slide one, one idea per slide,'
      + ' a close that asks for something. Tell me how many slides and why. Use the brand kit for'
      + ' the design, and check any product name against the catalogue before it goes on a slide.',
  },
  {
    command: 'description',
    description: 'Just the description — no post, no hashtags',
    expandsTo:
      'Write the description only. No hook, no hashtags, no call to action, no post structure —'
      + ' just the description itself, written to be found in search: plain language, the words'
      + ' someone would actually type, the product or service named correctly. Nothing else.',
  },
  {
    command: 'caption',
    description: 'Write the caption for what I just sent',
    wantsMedia: true,
    expandsTo:
      'Write the caption for what I just sent. Tell me which platform you have written it for and'
      + ' why. Every product name checked against the catalogue first — if you cannot confirm one,'
      + ' ask me rather than writing it.',
  },
  {
    command: 'post',
    description: 'Full post — caption, hashtags, ready to draft',
    expandsTo:
      'Write the full post: hook, caption, hashtags. Tell me which platforms it suits. Do not'
      + ' draft it to Mixpost yet — show me first.',
  },
  {
    command: 'drafts',
    description: 'What is waiting for me in Mixpost',
    expandsTo:
      'What is sitting in Mixpost for this brand right now? List each draft with its platform and'
      + ' the first line of its copy, so I can tell them apart. Say plainly if there are none.',
  },
  {
    command: 'analytics',
    description: 'How is this brand actually doing',
    expandsTo:
      'How is this brand doing? Real numbers only — site visitors and social performance from the'
      + ' data you can actually read. Say which figures you do not have rather than estimating'
      + ' them. Then one thing worth changing.',
  },
  {
    command: 'new',
    description: 'Save what we settled and start something new',
    expandsTo: null,
  },
  {
    command: 'project',
    description: 'Switch to a different project',
    expandsTo: null,
  },
  {
    command: 'app',
    description: 'Open NRS Studio to upload video or photos',
    expandsTo: null,
  },
  {
    command: 'help',
    description: 'What I can do, in plain English',
    expandsTo: null,
  },
]

/**
 * Turn a project name into a command.
 *
 * "Downscale Weight Loss" → "downscale_weight_loss". Telegram allows only
 * lowercase, digits and underscore, and caps the whole thing at 32.
 */
export function projectCommandName(projectName: string): string | null {
  const slug = projectName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 32)
    .replace(/_+$/, '')
  return /^[a-z][a-z0-9_]{0,31}$/.test(slug) ? slug : null
}

/**
 * One command per project, so switching is a tap rather than a menu.
 *
 * Built from the projects this person actually has, not a fixed list — a
 * command for a project they cannot reach is a dead entry in their menu.
 */
export function projectCommands(
  projects: ReadonlyArray<{ projectName: string }>,
): NRSCommand[] {
  const seen = new Set<string>()
  const commands: NRSCommand[] = []

  for (const project of projects) {
    const name = projectCommandName(project.projectName)
    // Two projects that slug to the same word would give Telegram a duplicate
    // and it rejects the WHOLE list, leaving the owner with no commands at all.
    if (!name || seen.has(name)) continue
    seen.add(name)
    commands.push({
      command: name,
      description: `Switch to ${project.projectName}`,
      expandsTo: null,
    })
  }
  return commands
}

/** Telegram shows at most 100; projects first, since switching is constant. */
export function fullCommandList(
  projects: ReadonlyArray<{ projectName: string }>,
): NRSCommand[] {
  return [...projectCommands(projects), ...ACTION_COMMANDS].slice(0, 100)
}

/** The command in a message, without the @botname Telegram adds in groups. */
export function commandIn(text: string | undefined): string | null {
  if (!text) return null
  const match = /^\/([a-zA-Z0-9_]{1,32})(?:@[A-Za-z0-9_]+)?(?:\s|$)/.exec(text.trim())
  return match ? match[1].toLowerCase() : null
}

/** Whatever was typed after the command, for "/idea something about summer". */
export function argsIn(text: string | undefined): string {
  if (!text) return ''
  return text.trim().replace(/^\/[a-zA-Z0-9_]{1,32}(?:@[A-Za-z0-9_]+)?\s*/, '').trim()
}

/**
 * The request a command becomes, with anything typed after it appended.
 *
 * The extra words are the owner narrowing the job — "/idea something for the
 * weekend" — so they go last, where they read as the operative instruction
 * rather than as a footnote to a paragraph of boilerplate.
 */
export function expandCommand(
  name: string,
  args: string,
  commands: readonly NRSCommand[] = ACTION_COMMANDS,
): string | null {
  const found = commands.find((entry) => entry.command === name)
  if (!found?.expandsTo) return null
  return args ? `${found.expandsTo}\n\nSpecifically: ${args}` : found.expandsTo
}

/**
 * Telegram rejects the entire list if one entry is malformed, and says nothing
 * useful about which. Checked here so a bad entry fails a test rather than
 * silently leaving the owner with no menu.
 */
export function invalidCommands(commands: readonly NRSCommand[]): string[] {
  const problems: string[] = []
  const seen = new Set<string>()

  for (const entry of commands) {
    if (!/^[a-z][a-z0-9_]{0,31}$/.test(entry.command)) {
      problems.push(`"${entry.command}": must start with a letter, 1-32 lowercase/digits/underscore`)
    }
    if (seen.has(entry.command)) problems.push(`"${entry.command}" appears twice`)
    seen.add(entry.command)
    if (entry.description.length < 3 || entry.description.length > 256) {
      problems.push(`"${entry.command}": description must be 3-256 characters`)
    }
  }
  return problems
}

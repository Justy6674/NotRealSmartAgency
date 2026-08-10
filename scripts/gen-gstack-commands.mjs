/**
 * Generate one slash-command wrapper per gstack skill.
 *
 * The wrapper carries no instructions of its own — it names the skill and
 * stops. gstack ships the behaviour; duplicating any of it here would drift
 * the moment /gstack-upgrade runs.
 */
import { readdirSync, readFileSync, writeFileSync, mkdirSync, rmSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'

const GSTACK = join(homedir(), '.claude/skills/gstack')
const OUT = join(process.cwd(), '.claude/commands/gstack')

// Skills whose slash form would be noise: internal routers and one-shot
// machine setup the owner will never type.
const SKIP = new Set(['SKILL.md', 'browser-skills', 'open-gstack-browser'])

function frontmatter(text) {
  const m = text.match(/^---\n([\s\S]*?)\n---/)
  if (!m) return {}
  const out = {}
  for (const line of m[1].split('\n')) {
    const kv = line.match(/^([a-z-]+):\s*(.+)$/i)
    if (kv) out[kv[1]] = kv[2].trim().replace(/^["']|["']$/g, '')
  }
  return out
}

/** The "When to invoke this skill" prose, collapsed to one paragraph. */
function whenToUse(text) {
  const m = text.match(/## When to invoke this skill\s*\n+([\s\S]*?)(?=\n## )/)
  if (!m) return null
  const flat = m[1].trim().replace(/\s*\n\s*/g, ' ')
  if (flat.length <= 400) return flat
  // Cut on a sentence boundary. A menu entry that stops mid-clause reads as a
  // broken file rather than a short one.
  const cut = flat.slice(0, 400)
  const lastStop = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('? '), cut.lastIndexOf('! '))
  return lastStop > 120 ? cut.slice(0, lastStop + 1) : `${cut.trimEnd()}…`
}

if (existsSync(OUT)) rmSync(OUT, { recursive: true })
mkdirSync(OUT, { recursive: true })

const names = readdirSync(GSTACK, { withFileTypes: true })
  .filter((e) => (e.isDirectory() || e.isSymbolicLink()) && !SKIP.has(e.name))
  .map((e) => e.name)
  .filter((n) => existsSync(join(GSTACK, n, 'SKILL.md')))
  .sort()

let written = 0
for (const name of names) {
  const src = readFileSync(join(GSTACK, name, 'SKILL.md'), 'utf8')
  const fm = frontmatter(src)
  const desc = (fm.description || '').replace(/\s*\(gstack\)\s*$/, '').trim()
  const when = whenToUse(src)

  const body = `# /${name}

${desc || `Run the gstack \`${name}\` skill.`}

## What to do

Invoke the **\`${name}\`** skill with the Skill tool, passing anything the user
typed after the command as its arguments. Follow that skill's instructions from
its first step; do not summarise, shortcut, or re-implement them here.

${when ? `## When this applies\n\n${when}\n` : ''}
---
Wrapper only. The skill itself lives at \`~/.claude/skills/gstack/${name}/SKILL.md\`
and is the single source of truth — this file is regenerated, never hand-edited.
`
  writeFileSync(join(OUT, `${name}.md`), body)
  written++
}

console.log(`wrote ${written} command wrappers to .claude/commands/gstack/`)
console.log(names.join(' '))

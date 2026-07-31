import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'

/**
 * Carry what NRS has learned into Obsidian.
 *
 * NRS accumulates memories fast — hundreds a day — and none of it reached the
 * vault. A decision made about ScentSell inside NRS never surfaced when
 * thinking about ScentSell anywhere else, and the two stores grew apart.
 *
 * This runs locally rather than on the server, because the vault is a folder
 * on this machine and Vercel cannot write to it. Run it whenever; it is
 * incremental and safe to repeat.
 *
 *   npx tsx scripts/sync-memories-to-obsidian.ts
 *   npx tsx scripts/sync-memories-to-obsidian.ts --since 2026-07-01
 *   npx tsx scripts/sync-memories-to-obsidian.ts --dry
 */

/** Conversation logs are transcript noise, not knowledge. */
const WORTH_KEEPING = new Set(['decision', 'brand_rule', 'preference', 'observation', 'metric'])

/** How each type reads as a heading in the vault. */
const SECTION: Record<string, string> = {
  decision: 'Decisions',
  brand_rule: 'Brand rules',
  preference: 'What the owner wants',
  observation: 'Observations',
  metric: 'Numbers',
}

interface MemoryRow {
  key: string
  namespace: string
  value: unknown
  memory_type: string | null
  confidence: number | null
  tags: string[] | null
  brand_id: string | null
  created_at: string
  updated_at: string | null
}

function vaultRoot(): string {
  return path.join(os.homedir(), 'Obsidian')
}

/** Filenames a person can read, and that stay stable between runs. */
function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60)
}

function readValue(value: unknown): string {
  if (typeof value === 'string') return value
  if (value && typeof value === 'object') {
    const v = value as Record<string, unknown>
    if (typeof v.summary === 'string') return v.summary
    if (typeof v.text === 'string') return v.text
  }
  return ''
}

async function main() {
  const args = process.argv.slice(2)
  const dry = args.includes('--dry')
  const sinceArg = args.indexOf('--since')
  const since = sinceArg >= 0 ? args[sinceArg + 1] : null

  const root = vaultRoot()
  if (!fs.existsSync(root)) {
    console.error(`No vault at ${root}. Nothing written.`)
    process.exit(1)
  }

  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

  const { data: brands } = await sb.from('brands').select('id, name, slug')
  const brandName = new Map((brands ?? []).map((b) => [b.id, b.name as string]))

  let query = sb
    .from('agent_memories')
    .select('key, namespace, value, memory_type, confidence, tags, brand_id, created_at, updated_at')
    .order('created_at', { ascending: true })
  if (since) query = query.gte('created_at', since)

  const { data: rows, error } = await query
  if (error) { console.error('Could not read memories:', error.message); process.exit(1) }

  const useful = (rows ?? []).filter(
    (r) => WORTH_KEEPING.has(r.memory_type ?? '') && readValue(r.value).trim().length > 12,
  ) as MemoryRow[]

  // One note per project, so the vault gains pages a person would look for
  // rather than a thousand fragments.
  const byProject = new Map<string, MemoryRow[]>()
  for (const row of useful) {
    const name = row.brand_id ? brandName.get(row.brand_id) ?? 'Agency-wide' : 'Agency-wide'
    const list = byProject.get(name) ?? []
    list.push(row)
    byProject.set(name, list)
  }

  const outDir = path.join(root, 'Reference', 'NRS')
  if (!dry) fs.mkdirSync(outDir, { recursive: true })

  let written = 0
  for (const [project, memories] of byProject) {
    const bySection = new Map<string, MemoryRow[]>()
    for (const m of memories) {
      const s = SECTION[m.memory_type ?? ''] ?? 'Other'
      const list = bySection.get(s) ?? []
      list.push(m)
      bySection.set(s, list)
    }

    const lines: string[] = [
      '---',
      `created: ${new Date().toISOString().slice(0, 10)}`,
      `tags: [nrs, marketing, ${slugify(project)}]`,
      `project: ${project}`,
      'source: NotRealSmart Agency',
      '---',
      '',
      `# ${project} — what NRS has learned`,
      '',
      'Written by the NRS memory sync. The agency records this as it works;',
      'this file is a readable copy so the knowledge is not trapped in one system.',
      '',
    ]

    for (const [section, items] of [...bySection.entries()].sort()) {
      lines.push(`## ${section}`, '')
      // Newest first — the recent decision usually supersedes the old one.
      const sorted = [...items].sort((a, b) => b.created_at.localeCompare(a.created_at))
      const seen = new Set<string>()
      for (const m of sorted) {
        const text = readValue(m.value).trim().replace(/\s+/g, ' ')
        if (seen.has(text)) continue
        seen.add(text)
        const when = m.created_at.slice(0, 10)
        const confidence = m.confidence !== null && m.confidence < 0.8 ? ' *(uncertain)*' : ''
        lines.push(`- ${text}${confidence}  <sub>${when}</sub>`)
      }
      lines.push('')
    }

    const file = path.join(outDir, `${slugify(project)}.md`)
    if (dry) {
      console.log(`  would write ${path.relative(root, file)} — ${memories.length} memories`)
    } else {
      fs.writeFileSync(file, lines.join('\n'))
      console.log(`  ${path.relative(root, file)} — ${memories.length} memories`)
    }
    written++
  }

  console.log(
    `\n${dry ? 'would write' : 'wrote'} ${written} note${written === 1 ? '' : 's'} ` +
    `from ${useful.length} memories (${(rows ?? []).length - useful.length} conversation logs skipped)`,
  )
}

main().catch((e) => { console.error('Failed:', e instanceof Error ? e.message : e); process.exit(1) })

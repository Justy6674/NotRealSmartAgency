import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'

/**
 * A Director tool's return value is READ ALOUD to the owner. So a tool that
 * returns `Failed: ${error.message}` is not logging — it is speaking, and what
 * it says is whatever the database thought.
 *
 * This is the fault that put
 *   new row for relation "telegram_project_sessions" violates check constraint
 * in front of the owner's colleague on her first day.
 *
 * The rule: a string RETURNED from a tool may not interpolate a raw error.
 * Log it with console.error, or pass it through userSafeError first.
 */

const ROOT = process.cwd()
const TOOLS = resolve(ROOT, 'src/lib/agents/tools')

function toolFiles(dir: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry)
    if (statSync(path).isDirectory()) out.push(...toolFiles(path))
    else if (/\.ts$/.test(path) && !path.includes('.test.')) out.push(path)
  }
  return out
}

/**
 * Sites already reviewed and left as they are, with the reason. Every entry
 * here is a promise that the string cannot carry internal detail.
 *
 * The list may only ever shrink. A new leak must be fixed, not added.
 */
const REVIEWED: Record<string, string> = {}

test('no tool returns a raw error message to the owner', () => {
  const offenders: string[] = []

  for (const file of toolFiles(TOOLS)) {
    const source = readFileSync(file, 'utf8')
    const relative = file.replace(ROOT + '/', '')
    if (REVIEWED[relative]) continue

    source.split('\n').forEach((line, index) => {
      // Only RETURNED strings. console.error is the correct place for these.
      if (/console\.(error|warn|log)/.test(line)) return
      if (!/^\s*(return|.*error:)/.test(line)) return

      const interpolatesError =
        /\$\{[^}]*\b(?:error|err|e)\??\.(?:message|details|hint|code)\b[^}]*\}/.test(line) ||
        /\$\{[^}]*\bString\((?:error|err|e)\)[^}]*\}/.test(line)

      if (interpolatesError && !line.includes('userSafeError') && !line.includes('relayIfSafe')) {
        offenders.push(`${relative}:${index + 1}  ${line.trim().slice(0, 110)}`)
      }
    })
  }

  assert.deepEqual(
    offenders,
    [],
    `\nThese return a raw error to the owner. Wrap with userSafeError(scope, err, 'plain sentence'):\n\n${offenders.join('\n')}\n`,
  )
})

test('the guard is not vacuously passing', () => {
  // If the file walk or the pattern silently matched nothing, this test would
  // pass however bad the code was.
  const files = toolFiles(TOOLS)
  assert.ok(files.length > 20, `expected many tool files, found ${files.length}`)

  const sample = 'return `Failed: ${error.message}`'
  assert.ok(
    /\$\{[^}]*\b(?:error|err|e)\??\.(?:message|details|hint|code)\b[^}]*\}/.test(sample),
    'the pattern must match the shape it exists to catch',
  )
})

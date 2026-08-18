import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const css = readFileSync(resolve(process.cwd(), 'src/app/globals.css'), 'utf8')
const shellStart = css.indexOf('[data-nrs-shell] {')
assert.notEqual(shellStart, -1, 'signed-in shell tokens must exist')
const afterShell = css.slice(shellStart)
const nextBlock = afterShell.search(/\nhtml\.dark \[data-nrs-shell\]/)
const shell = afterShell.slice(0, nextBlock === -1 ? undefined : nextBlock)

test('desk shadcn surfaces follow house paper, not html.dark charcoal', () => {
  assert.match(shell, /--background:\s*var\(--bg\)/)
  assert.match(shell, /--card:\s*var\(--panel\)/)
  assert.match(shell, /--muted:\s*var\(--panel-2\)/)
  assert.match(shell, /--border:\s*var\(--line\)/)
  assert.match(shell, /--foreground:\s*var\(--ink\)/)
  assert.match(shell, /--primary:\s*var\(--brand-deep\)/)
  assert.match(shell, /--primary-foreground:\s*var\(--brand-ink\)/)
})

test('html.dark does not charcoal signed-in furniture', () => {
  assert.doesNotMatch(css, /\.dark \[data-nrs-shell\]\s*\{[^}]*--bg:\s*oklch\(0\.175/)
  assert.doesNotMatch(css, /\.dark \[data-nrs-shell\]\s*\{[^}]*--panel:\s*oklch\(0\.215/)
  assert.match(css, /html\.dark \[data-nrs-shell\]\s*\{\s*color-scheme:\s*light/)
})

test('desk type, icons and leftover ink-fill chips follow the mockup', () => {
  assert.match(shell, /font-size:\s*14px/)
  assert.match(css, /\[data-nrs-shell\] h1[\s\S]*font-size:\s*19px/)
  assert.match(css, /\[data-nrs-shell\] svg\.lucide[\s\S]*stroke-width:\s*1\.9/)
  assert.match(
    css,
    /\[data-nrs-shell\][\s\S]*\.bg-foreground[\s\S]*background-color:\s*var\(--brand-deep\)/,
  )
})

test('agency layout never emits a dark charcoal desk ramp', () => {
  const layout = readFileSync(
    resolve(process.cwd(), 'src/app/agency/layout.tsx'),
    'utf8',
  )
  assert.doesNotMatch(layout, /\.dark \$\{SHELL\}/)
  assert.doesNotMatch(layout, /fallbackDark/)
})

import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { brandThemeVars } from './brand-theme.ts'

test('desk shadcn surface tokens follow house paper, not the dark default', () => {
  const css = readFileSync(resolve(process.cwd(), 'src/app/globals.css'), 'utf8')
  const shell = css.slice(css.indexOf('[data-nrs-shell]'), css.indexOf('.dark [data-nrs-shell]'))
  assert.match(shell, /--background:\s*var\(--bg\)/)
  assert.match(shell, /--card:\s*var\(--panel\)/)
  assert.match(shell, /--muted:\s*var\(--panel-2\)/)
  assert.match(shell, /--border:\s*var\(--line\)/)
  assert.match(shell, /--foreground:\s*var\(--ink\)/)
})

test('Scent Sell cream paper still does not write --card itself — the alias does', () => {
  const vars = brandThemeVars(
    {
      brand_colours: {
        text: '#0e0e0e',
        accent: '#8a5923',
        primary: '#c37837',
        secondary: '#d49a4f',
        background: '#faf1e2',
      },
    },
    { dark: false },
  ) as Record<string, string>
  assert.equal(vars['--card'], undefined)
  assert.ok(vars['--bg'])
  assert.ok(vars['--panel'])
})

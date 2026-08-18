import assert from 'node:assert/strict'
import test from 'node:test'
import { assignPaletteRoles, extractNamedThemePalette } from './extract-brand-kit.ts'

/**
 * Condensed from the live Scent Sell sheet at https://www.scentsell.com.au
 * (`/assets/index-BtzX5ukn.css`, fetched 2026-08-18). The pale gold
 * `--copper-200` is the dark-theme accent and a utility mid-step — not the
 * button colour the owner sees on the cream site.
 */
const SCENT_SELL_LIVE_CSS = `
:root{--copper-50:#fbf1e2;--copper-100:#f2d9b0;--copper-200:#e4a968;--copper-300:#d49a4f;--copper-400:#8a5923;--copper-500:#704619;--cream-50:#fffdf7;--cream-100:#fff9f1;--ink-900:#0e0e0e}
:root,[data-theme=light]{--surface:#faf1e2;--ink:var(--ink-900);--accent:var(--copper-400);--accent-hi:var(--copper-500)}
:root,[data-theme=light]{--background:35 56% 93.5%;--foreground:0 0% 5%;--primary:28 56% 49%;--secondary:36 60% 92%}
[data-theme=dark]{--surface:var(--ink-900);--accent:var(--copper-200);--primary:28 65% 65%}
`

test('Scent Sell’s named light tokens beat the pale gold mid-step', () => {
  const palette = extractNamedThemePalette(SCENT_SELL_LIVE_CSS)
  assert.ok(palette)
  assert.equal(palette.primary, '#c37837')
  assert.equal(palette.accent, '#8a5923')
  assert.equal(palette.background, '#faf1e2')
  assert.equal(palette.text, '#0e0e0e')
  assert.equal(palette.secondary, '#d49a4f')
  assert.notEqual(palette.primary, '#e4a968')
})

test('frequency ranking alone would still pick the pale gold — that is why named tokens win', () => {
  const ranked = assignPaletteRoles(['#e4a968', '#8a5923', '#faf1e2', '#0e0e0e'])
  assert.ok(ranked)
  assert.equal(ranked.primary, '#e4a968')
})

import assert from 'node:assert/strict'
import test from 'node:test'
import { brandAccentColour, resolveAccent, brandThemeVars } from './brand-theme.ts'

const scentSell = {
  brand_colours: {
    text: '#0e0e0e',
    accent: '#c28237',
    primary: '#e4a968',
    secondary: '#faf1e2',
    background: '#fff9f1',
  },
}

test('Scent Sell’s stored gold is a real accent, not house silver', () => {
  const colour = brandAccentColour(scentSell)
  assert.equal(colour, '#e4a968')
  const accent = resolveAccent(colour)
  assert.equal(accent.isFallback, false)
  assert.ok(accent.hue > 50 && accent.hue < 100, `expected gold hue, got ${accent.hue}`)
})

test('dark Desk tokens keep the business hue and never invent --care from it', () => {
  const vars = brandThemeVars('#e4a968', { dark: true }) as Record<string, string>
  assert.match(vars['--brand'], /oklch\(0\.74 /)
  assert.match(vars['--brand-deep'], /oklch\(0\.87 /)
  assert.doesNotMatch(vars['--brand'], / 25\)/)
  assert.equal(vars['--care'], undefined)
})

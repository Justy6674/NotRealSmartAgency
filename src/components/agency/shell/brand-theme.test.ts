import assert from 'node:assert/strict'
import test from 'node:test'
import { brandAccentColour, resolveAccent, brandThemeVars } from './brand-theme.ts'

const scentSell = {
  brand_colours: {
    text: '#0e0e0e',
    accent: '#8a5923',
    primary: '#c37837',
    secondary: '#d49a4f',
    background: '#faf1e2',
  },
}

test('Scent Sell retints from the live site copper, not the pale gold mid-step', () => {
  const colour = brandAccentColour(scentSell)
  assert.equal(colour, '#c37837')
  const accent = resolveAccent(colour)
  assert.equal(accent.isFallback, false)
  // Live --primary is hsl(28 56% 49%) → oklch hue ~58.6 (copper). The rejected
  // guess was #e4a968 (hue ~67.8, a yellow gold).
  assert.ok(accent.hue > 50 && accent.hue < 64, `expected copper hue, got ${accent.hue}`)
})

test('dark Desk tokens keep the business hue and never invent --care from it', () => {
  const vars = brandThemeVars('#c37837', { dark: true }) as Record<string, string>
  assert.match(vars['--brand'], /oklch\(0\.74 /)
  assert.match(vars['--brand-deep'], /oklch\(0\.87 /)
  assert.match(vars['--brand'], / 58\.6\)/)
  assert.doesNotMatch(vars['--brand'], / 25\)/)
  assert.equal(vars['--care'], undefined)
})

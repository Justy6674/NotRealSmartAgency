import assert from 'node:assert/strict'
import test from 'node:test'
import {
  brandAccentColour,
  brandHasSurfacePalette,
  brandThemeVars,
  resolveAccent,
} from './brand-theme.ts'

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

test('Scent Sell paints cream paper and copper buttons from stored website tokens', () => {
  assert.equal(brandHasSurfacePalette(scentSell), true)
  const vars = brandThemeVars(scentSell, { dark: false }) as Record<string, string>
  assert.match(vars['--bg'], /oklch\(0\.9/)
  assert.match(vars['--ink'], /oklch\(0\.1/)
  assert.match(vars['--brand-deep'], /oklch\(0\.6/)
  assert.match(vars['--brand-deep'], / 58\.6\)/)
  assert.doesNotMatch(vars['--bg'], /0\.175/)
})

test('dark Desk accent tokens keep the business hue when only an accent string is passed', () => {
  const vars = brandThemeVars('#c37837', { dark: true }) as Record<string, string>
  assert.match(vars['--brand'], /oklch\(0\.74 /)
  assert.match(vars['--brand-deep'], /oklch\(0\.87 /)
  assert.match(vars['--brand'], / 58\.6\)/)
  assert.doesNotMatch(vars['--brand'], / 25\)/)
  assert.equal(vars['--care'], undefined)
})

test('stored background keeps light desk surfaces even when dark mode is requested', () => {
  const vars = brandThemeVars(scentSell, { dark: true }) as Record<string, string>
  assert.match(vars['--bg'], /oklch\(0\.9/)
  assert.match(vars['--brand-deep'], /oklch\(0\.6/)
})

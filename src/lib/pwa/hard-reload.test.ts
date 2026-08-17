import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import test from 'node:test'

const source = readFileSync(resolve(process.cwd(), 'src/lib/pwa/hard-reload.ts'), 'utf8')
const button = readFileSync(resolve(process.cwd(), 'src/components/agency/shell/ReloadAppButton.tsx'), 'utf8')

test('hard reload unregisters workers and clears this origin’s caches before replacing the page', () => {
  assert.match(source, /serviceWorker\.getRegistrations/)
  assert.match(source, /registration\.unregister/)
  assert.match(source, /caches\.keys/)
  assert.match(source, /caches\.delete/)
  assert.match(source, /location\.replace/)
  assert.match(source, /_reload/)
})

test('the Reload control is owner-plain and never names the browser', () => {
  assert.match(button, /Reload the latest version/)
  assert.match(button, /hardReloadApp/)
  assert.doesNotMatch(button, /title="[^"]*(Safari|service worker)/i)
  assert.doesNotMatch(button, /aria-label="[^"]*(Safari|service worker)/i)
})

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const source = readFileSync(resolve(process.cwd(), 'src/app/telegram/timeline-view.tsx'), 'utf8')

test('a direct Director caption with hashtags renders the copy card', () => {
  assert.match(source, /function isCopyReadySocialText/)
  assert.match(source, /<CaptionBlock hook="" caption=\{text\} hashtags=\{\[\]\} \/>/)
})

test('unsaved direct copy cannot present an edit-and-save control', () => {
  assert.match(source, /onSave\?: \(next: string\) => void/)
  assert.match(source, /\{onSave && \(/)
})

test('stored social proposals expose a clear review state and explicit draft action', () => {
  assert.match(source, /Saved in NRS · not in Mixpost yet/)
  assert.match(source, /Save as Mixpost draft/)
  assert.match(source, /Saving a draft never publishes it/)
})

test('a fallback chat-only caption says plainly that it has not been saved', () => {
  assert.match(source, /Prepared in this chat · not saved in NRS or Mixpost/)
})

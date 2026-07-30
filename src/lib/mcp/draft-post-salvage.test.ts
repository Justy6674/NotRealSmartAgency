import assert from 'node:assert/strict'
import test from 'node:test'
import { salvageCaptionFromEnvelope } from './draft-post-tool.ts'

test('a truncated envelope still yields its caption', () => {
  // A response cut short mid-object parses as nothing, and the fallback then
  // wrote the raw `{"caption":"…` into the post — a draft that reads as code.
  const salvaged = salvageCaptionFromEnvelope(
    '{"caption":"That bottle in your cupboard you\'ve worn twice? Someone wants it.","hashtags":["swap","fragrance"',
  )
  assert.ok(salvaged)
  assert.match(salvaged!.caption, /^That bottle in your cupboard/)
  assert.deepEqual(salvaged!.hashtags, ['swap', 'fragrance'])
})

test('escaped newlines inside the caption survive', () => {
  const salvaged = salvageCaptionFromEnvelope('{"caption":"Line one.\\n\\nLine two.","hashtags":[]')
  assert.equal(salvaged!.caption, 'Line one.\n\nLine two.')
})

test('an escaped quote inside the caption does not truncate it', () => {
  const salvaged = salvageCaptionFromEnvelope('{"caption":"She said \\"try it\\" and meant it.","hashtags":[]')
  assert.match(salvaged!.caption, /She said "try it" and meant it\./)
})

test('plain prose is not mistaken for an envelope', () => {
  // Content & Copy ignoring the format entirely is the intended fallback:
  // the raw text is the caption, and salvage must not interfere.
  assert.equal(salvageCaptionFromEnvelope('That bottle in your cupboard. Someone wants it.'), null)
})

test('an envelope with no caption field is not salvaged', () => {
  assert.equal(salvageCaptionFromEnvelope('{"hashtags":["swap"]}'), null)
})

test('an empty caption is not salvaged into an empty post', () => {
  assert.equal(salvageCaptionFromEnvelope('{"caption":"   ","hashtags":[]}'), null)
})

test('hashtags are cleaned the same way as the parsed path', () => {
  const salvaged = salvageCaptionFromEnvelope('{"caption":"x","hashtags":["#Swap","Scent Sell"]')
  assert.deepEqual(salvaged!.hashtags, ['swap', 'scentsell'])
})

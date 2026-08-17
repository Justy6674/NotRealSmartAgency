import assert from 'node:assert/strict'
import test from 'node:test'
import { formatFileSize } from './format-file-size.ts'

test('null size is blank, not 0KB', () => {
  assert.equal(formatFileSize(null), '')
})

test('a 67-byte file shows exact bytes, never 0KB', () => {
  assert.equal(formatFileSize(67), '67 B')
})

test('zero bytes is 0 B, not blank', () => {
  assert.equal(formatFileSize(0), '0 B')
})

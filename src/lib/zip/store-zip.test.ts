import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { buildZip, crc32, safeEntryName } from './store-zip'

const bytes = (text: string) => new TextEncoder().encode(text)

test('crc32 matches the published check value', () => {
  // The standard CRC-32 test vector: "123456789" → 0xCBF43926.
  assert.equal(crc32(bytes('123456789')), 0xcbf43926)
})

test('an archive starts with the local header signature and ends with EOCD', () => {
  const zip = buildZip([{ name: 'slide-1.jpg', data: bytes('first') }])
  assert.deepEqual(Array.from(zip.slice(0, 4)), [0x50, 0x4b, 0x03, 0x04])
  const tail = zip.slice(zip.length - 22, zip.length - 18)
  assert.deepEqual(Array.from(tail), [0x50, 0x4b, 0x05, 0x06])
})

test('the entry count in the end record matches what went in', () => {
  const zip = buildZip([
    { name: 'a.jpg', data: bytes('one') },
    { name: 'b.jpg', data: bytes('two') },
    { name: 'c.jpg', data: bytes('three') },
  ])
  const view = new DataView(zip.buffer, zip.byteOffset, zip.byteLength)
  assert.equal(view.getUint16(zip.length - 22 + 8, true), 3)
  assert.equal(view.getUint16(zip.length - 22 + 10, true), 3)
})

test('the same slides produce a byte-identical archive', () => {
  const entries = [{ name: 'slide-1.jpg', data: bytes('same') }]
  assert.deepEqual(Array.from(buildZip(entries)), Array.from(buildZip(entries)))
})

test('an empty set still produces a valid, openable archive', () => {
  const zip = buildZip([])
  assert.equal(zip.length, 22)
  assert.deepEqual(Array.from(zip.slice(0, 4)), [0x50, 0x4b, 0x05, 0x06])
})

/**
 * The one that matters: a real unzipper has to accept this, not just our own
 * reading of the spec. macOS and Linux both ship `unzip`.
 */
test('the system unzip tool extracts the files intact', () => {
  const dir = mkdtempSync(join(tmpdir(), 'nrs-zip-'))
  try {
    const zip = buildZip([
      { name: 'slide-1.jpg', data: bytes('first slide') },
      { name: 'slide-2.jpg', data: bytes('second slide') },
    ])
    const archive = join(dir, 'slides.zip')
    writeFileSync(archive, zip)

    execFileSync('unzip', ['-qq', '-o', archive, '-d', dir])

    assert.equal(readFileSync(join(dir, 'slide-1.jpg'), 'utf8'), 'first slide')
    assert.equal(readFileSync(join(dir, 'slide-2.jpg'), 'utf8'), 'second slide')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('a file name cannot escape the archive', () => {
  // Separators become dashes, so nothing is left that an unzipper reads as a
  // directory step — the name is flattened, not merely rejected.
  const escaped = safeEntryName('../../etc/passwd', 'slide.jpg')
  assert.doesNotMatch(escaped, /[\\/]/)
  assert.equal(escaped, '-..-etc-passwd')
  assert.equal(safeEntryName('a/b\\c.jpg', 'slide.jpg'), 'a-b-c.jpg')
  assert.equal(safeEntryName('   ', 'slide-3.jpg'), 'slide-3.jpg')
  assert.equal(safeEntryName('...', 'slide-3.jpg'), 'slide-3.jpg')
})

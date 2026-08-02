/**
 * A minimal ZIP writer, stored (uncompressed) entries only.
 *
 * Why hand-rolled rather than a dependency: everything that goes in one of
 * these archives is a JPEG, PNG or MP4 — already compressed. Deflate would
 * spend CPU to save nothing, so the only thing a zip library would add here is
 * a supply-chain surface for a container format that is a few dozen lines.
 *
 * Format: local file header + data per entry, then a central directory, then
 * the end-of-central-directory record. No ZIP64, so an archive is capped at
 * 4GB and 65,535 entries — a carousel is ten images.
 */

/** CRC-32 (IEEE 802.3), the checksum every ZIP entry carries. */
const CRC_TABLE = (() => {
  const table = new Uint32Array(256)
  for (let i = 0; i < 256; i++) {
    let c = i
    for (let bit = 0; bit < 8; bit++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    }
    table[i] = c >>> 0
  }
  return table
})()

export function crc32(data: Uint8Array): number {
  let crc = 0xffffffff
  for (let i = 0; i < data.length; i++) {
    crc = CRC_TABLE[(crc ^ data[i]) & 0xff] ^ (crc >>> 8)
  }
  return (crc ^ 0xffffffff) >>> 0
}

export interface ZipEntry {
  /** Path inside the archive. Forward slashes only. */
  name: string
  data: Uint8Array
}

/**
 * Strip anything that would let a file name escape the archive or upset a
 * desktop unzipper. A caption written by a language model reaches this as a
 * file name, so it cannot be trusted to be path-safe.
 */
export function safeEntryName(name: string, fallback: string): string {
  const cleaned = name
    .replace(/[\\/]/g, '-')
    .replace(/[\x00-\x1f<>:"|?*]/g, '')
    .replace(/^\.+/, '')
    .trim()
    .slice(0, 120)
  return cleaned || fallback
}

function writeUint32(view: DataView, offset: number, value: number): void {
  view.setUint32(offset, value >>> 0, true)
}

function writeUint16(view: DataView, offset: number, value: number): void {
  view.setUint16(offset, value & 0xffff, true)
}

/**
 * Build the archive.
 *
 * Timestamps are fixed rather than "now": the same set of slides should
 * produce a byte-identical archive, which makes the route cacheable and the
 * tests deterministic. 1980-01-01 is the ZIP epoch.
 */
export function buildZip(entries: readonly ZipEntry[]): Uint8Array {
  const encoder = new TextEncoder()
  const encoded = entries.map((entry) => ({
    nameBytes: encoder.encode(entry.name),
    data: entry.data,
    crc: crc32(entry.data),
  }))

  const LOCAL_HEADER = 30
  const CENTRAL_HEADER = 46
  const END_RECORD = 22

  let localSize = 0
  let centralSize = 0
  for (const entry of encoded) {
    localSize += LOCAL_HEADER + entry.nameBytes.length + entry.data.length
    centralSize += CENTRAL_HEADER + entry.nameBytes.length
  }

  const out = new Uint8Array(localSize + centralSize + END_RECORD)
  const view = new DataView(out.buffer)
  const offsets: number[] = []
  let cursor = 0

  for (const entry of encoded) {
    offsets.push(cursor)
    writeUint32(view, cursor, 0x04034b50) // local file header signature
    writeUint16(view, cursor + 4, 20) // version needed
    writeUint16(view, cursor + 6, 0x0800) // flags: UTF-8 file names
    writeUint16(view, cursor + 8, 0) // method: stored
    writeUint16(view, cursor + 10, 0) // mod time
    writeUint16(view, cursor + 12, 0x0021) // mod date: 1980-01-01
    writeUint32(view, cursor + 14, entry.crc)
    writeUint32(view, cursor + 18, entry.data.length) // compressed size
    writeUint32(view, cursor + 22, entry.data.length) // uncompressed size
    writeUint16(view, cursor + 26, entry.nameBytes.length)
    writeUint16(view, cursor + 28, 0) // extra field length
    cursor += LOCAL_HEADER
    out.set(entry.nameBytes, cursor)
    cursor += entry.nameBytes.length
    out.set(entry.data, cursor)
    cursor += entry.data.length
  }

  const centralStart = cursor
  encoded.forEach((entry, index) => {
    writeUint32(view, cursor, 0x02014b50) // central directory signature
    writeUint16(view, cursor + 4, 20) // version made by
    writeUint16(view, cursor + 6, 20) // version needed
    writeUint16(view, cursor + 8, 0x0800) // flags: UTF-8
    writeUint16(view, cursor + 10, 0) // method: stored
    writeUint16(view, cursor + 12, 0) // mod time
    writeUint16(view, cursor + 14, 0x0021) // mod date
    writeUint32(view, cursor + 16, entry.crc)
    writeUint32(view, cursor + 20, entry.data.length)
    writeUint32(view, cursor + 24, entry.data.length)
    writeUint16(view, cursor + 28, entry.nameBytes.length)
    writeUint16(view, cursor + 30, 0) // extra
    writeUint16(view, cursor + 32, 0) // comment
    writeUint16(view, cursor + 34, 0) // disk number
    writeUint16(view, cursor + 36, 0) // internal attrs
    writeUint32(view, cursor + 38, 0) // external attrs
    writeUint32(view, cursor + 42, offsets[index])
    cursor += CENTRAL_HEADER
    out.set(entry.nameBytes, cursor)
    cursor += entry.nameBytes.length
  })

  writeUint32(view, cursor, 0x06054b50) // end of central directory
  writeUint16(view, cursor + 4, 0)
  writeUint16(view, cursor + 6, 0)
  writeUint16(view, cursor + 8, encoded.length)
  writeUint16(view, cursor + 10, encoded.length)
  writeUint32(view, cursor + 12, cursor - centralStart)
  writeUint32(view, cursor + 16, centralStart)
  writeUint16(view, cursor + 20, 0) // comment length

  return out
}

/** Telegram limits each sendMessage body to 4,096 UTF-16 code units. */
export function splitTelegramMessage(text: string, limit = 4096): string[] {
  const chunks: string[] = []
  let remaining = text.trim()

  while (remaining.length > limit) {
    const boundary = remaining.lastIndexOf('\n', limit)
    const end = boundary > 0 ? boundary : limit
    chunks.push(remaining.slice(0, end))
    remaining = remaining.slice(boundary > 0 ? boundary + 1 : end).trimStart()
  }

  if (remaining) chunks.push(remaining)
  return chunks
}

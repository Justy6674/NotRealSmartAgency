/**
 * Simplified 2-layer ASR transcription (ported from TeleScribe).
 * Layer 1: Deepgram nova-2 (cheapest, fastest)
 * Layer 2: OpenAI Whisper-1 (battle-tested fallback)
 */

export interface TranscriptionResult {
  text: string
  model: string
  duration?: number
}

/**
 * Deepgram URL mode — send the file URL, Deepgram fetches it directly.
 * No download into serverless memory. Works for any file size.
 */
async function transcribeWithDeepgramUrl(fileUrl: string): Promise<TranscriptionResult> {
  const apiKey = process.env.DEEPGRAM_API_KEY
  if (!apiKey) throw new Error('DEEPGRAM_API_KEY not configured')

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 180_000) // 3 min — Deepgram fetches + processes

  try {
    const res = await fetch('https://api.deepgram.com/v1/listen?model=nova-2&language=en-AU&smart_format=true&punctuate=true', {
      method: 'POST',
      headers: {
        Authorization: `Token ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ url: fileUrl }),
      signal: controller.signal,
    })

    if (!res.ok) throw new Error(`Deepgram ${res.status}: ${await res.text()}`)

    const data = await res.json()
    const transcript = data.results?.channels?.[0]?.alternatives?.[0]?.transcript ?? ''
    const duration = data.metadata?.duration

    if (!transcript.trim()) throw new Error('Empty transcription from Deepgram')

    return { text: transcript, model: 'deepgram-nova-2', duration }
  } finally {
    clearTimeout(timeout)
  }
}

async function transcribeWithWhisper(audioBuffer: ArrayBuffer, fileName: string): Promise<TranscriptionResult> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) throw new Error('OPENAI_API_KEY not configured')

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 60_000)

  try {
    const formData = new FormData()
    formData.append('file', new Blob([audioBuffer]), fileName)
    formData.append('model', 'whisper-1')
    formData.append('language', 'en')
    formData.append('response_format', 'verbose_json')

    const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: formData,
      signal: controller.signal,
    })

    if (!res.ok) throw new Error(`Whisper ${res.status}: ${await res.text()}`)

    const data = await res.json()
    const transcript = data.text ?? ''
    const duration = data.duration

    if (!transcript.trim()) throw new Error('Empty transcription from Whisper')

    return { text: transcript, model: 'openai-whisper-1', duration }
  } finally {
    clearTimeout(timeout)
  }
}

const WHISPER_MAX_SIZE = 25 * 1024 * 1024 // 25MB — Whisper's file size limit

/**
 * Transcribe an audio/video file with 2-layer fallback.
 * Layer 1: Deepgram URL mode — sends the URL, Deepgram fetches the file (no memory usage).
 * Layer 2: OpenAI Whisper — only for files under 25MB (downloads file to send).
 */
export async function transcribeFile(
  fileUrl: string,
  fileName: string = 'audio.mp4',
  fileSizeBytes?: number
): Promise<TranscriptionResult> {
  const errors: string[] = []

  // Layer 1: Deepgram URL mode (no download, works for any file size)
  try {
    return await transcribeWithDeepgramUrl(fileUrl)
  } catch (err) {
    errors.push(`Deepgram: ${err instanceof Error ? err.message : 'unknown'}`)
  }

  // Layer 2: OpenAI Whisper (requires download, only for files under 25MB)
  //
  // A video that is too big to hand Whisper is almost never too big once the
  // pixels are removed — the 241MB clip that exposed this carries 2.2MB of
  // audio, extracted in about four seconds. Refusing outright meant that when
  // Deepgram was unavailable there was no fallback at all for real footage,
  // which is precisely when a fallback earns its keep.
  const tooLargeForWhisper = fileSizeBytes != null && fileSizeBytes > WHISPER_MAX_SIZE
  if (tooLargeForWhisper) {
    try {
      const { extractAudioFromUrl } = await import('@/lib/video/extract-audio')
      const audio = await extractAudioFromUrl(fileUrl)
      if (audio.bytes > WHISPER_MAX_SIZE) {
        throw new Error(`audio alone is still ${Math.round(audio.bytes / 1024 / 1024)}MB`)
      }
      return await transcribeWithWhisper(
        audio.buffer.buffer.slice(audio.buffer.byteOffset, audio.buffer.byteOffset + audio.buffer.byteLength) as ArrayBuffer,
        audio.fileName,
      )
    } catch (err) {
      errors.push(`Whisper via audio extraction: ${err instanceof Error ? err.message : 'unknown'}`)
    }
  } else {
    try {
      const fileRes = await fetch(fileUrl)
      if (!fileRes.ok) throw new Error(`Failed to download file: ${fileRes.status}`)
      const audioBuffer = await fileRes.arrayBuffer()

      // Double-check actual size
      if (audioBuffer.byteLength > WHISPER_MAX_SIZE) {
        throw new Error(`File too large for Whisper (${Math.round(audioBuffer.byteLength / 1024 / 1024)}MB)`)
      }

      return await transcribeWithWhisper(audioBuffer, fileName)
    } catch (err) {
      errors.push(`Whisper: ${err instanceof Error ? err.message : 'unknown'}`)
    }
  }

  throw new Error(`All transcription layers failed: ${errors.join('; ')}`)
}

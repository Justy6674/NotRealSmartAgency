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

async function transcribeWithDeepgram(audioBuffer: ArrayBuffer, contentType: string): Promise<TranscriptionResult> {
  const apiKey = process.env.DEEPGRAM_API_KEY
  if (!apiKey) throw new Error('DEEPGRAM_API_KEY not configured')

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 30_000)

  try {
    const res = await fetch('https://api.deepgram.com/v1/listen?model=nova-2&language=en-AU&smart_format=true&punctuate=true', {
      method: 'POST',
      headers: {
        Authorization: `Token ${apiKey}`,
        'Content-Type': contentType,
      },
      body: audioBuffer,
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

/**
 * Transcribe an audio/video file with 2-layer fallback.
 * Downloads the file from the URL, then tries Deepgram → Whisper.
 */
export async function transcribeFile(
  fileUrl: string,
  fileName: string = 'audio.mp4'
): Promise<TranscriptionResult> {
  // Download the file
  const fileRes = await fetch(fileUrl)
  if (!fileRes.ok) throw new Error(`Failed to download file: ${fileRes.status}`)

  const audioBuffer = await fileRes.arrayBuffer()
  const contentType = fileRes.headers.get('content-type') ?? 'audio/mp4'

  const errors: string[] = []

  // Layer 1: Deepgram
  try {
    return await transcribeWithDeepgram(audioBuffer, contentType)
  } catch (err) {
    errors.push(`Deepgram: ${err instanceof Error ? err.message : 'unknown'}`)
  }

  // Layer 2: OpenAI Whisper
  try {
    return await transcribeWithWhisper(audioBuffer, fileName)
  } catch (err) {
    errors.push(`Whisper: ${err instanceof Error ? err.message : 'unknown'}`)
  }

  throw new Error(`All transcription layers failed: ${errors.join('; ')}`)
}

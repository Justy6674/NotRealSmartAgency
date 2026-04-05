/**
 * Client for the AI video generation toolkit.
 * Calls Modal cloud GPU endpoints for voiceover, image, and music generation.
 *
 * Requires environment variables:
 * - MODAL_QWEN3_TTS_ENDPOINT_URL (text-to-speech)
 * - MODAL_FLUX2_ENDPOINT_URL (image generation)
 * - MODAL_ACE_STEP_ENDPOINT_URL (music generation)
 */

export interface VoiceoverResult {
  audioUrl: string
  duration?: number
}

export interface ImageResult {
  imageUrl: string
  width: number
  height: number
}

export interface MusicResult {
  audioUrl: string
  duration?: number
}

const SPEAKERS = [
  'Aria',
  'Roger',
  'Sarah',
  'George',
  'Amelia',
  'Ryan',
  'Emma',
  'Liam',
  'Isabella',
] as const

export type Speaker = (typeof SPEAKERS)[number]
export { SPEAKERS }

/** Returns true if at least one toolkit endpoint is configured. */
export function isToolkitConfigured(): boolean {
  return !!(
    process.env.MODAL_QWEN3_TTS_ENDPOINT_URL ||
    process.env.MODAL_FLUX2_ENDPOINT_URL ||
    process.env.MODAL_ACE_STEP_ENDPOINT_URL
  )
}

/** Returns which individual tools have their endpoint configured. */
export function getConfiguredTools(): {
  voiceover: boolean
  image: boolean
  music: boolean
} {
  return {
    voiceover: !!process.env.MODAL_QWEN3_TTS_ENDPOINT_URL,
    image: !!process.env.MODAL_FLUX2_ENDPOINT_URL,
    music: !!process.env.MODAL_ACE_STEP_ENDPOINT_URL,
  }
}

/**
 * Generate a voiceover from text using Qwen3-TTS on Modal.
 * @param text - The script text to speak (max ~5 000 chars).
 * @param speaker - One of the preset Qwen3-TTS speaker voices.
 */
export async function generateVoiceover(
  text: string,
  speaker: Speaker = 'Ryan'
): Promise<VoiceoverResult> {
  const endpoint = process.env.MODAL_QWEN3_TTS_ENDPOINT_URL
  if (!endpoint)
    throw new Error(
      'Voiceover not configured — set MODAL_QWEN3_TTS_ENDPOINT_URL'
    )

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, speaker }),
    signal: AbortSignal.timeout(120_000), // 2 min timeout
  })

  if (!res.ok) throw new Error(`Voiceover generation failed: ${res.status}`)

  const data = await res.json()
  return {
    audioUrl: data.url ?? data.audio_url ?? '',
    duration: data.duration,
  }
}

/**
 * Generate an image from a prompt using FLUX.2 on Modal.
 * @param prompt - The image description.
 * @param width - Output width in pixels (default 1920).
 * @param height - Output height in pixels (default 1080).
 */
export async function generateImage(
  prompt: string,
  width = 1920,
  height = 1080
): Promise<ImageResult> {
  const endpoint = process.env.MODAL_FLUX2_ENDPOINT_URL
  if (!endpoint)
    throw new Error(
      'Image generation not configured — set MODAL_FLUX2_ENDPOINT_URL'
    )

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, width, height }),
    signal: AbortSignal.timeout(120_000),
  })

  if (!res.ok) throw new Error(`Image generation failed: ${res.status}`)

  const data = await res.json()
  return {
    imageUrl: data.url ?? data.image_url ?? '',
    width,
    height,
  }
}

/**
 * Generate royalty-free background music using ACE-Step on Modal.
 * @param prompt - A description of the desired music style/mood.
 * @param duration - Length in seconds (default 30, max ~180).
 */
export async function generateMusic(
  prompt: string,
  duration = 30
): Promise<MusicResult> {
  const endpoint = process.env.MODAL_ACE_STEP_ENDPOINT_URL
  if (!endpoint)
    throw new Error(
      'Music generation not configured — set MODAL_ACE_STEP_ENDPOINT_URL'
    )

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, duration }),
    signal: AbortSignal.timeout(180_000), // 3 min timeout for music
  })

  if (!res.ok) throw new Error(`Music generation failed: ${res.status}`)

  const data = await res.json()
  return {
    audioUrl: data.url ?? data.audio_url ?? '',
    duration: data.duration ?? duration,
  }
}

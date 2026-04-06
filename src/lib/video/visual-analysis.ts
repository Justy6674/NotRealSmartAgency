import { generateText } from 'ai'
import { gateway } from '@ai-sdk/gateway'

export interface VisualAnalysis {
  scenes: string[]
  products: string[]
  textOnScreen: string[]
  mood: string
  thumbnailFrameIndex: number
  summary: string
  recommended_format: 'short' | 'full' | 'either'
}

/**
 * Analyse video frames using Claude's multimodal vision.
 * Extracts scene descriptions, visible products, on-screen text,
 * mood, best thumbnail candidate, and an overall summary.
 *
 * Returns null on failure — callers should treat this as non-blocking.
 */
export async function analyseVideoFrames(
  frameUrls: string[],
  transcription?: string | null,
  durationSeconds?: number | null
): Promise<VisualAnalysis | null> {
  if (!frameUrls.length) return null

  try {
    // Build multimodal content with frame images
    const imageContent = frameUrls.map((url) => ({
      type: 'image' as const,
      image: new URL(url),
    }))

    const transcriptionContext = transcription
      ? `\n\nAudio transcription: "${transcription.slice(0, 1000)}"`
      : ''

    const { text } = await generateText({
      model: gateway('anthropic/claude-sonnet-4-20250514'),
      messages: [
        {
          role: 'user',
          content: [
            ...imageContent,
            {
              type: 'text',
              text: `Analyse these ${frameUrls.length} frames from a marketing video.${transcriptionContext}

Return a JSON object with:
- "scenes": array of 1-sentence descriptions of what's happening in each frame
- "products": array of products/objects visible (brand names, items, packaging)
- "textOnScreen": array of any text visible on screen (titles, captions, watermarks)
- "mood": overall mood/vibe in 3-5 words (e.g. "warm, professional, inviting")
- "thumbnailFrameIndex": which frame (0-indexed) would make the best thumbnail
- "summary": a 1-sentence summary of what this video is about

Return ONLY valid JSON, no markdown fences.`,
            },
          ],
        },
      ],
      maxOutputTokens: 1000,
    })

    // Parse the JSON response — strip any accidental markdown fences
    const cleaned = text.replace(/```json\n?|\n?```/g, '').trim()
    const parsed = JSON.parse(cleaned) as Omit<VisualAnalysis, 'recommended_format'>

    // Classify format based on duration
    const recommended_format: VisualAnalysis['recommended_format'] =
      !durationSeconds ? 'either'
      : durationSeconds < 60 ? 'short'
      : durationSeconds > 120 ? 'full'
      : 'either'

    return { ...parsed, recommended_format }
  } catch (err) {
    console.error('Visual analysis failed:', err)
    return null
  }
}

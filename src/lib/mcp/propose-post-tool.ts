/**
 * propose_post_from_media — MCP tool for media-aware creation sessions.
 *
 * Lets MCP clients (Gemini / Claude Code / Cowork / etc.) drive the same
 * creation session flow the web Creator uses. The client picks media on
 * behalf of the user, asks this tool for a proposal, shows it to the human,
 * collects feedback, and iterates by calling this tool again with the
 * previous JSON + feedback.
 *
 * The tool delegates to Content & Copy via runAgentWorker (NOT the Director)
 * so it returns in ~15-30 seconds — fits inside any MCP client timeout.
 * Content & Copy writes hook + caption + hashtags + post_type + rationale.
 *
 * When the human approves, the client should then call `draft_post` with
 * the finalised caption + hashtags + media_id to land it in the Review
 * queue. This tool does NOT write to scheduled_posts itself.
 */

import { z } from 'zod/v3'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { createAdminClient } from '@/lib/supabase/admin'
import { createProposePostTool } from '@/lib/agents/tools/propose-post'

const PLATFORMS = ['instagram', 'facebook', 'linkedin', 'tiktok', 'youtube', 'twitter'] as const
type Platform = (typeof PLATFORMS)[number]

export function registerProposePostTool(mcpServer: McpServer, userId: string) {
  mcpServer.registerTool(
    'propose_post_from_media',
    {
      description: `Ask Content & Copy for a post idea based on media the user has selected. Use this when the human user has picked 1 video or 1-10 images and wants a creative proposal BEFORE committing to a draft.

CRITICAL: You (the AI client) are NOT writing the proposal. Content & Copy (the Director's specialist) writes it. You pass the media_ids + the user's angle hint verbatim, and this tool returns a structured proposal. Show it to the user and collect their feedback.

ITERATION LOOP (this is the whole point):
1. First call — propose_post_from_media({ brand_id, media_ids, platform, angle? }) → returns { hook, caption, hashtags, post_type, rationale }
2. Show the proposal to the human user IN THE CLIENT (in Gemini/Claude Code/Cowork chat)
3. Wait for their feedback ("make it funnier", "shorter hook", "different angle", "try a carousel instead")
4. Call propose_post_from_media AGAIN with the same media_ids + the previous JSON as previous_proposal + their feedback as user_feedback
5. Repeat steps 2-4 until the user approves ("perfect", "looks good", "draft it")
6. On approval, call draft_post({ brand_id, intent, platform, media_id }) where intent is the user's final agreed angle — draft_post goes to Content & Copy one more time to produce the final polished version and lands it in the Review queue

USAGE:
- ALWAYS call query_media first to get the real media UUIDs. Don't guess.
- platform must match what the user told you (instagram/facebook/linkedin/tiktok/youtube/twitter)
- angle is optional — if the user said "about authenticity" or "customer testimonial" vibe, put it there verbatim
- Never supply hook/caption/hashtags yourself. That's Content & Copy's job.

WHY: the user is iterating on a creative proposal. They need to see drafts, give feedback, and feel like they're collaborating with the agency — not being handed a final product with no input. The iteration loop is the product.`,
      inputSchema: {
        brand_id: z.string().uuid().describe('Brand ID — call list_brands first'),
        media_ids: z
          .array(z.string().uuid())
          .min(1)
          .max(10)
          .describe('UUIDs of media_items rows (1-10). Get these from query_media.'),
        platform: z.enum(PLATFORMS).describe('Which platform the post is for'),
        angle: z
          .string()
          .optional()
          .describe('Optional user-supplied angle hint, e.g. "fragrance authentication" or "behind the scenes". Pass it verbatim from the user — never invent one.'),
        previous_proposal: z
          .string()
          .optional()
          .describe('For iterations: the full raw JSON of the previous proposal (the "Raw JSON for next iteration" block from the last call). Enables Content & Copy to refine instead of restart.'),
        user_feedback: z
          .string()
          .optional()
          .describe('For iterations: the human user\'s feedback on the previous proposal, verbatim. e.g. "make the hook shorter and more playful" or "emphasise the scent notes more".'),
      },
    },
    async ({
      brand_id,
      media_ids,
      platform,
      angle,
      previous_proposal,
      user_feedback,
    }: {
      brand_id: string
      media_ids: string[]
      platform: Platform
      angle?: string
      previous_proposal?: string
      user_feedback?: string
    }) => {
      const supabase = createAdminClient()

      // Verify brand ownership
      const { data: brand, error: brandError } = await supabase
        .from('brands')
        .select('id')
        .eq('id', brand_id)
        .eq('user_id', userId)
        .single()

      if (brandError || !brand) {
        return {
          content: [{ type: 'text' as const, text: 'Error: Brand not found or access denied.' }],
          isError: true,
        }
      }

      // Reuse the exact same tool the Director uses — single source of truth
      const proposeTool = createProposePostTool(supabase, userId, brand_id)

      try {
        // The AI SDK tool exposes its execute via a wrapper — we call it directly
        // with our validated input. We cast through unknown because the tool's
        // internal shape isn't exported.
        const result = await (proposeTool as unknown as {
          execute: (args: Record<string, unknown>) => Promise<string>
        }).execute({
          media_ids,
          platform,
          angle,
          previous_proposal,
          user_feedback,
        })

        return {
          content: [{ type: 'text' as const, text: result }],
        }
      } catch (err) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `Error running propose_post_from_media: ${err instanceof Error ? err.message : String(err)}`,
            },
          ],
          isError: true,
        }
      }
    },
  )
}

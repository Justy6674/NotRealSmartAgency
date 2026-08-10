/**
 * draft_post — synchronous MCP tool that creates a draft social post.
 *
 * The Director's Content & Copy specialist writes the caption — NEVER the
 * AI client. The AI client passes the user's intent verbatim and this tool
 * routes it through runAgentWorker('content', ...) so:
 *   - Content agent uses its own memory namespace (nrs-{slug}-content)
 *   - Content agent learns from the output (worker.ts memory extraction)
 *   - The caption is written by Director's specialist, not Claude/Grok/Gemini
 *
 * After the worker returns, this tool inserts the draft directly into
 * scheduled_posts with metadata.source='mcp_external' so it lands in the
 * Review pipeline alongside drafts from every other source.
 *
 * Synchronous because only one worker runs (no delegation chain) → ~10-15s,
 * well under the MCP client timeout.
 */

import { z } from 'zod/v3'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { createAdminClient } from '@/lib/supabase/admin'
import { runAgentWorker } from '@/lib/agents/worker'
import { runComplianceFilter } from '@/lib/agents/compliance-filter'
import type { Brand, DraftSourceMeta } from '@/types/database'
import {
  createDraftPost,
  describeMixpostOutcome,
  type CreateDraftResult,
} from '@/lib/posts/create-draft'
import { inspectMarketingInput } from '@/lib/security/marketing-data-boundary'
import { assertProjectCapability, type McpPrincipal } from '@/lib/security/project-access'
import { getActiveGoal, markGoalReadyForReview } from '@/lib/agents/goal-loop'

const PLATFORMS = ['instagram', 'facebook', 'linkedin', 'tiktok', 'youtube', 'twitter'] as const
type Platform = (typeof PLATFORMS)[number]
type DraftMediaAttachment = {
  id: string
  file_url: string
  file_type: string
  thumbnail_url: string | null
}

export function resolveMcpDraftMediaAttachment(
  mediaId: string | undefined,
  media: DraftMediaAttachment | null,
): { ok: true; media: DraftMediaAttachment | null } | { ok: false; error: string } {
  if (!mediaId) return { ok: true, media: null }
  if (!media) {
    return {
      ok: false,
      error: 'The requested media is not available in this project. Call query_media for an exact ID, or upload it with upload_media before drafting.',
    }
  }
  return { ok: true, media }
}

const PLATFORM_GUIDANCE: Record<Platform, string> = {
  instagram: 'Instagram caption — hook in first line, 3-5 short paragraphs, conversational, end with a question or CTA. 150 words max ideal. Hashtags will be added separately.',
  facebook: 'Facebook caption — slightly longer than Instagram, more narrative, ends with a question or community prompt. 200 words max.',
  linkedin: 'LinkedIn caption — professional but human, hook in first 3 lines (the cutoff before "see more"), short paragraphs, ends with insight or question. 250 words max.',
  tiktok: 'TikTok caption — very short (max 100 words), punchy, leans on the video to do the work, ends with a question or hook for replies.',
  youtube: 'YouTube description — first 2 lines are the hook (visible above the fold), then expand. Include the value prop early. 300 words max for Shorts, longer fine for long-form.',
  twitter: 'X/Twitter post — 280 character limit. One sharp idea. Optional thread hint at end.',
}

/**
 * Pull the caption out of a JSON envelope that would not parse.
 *
 * Truncation mid-object is the common cause: the text plainly starts as the
 * envelope but ends before its closing brace. Returning null means it was not
 * an envelope at all, and the caller should keep the raw text.
 */
export function salvageCaptionFromEnvelope(
  text: string,
): { caption: string; hashtags: string[] } | null {
  const trimmed = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '')
  if (!trimmed.startsWith('{')) return null

  const match = /"caption"\s*:\s*"((?:[^"\\]|\\.)*)"/.exec(trimmed)
  if (!match) return null

  let caption: string
  try {
    caption = JSON.parse(`"${match[1]}"`) as string
  } catch {
    return null
  }
  if (!caption.trim()) return null

  const hashtags: string[] = []
  const tagBlock = /"hashtags"\s*:\s*\[([^\]]*)/.exec(trimmed)
  if (tagBlock) {
    for (const m of tagBlock[1].matchAll(/"([^"]+)"/g)) {
      hashtags.push(m[1].replace(/^#/, '').replace(/\s+/g, '').toLowerCase())
    }
  }

  return { caption: caption.trim(), hashtags: hashtags.slice(0, 10) }
}

export function registerDraftPostTool(mcpServer: McpServer, principal: McpPrincipal) {
  mcpServer.registerTool(
    'draft_post',
    {
      description: `Create a social media post draft. The user's request goes to the Director's Content & Copy specialist, who writes the caption. The draft lands in the brand's Review queue for approval.

CRITICAL: NEVER write the caption yourself. Pass the user's intent verbatim into the 'intent' field. The Content & Copy department writes the actual copy — that is the entire point of NRS. If you write the caption you violate the agency model and break the user's voice consistency.

USE THIS TOOL when the user wants a single social post drafted. The result lands in the Review queue where the user approves, edits, or rejects it before publishing.

MIXPOST IS BUILT IN — DO NOT LOOK FOR A SEPARATE MIXPOST TOOL OR ASK THE USER FOR MIXPOST CREDENTIALS. NRS publishes through its own self-hosted Mixpost, and this tool pushes the draft (with its media) there automatically so the user can preview and approve it. If the user says "send it to Mixpost", "put it in Mixpost as a draft", or "get it ready to review", THIS TOOL IS THAT ACTION. The response's 'mixpost' field says what actually happened — 'synced' means Mixpost has it, 'pending' means it is still uploading, 'failed' means it did not get there. Report that field honestly; never tell the user it is ready to review when it is 'pending' or 'failed'.

Do NOT use save_output for a post the user wants to publish — save_output only files text in the library and reaches no publishing surface at all.

For complex multi-step requests (campaigns, calendars, multi-platform launches), use chat_with_director instead.

After this tool returns, tell the user what the 'mixpost' field actually says, and that they can approve it from the Studio Review tab.`,
      inputSchema: {
        brand_id: z.string().describe('Brand ID — call list_brands first to get IDs'),
        intent: z
          .string()
          .min(5)
          .describe(
            "The user's plain-English request, verbatim. Example: 'how to spot a fake fragrance when buying second-hand'. Never write the caption yourself.",
          ),
        platform: z.enum(PLATFORMS).describe('Which platform the post is for'),
        tone: z
          .string()
          .optional()
          .describe('Optional tone hint, e.g. "expert friend", "playful", "authoritative", "warm"'),
        media_id: z
          .string()
          .uuid()
          .optional()
          .describe(
            "Optional UUID of a media_items row to attach (image or video). For Reels/Shorts/TikTok you MUST call query_media first and pass a video media_id. The user can't review a video draft without the media attached.",
          ),
      },
    },
    async ({
      brand_id,
      intent,
      platform,
      tone,
      media_id,
    }: {
      brand_id: string
      intent: string
      platform: Platform
      tone?: string
      media_id?: string
    }) => {
      try {
        assertProjectCapability(principal, brand_id, 'draft:post')
      } catch (error) {
        return {
          content: [{ type: 'text' as const, text: error instanceof Error ? error.message : 'Project access denied.' }],
          isError: true,
        }
      }

      const inspection = inspectMarketingInput(intent)
      if (!inspection.allowed) {
        return {
          content: [{ type: 'text' as const, text: inspection.reason }],
          isError: true,
        }
      }

      const supabase = createAdminClient()

      // Project scope is checked above; this only verifies that the project
      // still exists and loads the active workspace for the worker.
      const { data: brand, error: brandError } = await supabase
        .from('brands')
        .select('*')
        .eq('id', brand_id)
        .single()

      if (brandError || !brand) {
        return {
          content: [{ type: 'text' as const, text: 'Error: Brand not found or you do not have access.' }],
          isError: true,
        }
      }

      const typedBrand = brand as Brand
      const activeGoal = await getActiveGoal(supabase, principal.userId, brand_id)
      if (!activeGoal) {
        return {
          content: [{
            type: 'text' as const,
            text: 'Set the end-user outcome with chat_with_director before drafting ongoing marketing work for this project.',
          }],
          isError: true,
        }
      }
      const platformGuide = PLATFORM_GUIDANCE[platform]

      // Build a structured brief for Content & Copy. Worker will call
      // buildSystemPromptWithMemory which already injects the brand voice,
      // memories, and Content agent personality.
      //
      // Output format is a strict JSON envelope with caption + hashtags
      // so the Director (or this tool) can apply hashtags via the
      // `hashtags` field of scheduled_posts rather than jamming them
      // inline. Facebook Reels perform better with 5-8 relevant tags.
      const brief = [
        `Write ONE ${platform} post for ${typedBrand.name}.`,
        '',
        `User intent (verbatim from the founder): "${intent}"`,
        '',
        `Platform format: ${platformGuide}`,
        tone ? `Tone: ${tone}` : '',
        '',
        'Output requirements:',
        '- Return ONLY a JSON object with this exact shape, no preamble:',
        '  {"caption":"<the post body>","hashtags":["tag1","tag2",...]}',
        "- caption: the body copy (no inline hashtags, no preamble, no \"Here is your caption:\"). Write in Australian English. Match the brand voice from your memories.",
        '- hashtags: 5-8 relevant lowercase hashtags WITHOUT the # prefix. Mix broad (brand/category) and narrow (product/topic specific). No spaces.',
        '- Do not call any tools. Just return the JSON and stop.',
        '- If the intent involves specific products you do not know about, write based on the topic without inventing product details.',
      ]
        .filter(Boolean)
        .join('\n')

      // Run Content & Copy worker — single step, no tool calls expected
      const workerResult = await runAgentWorker(
        'content',
        brief,
        {
          supabase,
          userId: principal.userId,
          brandId: brand_id,
          brand: typedBrand,
          conversationId: null,
        },
        {
          maxSteps: 1, // text only, no tool round-trips
          timeoutMs: 60000, // hard cap so we never blow MCP client timeout
        },
      )

      if (workerResult.error || !workerResult.result.trim()) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `Content & Copy failed to write the draft: ${workerResult.error ?? 'empty response'}`,
            },
          ],
          isError: true,
        }
      }

      // Parse the JSON envelope from Content & Copy. Falls back to treating
      // the whole output as a caption if the agent forgets the format.
      let caption = workerResult.result.trim()
      let parsedHashtags: string[] = []
      try {
        // Strip any markdown code fence if present
        const cleaned = caption
          .replace(/^```(?:json)?\s*/i, '')
          .replace(/\s*```$/i, '')
          .trim()
        const parsed = JSON.parse(cleaned) as { caption?: string; hashtags?: unknown }
        if (parsed && typeof parsed.caption === 'string') {
          caption = parsed.caption.trim()
        }
        if (Array.isArray(parsed.hashtags)) {
          parsedHashtags = parsed.hashtags
            .filter((h): h is string => typeof h === 'string' && h.length > 0)
            .map((h) => h.replace(/^#/, '').replace(/\s+/g, '').toLowerCase())
            .slice(0, 10)
        }
      } catch {
        // Not parseable as JSON. It may still BE an envelope — a response cut
        // short mid-object parses as nothing, and the fallback then wrote the
        // raw `{"caption":"…` into the post. A draft that reads as code is
        // one the owner has to notice before approving, and one he might not.
        const salvaged = salvageCaptionFromEnvelope(caption)
        if (salvaged) {
          caption = salvaged.caption
          parsedHashtags = salvaged.hashtags
        }
        // Otherwise Content & Copy ignored the envelope entirely and the raw
        // text is the caption, which is the intended fallback.
      }

      // AHPRA/TGA compliance gate for health brands (mirrors publish_to_social)
      const complianceFlags = typedBrand.compliance_flags ?? {}
      if (complianceFlags.ahpra || complianceFlags.tga) {
        try {
          const check = await runComplianceFilter(caption, complianceFlags, undefined)
          if (!check.isValid) {
            const issues = [
              ...check.flags.map((f: string) => `BLOCKED: ${f}`),
              ...check.brandVoiceIssues.map((v: string) => `BRAND VOICE: ${v}`),
            ].join('\n')
            return {
              content: [
                {
                  type: 'text' as const,
                  text: `COMPLIANCE CHECK FAILED — draft NOT saved.\n\n${issues}\n\nThe Content & Copy agent's draft did not pass the AHPRA/TGA compliance gate. Refine the intent and try again.`,
                },
              ],
              isError: true,
            }
          }
          // Same unreachable-catch problem as publish_to_social: the filter
          // swallows its own failures, so a skipped review only shows here.
          if (!check.checkCompleted) {
            return {
              content: [
                {
                  type: 'text' as const,
                  text: 'COMPLIANCE CHECK DID NOT RUN — draft NOT saved. This project is regulated and its content is unverified. Try again shortly.',
                },
              ],
              isError: true,
            }
          }
        } catch (err) {
          if (complianceFlags.ahpra || complianceFlags.tga) {
            return {
              content: [
                {
                  type: 'text' as const,
                  text: `COMPLIANCE CHECK ERROR — draft NOT saved. ${err instanceof Error ? err.message : String(err)}`,
                },
              ],
              isError: true,
            }
          }
        }
      }

      // Resolve optional media attachment
      let mediaItemRow: DraftMediaAttachment | null = null
      if (media_id) {
        const { data: mediaRow } = await supabase
          .from('media_items')
          .select('id, file_url, file_type, thumbnail_url')
          .eq('id', media_id)
          .eq('brand_id', brand_id)
          .single()
        const attachment = resolveMcpDraftMediaAttachment(media_id, mediaRow)
        if (!attachment.ok) {
          return {
            content: [{ type: 'text' as const, text: attachment.error }],
            isError: true,
          }
        }
        mediaItemRow = attachment.media
      }

      // Insert the draft into scheduled_posts with mcp_external source.
      // createDraftPost also pushes it to Mixpost — without that the draft is
      // invisible on the surface the user actually reviews from.
      const metadata: DraftSourceMeta = {
        source: 'mcp_external',
        created_by: 'Content & Copy (via MCP)',
        intent,
        department: 'content',
      }

      let draft: CreateDraftResult
      try {
        draft = await createDraftPost({
          supabase,
          userId: principal.userId,
          brandId: brand_id,
          platform,
          caption,
          hashtags: parsedHashtags,
          mediaItemIds: mediaItemRow ? [mediaItemRow.id] : [],
          // `intent` is the user's request verbatim — the tool contract above
          // demands it. That makes it the honest owner turn for the stale-media
          // guard: "draft a post with this image" attaches the newest upload
          // rather than whichever media_id the calling model remembered.
          ownerMessage: intent,
          metadata: metadata as unknown as Record<string, unknown>,
        })
      } catch (err) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `Caption was written but failed to save as draft: ${err instanceof Error ? err.message : String(err)}\n\nCaption (so it isn't lost):\n${caption}`,
            },
          ],
          isError: true,
        }
      }

      const postType = draft.postType

      await markGoalReadyForReview(supabase, principal.userId, activeGoal.id)

      const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.notrealsmart.com.au'
      const reviewUrl = `${baseUrl}/agency/studio?tab=review`

      const response = {
        draft_id: draft.id,
        platform,
        source: 'mcp_external',
        department: 'Content & Copy',
        post_type: postType,
        // The ids the draft ACTUALLY carries, which is not always the media_id
        // that was passed in — see the stale-media guard in createDraftPost.
        media_item_ids_used: draft.mediaItemIds,
        ...(mediaItemRow ? { media_attached: { id: mediaItemRow.id, type: mediaItemRow.file_type } } : {}),
        cost_cents: workerResult.costCents,
        duration_ms: workerResult.durationMs,
        caption_preview: caption.length > 200 ? caption.slice(0, 200) + '…' : caption,
        hashtags: parsedHashtags,
        hashtag_count: parsedHashtags.length,
        review_url: reviewUrl,
        // Say what actually happened. A draft that never reached Mixpost is not
        // "ready to review" — reporting it as such is the bug this replaced.
        mixpost: draft.mixpost,
        ...(draft.mixpostPostUuid ? { mixpost_post_uuid: draft.mixpostPostUuid } : {}),
        ...(draft.mixpostError ? { mixpost_error: draft.mixpostError } : {}),
        next_step: `Tell the user: ${describeMixpostOutcome(draft)} They can approve, edit, or reject it from the Studio Review tab.`,
      }

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(response, null, 2),
          },
          {
            type: 'text' as const,
            text: `\n\nFull caption written by Content & Copy:\n\n${caption}`,
          },
        ],
      }
    },
  )
}

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { createAdminClient } from '@/lib/supabase/admin'
import { getToolsForAgent } from '@/lib/agents/tools'
import { adaptToolsForMCP } from './tool-adapter'
import { registerDirectorChatTool } from './director-chat'
import { registerGetDirectorResponseTool } from './director-job-tool'
import { registerDraftPostTool } from './draft-post-tool'

/**
 * Tools that must NOT be exposed as direct MCP tools to plug-in AIs.
 *
 * NRS Director owns all orchestration, multi-step reasoning, and marketing
 * content writing. External AI clients (Claude Desktop, Cowork, Claude Code)
 * should call `chat_with_director` for anything on this list — the Director
 * then decides which department to delegate to and calls these tools via its
 * internal AI SDK tool loop. That way:
 *
 *   1. All content is Director-written (enforces brand voice + compliance)
 *   2. Multi-step flows stay consistent (Director remembers the full context)
 *   3. Plug-in AIs can't silently skip the Review/approval steps
 *   4. Learning + memory happens in one place (the Director's chat history)
 *
 * Read/query tools and bounded single-shot actions remain exposed — those
 * don't need orchestration and are safe for direct external AI access.
 */
const HIDDEN_FROM_MCP: ReadonlySet<string> = new Set([
  // Media orchestration (transcription + captions + drafting — multi-step)
  'process_media',

  // Content writing (Director must author, per the "Director is the only face" rule)
  'write_blog',
  'write_ads',
  'write_email_campaign',
  'repurpose_content',

  // Multi-step analysis / planning (needs Director reasoning)
  'marketing_audit',
  'deep_competitor_scan',
  'fill_calendar',
  'analyse_voice',
  'analyse_content_gaps',

  // Media generation (expensive, multi-step, delegated work)
  'create_video',
  'multi_scene_video',
  'generate_video_agent',
  'translate_video',
  'photo_avatar',
  'text_to_speech',
  'generate_slides',

  // Director-internal orchestration primitives (never called from outside)
  'delegate_to_agent',
  'convene_meeting',
])

/**
 * Register ALL tools upfront. Tool list must never change after launch —
 * MCP clients cache the list and won't re-fetch without a reconnect.
 * Tools that aren't ready yet should return "coming soon" rather than
 * being omitted from the list.
 */

/**
 * Create a fully configured MCP server for a given user.
 * Stateless — created fresh per request.
 */
export function createNRSMcpServer(userId: string): McpServer {
  const server = new McpServer({
    name: 'notrealsmart',
    version: '1.0.0',
    description: 'NotRealSmart AI Marketing Agency — 1 Director + 13 department agents running marketing for your brands.',
    icons: [
      {
        src: 'https://www.notrealsmart.com.au/favicon-64.png',
        mimeType: 'image/png',
        sizes: ['64x64'],
      },
      {
        src: 'https://www.notrealsmart.com.au/Favicon.png',
        mimeType: 'image/png',
      },
    ],
  })

  // Register brands://list resource
  server.registerResource('brands_list', 'brands://list', {
    description: 'List all your brands. Returns brand ID, name, slug, and description.',
  }, async () => {
    const supabase = createAdminClient()
    const { data: brands, error } = await supabase
      .from('brands')
      .select('id, name, slug, description, niche, website_url')
      .eq('user_id', userId)
      .order('name')

    if (error || !brands) {
      return {
        contents: [{
          uri: 'brands://list',
          mimeType: 'application/json',
          text: JSON.stringify({ error: 'Failed to load brands' }),
        }],
      }
    }

    return {
      contents: [{
        uri: 'brands://list',
        mimeType: 'application/json',
        text: JSON.stringify(brands, null, 2),
      }],
    }
  })

  // Register list_brands as a TOOL (not just a resource) — Claude clients
  // reliably call tools but don't always read resources
  server.registerTool('list_brands', {
    description: 'List all your brands. CALL THIS FIRST before using any other NotRealSmart tool — every tool requires a brand_id. Returns brand ID, name, slug, description, and website URL for each brand.',
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  }, async (_args: any) => {
    const supabase = createAdminClient()
    const { data: brands, error } = await supabase
      .from('brands')
      .select('id, name, slug, description, niche, website_url')
      .eq('user_id', userId)
      .order('name')

    if (error || !brands) {
      return {
        content: [{ type: 'text' as const, text: 'Error: Failed to load brands.' }],
        isError: true,
      }
    }

    const formatted = brands.map(b =>
      `- **${b.name}** (${b.slug})\n  ID: ${b.id}\n  ${b.description || 'No description'}\n  ${b.website_url || ''}`
    ).join('\n\n')

    return {
      content: [{ type: 'text' as const, text: `Your brands:\n\n${formatted}` }],
    }
  })

  // Register chat_with_director — async pattern, returns job_id immediately
  registerDirectorChatTool(server, userId)
  // Register get_director_response — poll for the async job result
  registerGetDirectorResponseTool(server, userId)
  // Register draft_post — Content & Copy writes a single draft, lands in Review
  registerDraftPostTool(server, userId)

  // Register ALL tools from the Director's tool set
  // Tool factory rebuilds tools with the correct brandId per MCP call
  const toolFactory = (brandId: string) => {
    const supabase = createAdminClient()
    return getToolsForAgent('overall', {
      supabase,
      userId,
      brandId,
      conversationId: null,
      agentRegistryId: null,
    })
  }

  // Get tool definitions (shape/description) from a dummy context — the actual
  // execution uses freshly-built tools with the correct brandId per call.
  // HIDDEN_FROM_MCP (see top of file) filters out orchestration + content-writing
  // tools so plug-in AIs must go through chat_with_director for those.
  const templateTools = toolFactory('00000000-0000-0000-0000-000000000000')
  adaptToolsForMCP(templateTools, server, userId, toolFactory, HIDDEN_FROM_MCP)

  // Register quick_start prompt
  server.registerPrompt('quick_start', {
    description: 'Get started with your NRS Agency',
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  }, async (_extra: any) => {
    return {
      messages: [{
        role: 'assistant' as const,
        content: {
          type: 'text' as const,
          text: `Welcome to NotRealSmart Agency — your AI marketing team.

CRITICAL RULE: You are the messenger, not the marketer. The NRS Director (and its 13 specialist departments) writes, plans, and orchestrates everything. NEVER write captions, blog copy, ad copy, video scripts, email campaigns, or any marketing content yourself. NEVER try to orchestrate multi-step work (transcription + caption + drafting) yourself. Pass the user's request verbatim to the Director via chat_with_director.

Tool policy:

1. **ANY multi-step or content-writing request → chat_with_director**
   This includes: "turn this video into posts", "run an audit", "plan a campaign", "write a blog", "analyse my voice", "translate this video", "create a video", "process my media", "build me a week of content".
   chat_with_director is ASYNC — you'll get a job_id back. Then call
   get_director_response(job_id) every 10 seconds until it's done.

2. **Single quick draft** → draft_post
   Use for one-off social posts. Content & Copy writes the caption.
   Lands in the Review queue. Returns in ~10-15s. Pass intent verbatim.

3. **Publish a Director-written post** → publish_to_social
   Only when the user explicitly says "publish now" AND the content has
   already been written by the Director or Content & Copy. Never write
   your own caption into publish_to_social — that bypasses brand voice
   and compliance checks.

4. **Check status** — these are safe direct calls:
   - query_media (uploaded assets)
   - query_calendar (upcoming + published posts)
   - query_outputs (past agency work)
   - query_analytics (performance numbers)
   - query_social_analytics (platform-level metrics)

5. **Simple utilities** — also safe direct calls:
   - scan_website, browse_page, generate_image, save_output

Tools that used to be callable directly but are now Director-only (call
chat_with_director for these): process_media, write_blog, write_ads,
write_email_campaign, marketing_audit, deep_competitor_scan, fill_calendar,
create_video, multi_scene_video, analyse_voice, analyse_content_gaps,
translate_video, photo_avatar, text_to_speech, generate_slides,
repurpose_content.

ALWAYS start by calling list_brands to get brand IDs.

Example — user says "turn this uploaded video into posts":
  WRONG:  call process_media directly
  RIGHT:  chat_with_director({ brand_id, message: "Turn media_item_id
          4c342177-... into a week of social posts across Instagram,
          LinkedIn, and TikTok." })
          → returns { job_id }
          → poll get_director_response(job_id) until done
          The Director delegates to Video & Scripting and Content & Copy,
          and returns the drafts in the Review queue.

Example — user says "make me an Instagram post about spotting fake fragrances":
  draft_post({ brand_id, intent: "spotting fake fragrances when buying second-hand", platform: "instagram" })
  Result: { draft_id, caption_preview, review_url }
  Tell user: "Done — Content & Copy wrote you a draft. It's in your Review queue at [review_url]."`,
        },
      }],
    }
  })

  return server
}

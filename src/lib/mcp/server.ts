import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { createAdminClient } from '@/lib/supabase/admin'
import { getToolsForAgent } from '@/lib/agents/tools'
import { adaptToolsForMCP } from './tool-adapter'
import { registerDirectorChatTool } from './director-chat'
import { registerGetDirectorResponseTool } from './director-job-tool'
import { registerDraftPostTool } from './draft-post-tool'

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
        src: 'https://www.notrealsmart.com.au/nrs-mcp-icon.png',
        mimeType: 'image/png',
        sizes: ['512x512'],
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
  // The MCP adapter uses a default-deny allowlist. Anything not explicitly
  // reviewed as a safe, direct utility stays inside the Director flow.
  const templateTools = toolFactory('00000000-0000-0000-0000-000000000000')
  adaptToolsForMCP(templateTools, server, userId, toolFactory)

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

3. **Publish, schedule, manage a Review post, or send email** → chat_with_director
   Give the Director the user's intent and the draft/media to use. The
   Director shows the final content, waits for current-conversation approval,
   then publishes, schedules, or sends it. You cannot call publishing,
   review-management, or outbound-email tools directly.

4. **Check status** — these are safe direct calls:
   - query_media (uploaded assets)
   - query_calendar (upcoming + published posts)
   - query_outputs (past agency work)
   - query_analytics (performance numbers)
   - query_social_analytics (platform-level metrics)

5. **Simple utilities** — also safe direct calls:
   - scan_website, browse_page, generate_image, save_output

Tools that are Director-only (call chat_with_director for these):
publish_to_social, blotato_publish, manage_posts, send_email, process_media,
write_blog, write_ads,
write_email_campaign, marketing_audit, deep_competitor_scan, fill_calendar,
create_video, create_multi_scene_video, analyse_voice, analyse_content_gaps,
translate_video, generate_photo_avatar, text_to_speech, generate_slides,
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

Example — user says "publish the approved fake-fragrance post to Instagram":
chat_with_director({ brand_id, message: "Publish the approved fake-fragrance post to Instagram." })
The Director confirms the final caption, media, and timing with the user before publishing.`,
        },
      }],
    }
  })

  return server
}

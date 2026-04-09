import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { createAdminClient } from '@/lib/supabase/admin'
import { getToolsForAgent } from '@/lib/agents/tools'
import { adaptToolsForMCP } from './tool-adapter'
import { registerDirectorChatTool } from './director-chat'
import { registerGetDirectorResponseTool } from './director-job-tool'
import { registerDraftPostTool } from './draft-post-tool'
import { registerProposePostTool } from './propose-post-tool'

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
  // Register propose_post_from_media — creation session iteration tool
  registerProposePostTool(server, userId)

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
  // execution uses freshly-built tools with the correct brandId per call
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

CRITICAL RULE: You are the messenger, not the marketer. The Director (and its 13 specialist departments) writes all marketing content. NEVER write captions, blog copy, ad copy, or any marketing content yourself — pass the user's request verbatim to the Director or to draft_post.

Here's what you can do:

1. **Single social post draft** (most common): Use draft_post with the user's intent. The Content & Copy department writes the caption. It lands in the Review queue. Returns in ~10-15s.

2. **Complex marketing requests**: Use chat_with_director — this is async. You'll get a job_id back; then call get_director_response(job_id) every 10 seconds until it's done. Use this for campaigns, audits, multi-step work, or anything that needs delegation.

3. **Publish directly**: Use publish_to_social to post immediately to connected platforms. Only use this if the user explicitly says "publish now" — otherwise prefer draft_post so they can review first.

4. **Long-form content**: write_blog, write_ads, write_email_campaign generate content. Same rule: pass intent verbatim, never pre-write.

5. **Check status**: query_calendar (upcoming posts), query_outputs (past work), query_media (uploaded assets).

ALWAYS start by calling list_brands to get brand IDs.

Example flow:
User says "make me an Instagram post about spotting fake fragrances"
You call: draft_post({ brand_id: "...", intent: "spotting fake fragrances when buying second-hand", platform: "instagram" })
Result: { draft_id, caption_preview, review_url }
You tell user: "Done — Content & Copy wrote you a draft. It's in your Review queue at [review_url]."`,
        },
      }],
    }
  })

  return server
}

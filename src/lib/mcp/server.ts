import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { createAdminClient } from '@/lib/supabase/admin'
import { getToolsForAgent } from '@/lib/agents/tools'
import { adaptToolsForMCP } from './tool-adapter'
import { registerDirectorChatTool } from './director-chat'

/**
 * MVP tools to expose via MCP.
 * Adding more later = adding names to this set.
 */
const MVP_TOOLS = new Set([
  'publish_to_social',
  'write_blog',
  'write_ads',
  'write_email_campaign',
  'manage_posts',
  'query_calendar',
  'query_outputs',
  'save_output',
  'generate_image',
  'scan_website',
  'query_analytics',
])

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

  // Register chat_with_director — the flagship tool
  registerDirectorChatTool(server, userId)

  // Register MVP tools from the existing AI SDK tool set
  const supabase = createAdminClient()
  const dummyCtx = {
    supabase,
    userId,
    brandId: '00000000-0000-0000-0000-000000000000', // placeholder — real brandId comes from tool params
    conversationId: null,
    agentRegistryId: null,
  }
  const allTools = getToolsForAgent('overall', dummyCtx)

  // Filter to MVP set and adapt
  const mvpTools: Record<string, unknown> = {}
  for (const [name, tool] of Object.entries(allTools)) {
    if (MVP_TOOLS.has(name)) {
      mvpTools[name] = tool
    }
  }
  adaptToolsForMCP(mvpTools, server, userId)

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

Here's what you can do:

1. **Talk to the Director**: Use the chat_with_director tool with any marketing request. The Director manages 13 departments and will delegate automatically.

2. **Publish to social**: Use publish_to_social to post directly to your connected platforms (Facebook, Instagram, LinkedIn, YouTube, TikTok).

3. **Create content**: write_blog, write_ads, write_email_campaign — all generate platform-optimised content.

4. **Check your calendar**: query_calendar shows upcoming scheduled posts.

5. **See past work**: query_outputs searches everything your agents have created.

Start by reading the brands://list resource to see your brands, then use chat_with_director with a brand_id and your request.

Example: "Write a blog post about AI in healthcare for [brand] and publish it to LinkedIn"`,
        },
      }],
    }
  })

  return server
}

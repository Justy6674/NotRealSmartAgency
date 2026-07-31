import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { createAdminClient } from '@/lib/supabase/admin'
import { getToolsForAgent } from '@/lib/agents/tools'
import { adaptToolsForMCP } from './tool-adapter'
import { registerDirectorChatTool } from './director-chat'
import { registerGetDirectorResponseTool } from './director-job-tool'
import { registerDraftPostTool } from './draft-post-tool'
import { listGrantedProjectIds, type McpPrincipal } from '@/lib/security/project-access'
import { buildMacroBoard, type BoardAccountInput } from '@/lib/macro/board'
import { fetchMixpostAccounts } from '@/lib/mixpost/client'
import { mapMixpostAccountsToBrands } from '@/lib/mixpost/brand-mapping'
import { describeProjectState, loadProjectBrief } from '@/lib/projects/load-brief'
import { z } from 'zod/v3'

/**
 * Register ALL tools upfront. Tool list must never change after launch —
 * MCP clients cache the list and won't re-fetch without a reconnect.
 * Tools that aren't ready yet should return "coming soon" rather than
 * being omitted from the list.
 */

/**
 * Create a fully configured MCP server for one authenticated, project-scoped
 * connection. A user identity alone is never enough to enumerate workspaces.
 * Stateless — created fresh per request.
 */
export function createNRSMcpServer(principal: McpPrincipal): McpServer {
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

  const grantedProjectIds = listGrantedProjectIds(principal)

  async function loadGrantedProjects() {
    if (grantedProjectIds.length === 0) return []

    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from('brands')
      .select('id, name, slug, description, niche, website_url')
      .in('id', grantedProjectIds)
      .order('name')

    if (error) throw new Error('Failed to load granted projects.')
    return data ?? []
  }

  /**
   * A one-line state per project for the list. Built from the same board the
   * owner sees, so the two never disagree about how a project is doing.
   */
  async function loadProjectStates(
    projects: Array<{ id: string; name: string; slug: string }>,
  ): Promise<Map<string, string>> {
    const states = new Map<string, string>()
    if (projects.length === 0) return states

    const supabase = createAdminClient()
    const since = new Date()
    since.setDate(since.getDate() - 30)

    const [postsResult, mixpostAccounts] = await Promise.all([
      supabase
        .from('scheduled_posts')
        .select('id, brand_id, status, scheduled_at, published_at, metadata')
        .in('brand_id', projects.map((p) => p.id))
        .gte('created_at', since.toISOString())
        .limit(1000),
      fetchMixpostAccounts(),
    ])

    let accounts: BoardAccountInput[] | null = null
    if (mixpostAccounts) {
      const mapped = mapMixpostAccountsToBrands(mixpostAccounts, projects)
      accounts = Object.entries(mapped).flatMap(([brandId, list]) =>
        list.map((a) => ({ brandId, accountName: a.accountName, authorized: a.authorized })),
      )
    }

    const board = buildMacroBoard({
      projects,
      posts: postsResult.data ?? [],
      accounts,
      approvals: [],
      now: new Date(),
    })

    for (const row of board.projects) states.set(row.id, describeProjectState(row))
    return states
  }

  // Register the compatible resource name. Its contents are strictly scoped.
  server.registerResource('brands_list', 'brands://list', {
    description: 'List only the project workspaces granted to this connection.',
  }, async () => {
    try {
      const projects = await loadGrantedProjects()
      return {
        contents: [{
          uri: 'brands://list',
          mimeType: 'application/json',
          text: JSON.stringify(projects, null, 2),
        }],
      }
    } catch {
      return {
        contents: [{
          uri: 'brands://list',
          mimeType: 'application/json',
          text: JSON.stringify({ error: 'Failed to load brands' }),
        }],
      }
    }
  })

  const registerProjectListTool = (name: 'list_projects' | 'list_brands', compatibility = false) => {
    server.registerTool(name, {
      description: compatibility
        ? 'Compatibility alias for list_projects. Returns only project workspaces granted to this connection.'
        : 'List only the project workspaces granted to this connection. Call this before selecting a project for another tool.',
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    }, async (_args: any) => {
      try {
        const projects = await loadGrantedProjects()
        // The list said what each project was called and nothing about how it
        // was doing, so a client had to call three more tools per project
        // before it knew where to start — and usually did not bother.
        const states = await loadProjectStates(projects)
        const formatted = projects.map((project) => {
          const state = states.get(project.id)
          return `- **${project.name}** (${project.slug})\n  ID: ${project.id}\n  ${project.description || 'No description'}\n  ${project.website_url || ''}${state ? `\n  Status: ${state}` : ''}`
        }).join('\n\n')
        return {
          content: [{
            type: 'text' as const,
            text: `Your permitted projects:\n\n${formatted || 'No project workspaces are granted to this connection.'}\n\nCall project_brief with a project ID for its brand rules, what is at risk, what is out of date, and what to do next.`,
          }],
        }
      } catch {
        return {
          content: [{ type: 'text' as const, text: 'Error: Failed to load granted projects.' }],
          isError: true,
        }
      }
    })
  }

  registerProjectListTool('list_projects')
  registerProjectListTool('list_brands', true)

  // One call for everything needed to work on a project. A client previously
  // had to know which of ninety tools to call, in what order, to learn the
  // brand rules — so it guessed, and guessed work came back off-brand.
  server.registerTool('project_brief', {
    description:
      'Everything you need before doing any work on a project: its exact brand colours, logo, voice and banned words; whether advertising rules apply; what is at risk right now; what is out of date; and three suggested next actions. Call this first, before writing anything for a project.',
    inputSchema: { project_id: z.string().describe('The project ID from list_projects.') },
  }, async ({ project_id }: { project_id: string }) => {
    if (!grantedProjectIds.includes(project_id)) {
      return {
        content: [{ type: 'text' as const, text: 'That project is not available on this connection. Call list_projects for the ones that are.' }],
        isError: true,
      }
    }
    try {
      const result = await loadProjectBrief(createAdminClient(), project_id, principal.userId)
      if (!result) {
        return {
          content: [{ type: 'text' as const, text: 'That project could not be found.' }],
          isError: true,
        }
      }
      return { content: [{ type: 'text' as const, text: result.text }] }
    } catch {
      return {
        content: [{ type: 'text' as const, text: 'The brief could not be built just now. Try again shortly.' }],
        isError: true,
      }
    }
  })

  // Register chat_with_director — async pattern, returns job_id immediately
  registerDirectorChatTool(server, principal)
  // Register get_director_response — poll for the async job result
  registerGetDirectorResponseTool(server, principal)
  // Register draft_post — Content & Copy writes a single draft, lands in Review
  registerDraftPostTool(server, principal)

  // Register ALL tools from the Director's tool set
  // Tool factory rebuilds tools with the correct project ID per MCP call.
  const toolFactory = (brandId: string) => {
    const supabase = createAdminClient()
    return getToolsForAgent('overall', {
      supabase,
      userId: principal.userId,
      brandId,
      conversationId: null,
      agentRegistryId: null,
    })
  }

  // Get tool definitions (shape/description) from a dummy context — the actual
  // execution uses freshly-built tools with the correct project ID per call.
  const templateTools = toolFactory('00000000-0000-0000-0000-000000000000')
  adaptToolsForMCP(templateTools, server, principal, toolFactory)

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

Project safety:

1. Call **list_projects** first. It returns only project workspaces granted to this connection.
2. Every tool needs an explicit project ID. Never infer a project from the message text or a previous request.
3. The Director receives only the selected project's marketing context. It cannot use another project's data unless NRS has an explicit approved project link.

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
   NOTE: save_output only files text in the output library. It reaches NO
   publishing surface. Never use it for something the user wants published.

MIXPOST IS BUILT IN. There is no separate Mixpost tool and you must never ask
the user for Mixpost credentials, an API key, or a URL — NRS runs its own
self-hosted Mixpost and pushes drafts there automatically. "Send it to
Mixpost" / "make it a Mixpost draft" / "get it ready to review" all mean:
draft_post (single post) or chat_with_director (anything larger). Both report
a 'mixpost' status of synced / pending / failed — relay it as-is rather than
claiming the post is ready to review.

Tools that are Director-only (call chat_with_director for these):
publish_to_social, blotato_publish, manage_posts, send_email, process_media,
write_blog, write_ads,
write_email_campaign, marketing_audit, deep_competitor_scan, fill_calendar,
analyse_voice, analyse_content_gaps, generate_slides, repurpose_content.

Example — user says "turn this uploaded video into posts":
  RIGHT:  list_projects()
          → chat_with_director({ brand_id, message: "Turn media_item_id
          4c342177-... into a week of social posts across Instagram,
          LinkedIn, and TikTok." })
          → returns { job_id }
          → poll get_director_response(job_id) until done
          The Director delegates to Video & Scripting and Content & Copy,
          and returns the drafts in the Review queue.`,
        },
      }],
    }
  })

  return server
}

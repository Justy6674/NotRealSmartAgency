/**
 * chat_with_director — async MCP tool.
 *
 * The MCP transport has a ~60s client-side timeout. The Director with full
 * delegation chains routinely takes 90s+. So this tool returns a job_id
 * IMMEDIATELY (in <1s) and runs the full Director in the background via
 * Next.js after(). Clients then poll get_director_response(job_id).
 *
 * The actual Director logic lives in director-job.ts — and it is the FULL
 * Director, not a stripped-down version. Routing, queue injection, proforma,
 * memory, delegation, meetings, web_search — all there.
 */

import { z } from 'zod/v3'
import { after } from 'next/server'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { createAdminClient } from '@/lib/supabase/admin'
import { runDirectorJob } from './director-job'
import { inspectMarketingInput } from '@/lib/security/marketing-data-boundary'
import { type McpPrincipal } from '@/lib/security/project-access'
import { createMcpDirectorExecution } from '@/lib/agents/director-execution'

export function registerDirectorChatTool(mcpServer: McpServer, principal: McpPrincipal) {
  mcpServer.registerTool(
    'chat_with_director',
    {
      description: `Send a message to the NRS Director — the central orchestrator of a 14-agent AI marketing agency. The Director delegates to 13 specialist departments automatically: Content & Copy, SEO & GEO, Paid Ads, Strategy & Launch, Email Marketing, Growth & Partnerships, Brand, Market Intelligence, Web & CRO, Compliance (AHPRA/TGA), Analytics & Reporting, Automation & AI, Video & Scripting.

USE THIS TOOL for complex or multi-step marketing requests. The Director can chain tools, delegate to departments, and run multi-agent meetings.

ASYNC PATTERN — IMPORTANT:
This tool returns a job_id immediately (in <1s). The Director runs in the background. After receiving the job_id, you MUST call get_director_response(job_id) to poll for the result. Polling cadence: wait 10 seconds between calls. Most jobs complete in 15-90 seconds depending on whether the Director delegates.

ALWAYS call list_brands first to get brand IDs before using this tool.

CONVERSATION CONTINUITY:
The Director remembers the recent thread for this brand, so follow-ups work naturally ("now draft those as posts", "make the TikTok one shorter"). Every response includes a conversation_id — pass it back on the next call to stay pinned to that exact thread. Omit it and the Director continues the most recent thread for the brand.

NEVER write the user's marketing copy yourself. Pass their request verbatim to the Director — the Director and its specialist departments write the content. You are the messenger, not the marketer.

Example messages:
- "Write a blog post about telehealth benefits and publish it to LinkedIn"
- "Run a full marketing audit"
- "Create a 2-week content calendar"
- "What's in my review queue and what should I do with it?"
- "Analyse my competitors"`,
      inputSchema: {
        brand_id: z.string().describe('Brand ID — call list_brands first to get IDs'),
        message: z
          .string()
          .describe(
            'The user\'s plain-language request. Pass it verbatim — never pre-write captions, ad copy, or marketing content yourself.',
          ),
        conversation_id: z
          .string()
          .optional()
          .describe(
            'Thread to continue. Pass the conversation_id from a previous response to keep the Director on that exact thread. Omit to continue the most recent thread for this brand.',
          ),
      },
    },
    async ({
      brand_id,
      message,
      conversation_id,
    }: {
      brand_id: string
      message: string
      conversation_id?: string
    }) => {
      let execution
      try {
        execution = createMcpDirectorExecution(principal, brand_id)
      } catch (error) {
        return {
          content: [{ type: 'text' as const, text: error instanceof Error ? error.message : 'Project access denied.' }],
          isError: true,
        }
      }

      const inspection = inspectMarketingInput(message)
      if (!inspection.allowed) {
        return {
          content: [{ type: 'text' as const, text: inspection.reason }],
          isError: true,
        }
      }

      const supabase = createAdminClient()

      // The scoped grant above is authoritative. Check existence only; a
      // user-wide ownership lookup would reintroduce the old leak path.
      const { data: brand, error: brandError } = await supabase
        .from('brands')
        .select('id')
        .eq('id', brand_id)
        .single()

      if (brandError || !brand) {
        return {
          content: [{ type: 'text' as const, text: 'Error: Brand not found or you do not have access.' }],
          isError: true,
        }
      }

      // A thread key so follow-ups land on the same conversation. Minted when
      // the client doesn't supply one — the client can pin it from here on.
      // Stored on input (JSONB) so no schema change is needed.
      const conversationId = conversation_id ?? crypto.randomUUID()

      // Insert the job row → status='queued'
      const { data: job, error: jobError } = await supabase
        .from('mcp_jobs')
        .insert({
          user_id: principal.userId,
          brand_id,
          channel: execution.channel,
          api_key_id: execution.apiKeyId,
          project_access_grant_id: execution.projectAccessGrantId,
          policy_version: execution.policyVersion,
          job_type: 'director_chat',
          status: 'queued',
          input: { brand_id, message, conversation_id: conversationId },
        })
        .select('id, created_at')
        .single()

      if (jobError || !job) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `Error: Failed to queue Director job. ${jobError?.message ?? ''}`,
            },
          ],
          isError: true,
        }
      }

      // Fire-and-forget the actual Director run via after().
      // after() keeps the function alive after the response is sent — Vercel
      // will run this for up to maxDuration (300s). The MCP client gets the
      // job_id immediately and starts polling.
      after(async () => {
        try {
          await runDirectorJob(job.id, execution, {
            brand_id,
            message,
            // Pin the run to this thread only when the client asked for it;
            // otherwise the Director continues the brand's latest thread.
            conversation_id,
          })
        } catch (err) {
          console.error('[chat_with_director] background runner threw:', err)
        }
      })

      const response = {
        job_id: job.id,
        conversation_id: conversationId,
        status: 'running' as const,
        poll_in_seconds: 10,
        message:
          'The Director is working on your request in the background. Call get_director_response with this job_id in 10 seconds. Most jobs complete in 15-90 seconds. Pass conversation_id back on your next chat_with_director call to stay on this thread.',
        created_at: job.created_at,
      }

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(response, null, 2),
          },
        ],
      }
    },
  )
}

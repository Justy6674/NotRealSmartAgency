/**
 * get_director_response — poll an async Director job.
 *
 * Pair with chat_with_director. The flow is:
 *   1. Call chat_with_director → get { job_id, status: 'running' }
 *   2. Wait 10s
 *   3. Call get_director_response(job_id) → if still running, wait 10s and retry
 *   4. When status is 'done', read result.response
 *   5. If status is 'error', read error
 */

import { z } from 'zod/v3'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { createAdminClient } from '@/lib/supabase/admin'

export function registerGetDirectorResponseTool(mcpServer: McpServer, userId: string) {
  mcpServer.registerTool(
    'get_director_response',
    {
      description: `Poll an async Director job created by chat_with_director.

USAGE PATTERN:
1. Call chat_with_director → get { job_id }
2. Wait 10 seconds
3. Call get_director_response({ job_id }) → if status is 'running', wait 10 more seconds and call again
4. When status is 'done', read result.response (this is the Director's actual reply)
5. If status is 'error', read error
6. Maximum poll time should be ~5 minutes — Director jobs that exceed that are stuck

DO NOT call this tool repeatedly without waiting between calls. Wait at least 10 seconds between polls.`,
      inputSchema: {
        job_id: z.string().describe('The job ID returned from chat_with_director'),
      },
    },
    async ({ job_id }: { job_id: string }) => {
      const supabase = createAdminClient()

      const { data: job, error } = await supabase
        .from('mcp_jobs')
        .select('id, status, result, error, cost_cents, duration_ms, created_at, started_at, completed_at')
        .eq('id', job_id)
        .eq('user_id', userId)
        .single()

      if (error || !job) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `Error: Job ${job_id} not found or you do not have access.`,
            },
          ],
          isError: true,
        }
      }

      // Still running — tell client to wait
      if (job.status === 'queued' || job.status === 'running') {
        const elapsedMs = job.started_at
          ? Date.now() - new Date(job.started_at).getTime()
          : Date.now() - new Date(job.created_at).getTime()

        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify(
                {
                  status: job.status,
                  elapsed_seconds: Math.round(elapsedMs / 1000),
                  message: 'Director is still working. Wait 10 more seconds and call this tool again.',
                },
                null,
                2,
              ),
            },
          ],
        }
      }

      // Error path
      if (job.status === 'error') {
        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify(
                {
                  status: 'error',
                  error: job.error,
                  duration_ms: job.duration_ms,
                },
                null,
                2,
              ),
            },
          ],
          isError: true,
        }
      }

      // Done — return the Director's response
      const result = (job.result ?? {}) as Record<string, unknown>
      const response = (result.response as string) ?? '(empty response)'

      return {
        content: [
          {
            type: 'text' as const,
            text: response,
          },
          {
            type: 'text' as const,
            text: JSON.stringify(
              {
                status: 'done',
                cost_cents: job.cost_cents,
                duration_ms: job.duration_ms,
                input_tokens: result.input_tokens,
                output_tokens: result.output_tokens,
              },
              null,
              2,
            ),
          },
        ],
      }
    },
  )
}

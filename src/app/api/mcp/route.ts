export const maxDuration = 600 // Director delegation + first-upload Mixpost video transcode (~382s) need >300s

import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js'
import { resolveApiKey } from '@/lib/auth/api-key'
import { createNRSMcpServer } from '@/lib/mcp/server'
import { logAudit } from '@/lib/agents/audit'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

/**
 * Authenticate the request via Bearer token.
 * Returns userId or an error Response.
 */
async function authenticate(request: Request): Promise<{ userId: string } | Response> {
  const auth = request.headers.get('authorization')
  if (!auth?.startsWith('Bearer ')) {
    return new Response(JSON.stringify({
      jsonrpc: '2.0',
      error: { code: -32001, message: 'Missing Authorization header. Use: Bearer nrs_sk_...' },
      id: null,
    }), { status: 401, headers: { 'Content-Type': 'application/json' } })
  }

  const token = auth.slice(7)
  const result = await resolveApiKey(token)

  if (!result) {
    return new Response(JSON.stringify({
      jsonrpc: '2.0',
      error: { code: -32001, message: 'Invalid or revoked API key.' },
      id: null,
    }), { status: 401, headers: { 'Content-Type': 'application/json' } })
  }

  return result
}

/**
 * Create transport + server and handle the request.
 * Stateless — fresh instances per request (Vercel serverless compatible).
 */
async function handleMcpRequest(request: Request): Promise<Response> {
  const authResult = await authenticate(request)
  if (authResult instanceof Response) return authResult

  const { userId } = authResult

  // Create MCP server for this user
  const mcpServer = createNRSMcpServer(userId)

  // Stateless transport — no sessionIdGenerator
  const transport = new WebStandardStreamableHTTPServerTransport({
    enableJsonResponse: true,
  })

  // Connect server to transport
  await mcpServer.connect(transport)

  // Audit log (fire-and-forget)
  const supabase = createAdminClient()
  logAudit({
    supabase,
    userId,
    action: 'mcp_request',
    entityType: 'mcp',
    detail: { method: request.method },
    costCents: 0,
  }).catch(() => {})

  // Handle the request and return the response
  const response = await transport.handleRequest(request)
  return response
}

// MCP Streamable HTTP requires POST (tool calls, messages)
export async function POST(request: Request) {
  return handleMcpRequest(request)
}

// GET is used for SSE streams (server → client notifications)
export async function GET(request: Request) {
  return handleMcpRequest(request)
}

// DELETE is used for session termination
export async function DELETE(request: Request) {
  return handleMcpRequest(request)
}

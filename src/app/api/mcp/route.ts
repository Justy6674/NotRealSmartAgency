export const maxDuration = 600 // Director delegation + first-upload Mixpost video transcode (~382s) need >300s

import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js'
import { resolveApiKey } from '@/lib/auth/api-key'
import { createNRSMcpServer } from '@/lib/mcp/server'
import { logAudit } from '@/lib/agents/audit'
import { createAdminClient } from '@/lib/supabase/admin'
import { createMcpPrincipal, type McpPrincipal } from '@/lib/security/project-access'

export const dynamic = 'force-dynamic'

const RESOURCE_METADATA_URL = 'https://www.notrealsmart.com.au/.well-known/oauth-protected-resource'

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, GET, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'content-type, authorization, mcp-protocol-version',
}

/**
 * MCP discovery/handshake methods that don't access user data.
 * These MUST be allowed without auth so Claude Desktop can:
 * 1. Fetch serverInfo (name, version, icons) on initialize
 * 2. Complete the notifications/initialized handshake
 * 3. List available tools before the user authenticates
 * 4. Respond to ping health checks
 *
 * Matches the pattern used by EndorsMe and other working MCP servers.
 */
const PUBLIC_METHODS = new Set([
  'initialize',
  'notifications/initialized',
  'ping',
  'tools/list',
  'prompts/list',
  'resources/list',
])

/**
 * Create transport + server and handle the request.
 * Stateless — fresh instances per request (Vercel serverless compatible).
 */
async function handleMcpRequest(request: Request): Promise<Response> {
  // Clone request so we can read the body to check the method
  // without consuming it for the transport
  const bodyText = await request.text()

  // Parse method from JSON-RPC body
  let method = ''
  try {
    const parsed = JSON.parse(bodyText)
    method = parsed.method || ''
  } catch {
    // Not valid JSON — will fail at transport level
  }

  const isPublicMethod = PUBLIC_METHODS.has(method)
  const auth = request.headers.get('authorization')

  // If this is a protected method without auth, return 401 with discovery hint
  if (!isPublicMethod && !auth?.startsWith('Bearer ')) {
    return new Response(JSON.stringify({
      jsonrpc: '2.0',
      error: { code: -32000, message: 'Authentication required. Provide a Bearer token.' },
      id: null,
    }), {
      status: 401,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
        'WWW-Authenticate': `Bearer resource_metadata="${RESOURCE_METADATA_URL}", scope="mcp:tools"`,
      },
    })
  }

  // Resolve a project-scoped principal — anonymous discovery gets no grants.
  let principal: McpPrincipal = createMcpPrincipal({
    userId: 'anonymous-initialize',
    keyId: 'anonymous-initialize',
    grants: [],
  })
  if (!isPublicMethod && auth?.startsWith('Bearer ')) {
    const token = auth.slice(7)
    const result = await resolveApiKey(token)
    if (!result) {
      return new Response(JSON.stringify({
        jsonrpc: '2.0',
        error: { code: -32001, message: 'Invalid or revoked API key.' },
        id: null,
      }), {
        status: 401,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
          'WWW-Authenticate': `Bearer resource_metadata="${RESOURCE_METADATA_URL}", scope="mcp:tools"`,
        },
      })
    }
    principal = result
  }

  // Create MCP server for this scoped connection.
  const mcpServer = createNRSMcpServer(principal)

  // Stateless transport — no sessionIdGenerator
  const transport = new WebStandardStreamableHTTPServerTransport({
    enableJsonResponse: true,
  })

  // Connect server to transport
  await mcpServer.connect(transport)

  // Audit log (fire-and-forget, skip for public methods)
  if (!isPublicMethod) {
    const supabase = createAdminClient()
    logAudit({
      supabase,
      userId: principal.userId,
      action: 'mcp_request',
      entityType: 'mcp',
      detail: { method },
      costCents: 0,
    }).catch(() => {})
  }

  // Reconstruct request with the body text we already consumed
  const reconstructedRequest = new Request(request.url, {
    method: request.method,
    headers: request.headers,
    body: bodyText,
  })

  // Handle the request and return the response
  const response = await transport.handleRequest(reconstructedRequest)

  // Add CORS headers to the response
  const newHeaders = new Headers(response.headers)
  for (const [key, value] of Object.entries(corsHeaders)) {
    newHeaders.set(key, value)
  }

  return new Response(response.body, {
    status: response.status,
    headers: newHeaders,
  })
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

// CORS preflight
export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders })
}

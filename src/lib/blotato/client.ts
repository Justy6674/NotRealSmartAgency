/**
 * Blotato MCP Client
 *
 * Calls Blotato's MCP server at https://mcp.blotato.com/mcp
 * using the user's API key stored in user_integrations table.
 *
 * Blotato provides AI content creation, visual generation, content
 * extraction/repurposing, and multi-platform publishing.
 *
 * Used ALONGSIDE Mixpost — Director chooses which to use:
 * - Blotato: AI creation, visual generation, content repurposing
 * - Mixpost: Scheduling, analytics, self-hosted publishing
 */

const BLOTATO_MCP_URL = 'https://mcp.blotato.com/mcp'

export interface BlotatoAccount {
  id: string
  platform: string
  name: string
  username: string | null
}

export interface BlotatoPostResult {
  postSubmissionId: string
  status: string
}

export interface BlotatoSource {
  sourceId: string
  status: 'processing' | 'completed' | 'failed'
  content?: string
}

export interface BlotatoVisual {
  visualId: string
  status: string
  url?: string
}

export interface BlotatoSchedule {
  id: string
  scheduledAt: string
  content: string
  accounts: string[]
  status: string
}

/**
 * Call a Blotato MCP tool via their HTTP endpoint.
 * Returns the tool result or null if Blotato is not configured.
 */
async function callBlotatoTool(
  apiKey: string,
  toolName: string,
  args: Record<string, unknown> = {}
): Promise<unknown> {
  const response = await fetch(BLOTATO_MCP_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'blotato-api-key': apiKey,
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: Date.now(),
      method: 'tools/call',
      params: {
        name: toolName,
        arguments: args,
      },
    }),
  })

  if (!response.ok) {
    const text = await response.text().catch(() => '')
    throw new Error(`Blotato API error ${response.status}: ${text}`)
  }

  const data = await response.json()
  if (data.error) {
    throw new Error(`Blotato tool error: ${data.error.message ?? JSON.stringify(data.error)}`)
  }

  return data.result?.content?.[0]?.text
    ? JSON.parse(data.result.content[0].text)
    : data.result
}

// ── Account & Auth ────────────────────────────────────────────────────────────

export async function blotatoGetUser(apiKey: string) {
  return callBlotatoTool(apiKey, 'blotato_get_user')
}

export async function blotatoListAccounts(apiKey: string, platform?: string) {
  return callBlotatoTool(apiKey, 'blotato_list_accounts', platform ? { platform } : {})
}

// ── Publishing ────────────────────────────────────────────────────────────────

export async function blotatoCreatePost(
  apiKey: string,
  params: {
    accounts: string[]
    text: string
    mediaUrls?: string[]
    scheduledAt?: string
  }
) {
  return callBlotatoTool(apiKey, 'blotato_create_post', params)
}

export async function blotatoGetPostStatus(apiKey: string, postSubmissionId: string) {
  return callBlotatoTool(apiKey, 'blotato_get_post_status', { postSubmissionId })
}

// ── Content Extraction ────────────────────────────────────────────────────────

export async function blotatoCreateSource(
  apiKey: string,
  params: { url?: string; text?: string }
) {
  return callBlotatoTool(apiKey, 'blotato_create_source', params)
}

export async function blotatoGetSourceStatus(apiKey: string, sourceId: string) {
  return callBlotatoTool(apiKey, 'blotato_get_source_status', { sourceId })
}

// ── Visual Generation ─────────────────────────────────────────────────────────

export async function blotatoListTemplates(apiKey: string, query?: string) {
  return callBlotatoTool(apiKey, 'blotato_list_visual_templates', query ? { query } : {})
}

export async function blotatoCreateVisual(
  apiKey: string,
  params: { templateId: string; prompt: string }
) {
  return callBlotatoTool(apiKey, 'blotato_create_visual', params)
}

export async function blotatoGetVisualStatus(apiKey: string, visualId: string) {
  return callBlotatoTool(apiKey, 'blotato_get_visual_status', { visualId })
}

// ── Content Calendar ──────────────────────────────────────────────────────────

export async function blotatoListSchedules(apiKey: string, cursor?: string) {
  return callBlotatoTool(apiKey, 'blotato_list_schedules', cursor ? { cursor } : {})
}

export async function blotatoGetSchedule(apiKey: string, scheduleId: string) {
  return callBlotatoTool(apiKey, 'blotato_get_schedule', { scheduleId })
}

export async function blotatoUpdateSchedule(
  apiKey: string,
  params: { scheduleId: string; text?: string; scheduledAt?: string }
) {
  return callBlotatoTool(apiKey, 'blotato_update_schedule', params)
}

export async function blotatoDeleteSchedule(apiKey: string, scheduleId: string) {
  return callBlotatoTool(apiKey, 'blotato_delete_schedule', { scheduleId })
}

// ── Media Upload ──────────────────────────────────────────────────────────────

export async function blotatoCreateUploadUrl(
  apiKey: string,
  params: { fileName: string; fileType: string }
) {
  return callBlotatoTool(apiKey, 'blotato_create_presigned_upload_url', params)
}

// ── Helper: Get API key from user_integrations ────────────────────────────────

export async function getBlotatoApiKey(
  supabase: import('@supabase/supabase-js').SupabaseClient,
  userId: string
): Promise<string | null> {
  const { data } = await supabase
    .from('user_integrations')
    .select('api_key')
    .eq('user_id', userId)
    .eq('provider', 'blotato')
    .single()

  return data?.api_key ?? null
}

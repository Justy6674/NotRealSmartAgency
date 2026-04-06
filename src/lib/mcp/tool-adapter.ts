import { z } from 'zod/v3'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { ToolContext } from '@/lib/agents/tools'
import { createAdminClient } from '@/lib/supabase/admin'

type ZodShape = Record<string, z.ZodTypeAny>

/**
 * Adapt an AI SDK tool to register it as an MCP tool.
 * Adds brand_id as a required parameter. Verifies brand ownership.
 */
export function adaptToolForMCP(
  name: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  aiSdkTool: any,
  mcpServer: McpServer,
  userId: string,
) {
  if (!aiSdkTool.execute) return

  // The AI SDK tool() function stores the zod schema as .inputSchema
  // with a .shape property containing { paramName: z.string(), ... }
  const zodSchema = aiSdkTool.inputSchema ?? aiSdkTool.parameters
  const originalShape: ZodShape = zodSchema?.shape ?? {}

  const mcpShape: ZodShape = {
    brand_id: z.string().describe('Brand ID — get from brands://list resource'),
    ...originalShape,
  }

  mcpServer.registerTool(name, {
    description: aiSdkTool.description ?? name,
    inputSchema: mcpShape,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  }, async (args: any) => {
    const brandId = args.brand_id as string
    const toolArgs = { ...args }
    delete toolArgs.brand_id

    // Verify brand ownership
    const supabase = createAdminClient()
    const { data: brand, error } = await supabase
      .from('brands')
      .select('id')
      .eq('id', brandId)
      .eq('user_id', userId)
      .single()

    if (error || !brand) {
      return {
        content: [{ type: 'text' as const, text: 'Error: Brand not found or access denied.' }],
        isError: true,
      }
    }

    try {
      const result = await aiSdkTool.execute(toolArgs, {
        toolCallId: crypto.randomUUID(),
        messages: [],
      })

      const text = typeof result === 'string'
        ? result
        : JSON.stringify(result, null, 2)

      return {
        content: [{ type: 'text' as const, text }],
      }
    } catch (err) {
      return {
        content: [{
          type: 'text' as const,
          text: `Error: ${err instanceof Error ? err.message : String(err)}`,
        }],
        isError: true,
      }
    }
  })
}

/**
 * Register a batch of AI SDK tools as MCP tools.
 * Only registers tools that have both description and execute.
 */
export function adaptToolsForMCP(
  tools: Record<string, unknown>,
  mcpServer: McpServer,
  userId: string,
) {
  for (const [name, tool] of Object.entries(tools)) {
    if (tool && typeof tool === 'object' && 'execute' in tool) {
      adaptToolForMCP(name, tool, mcpServer, userId)
    }
  }
}

import { z } from 'zod/v3'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { createAdminClient } from '@/lib/supabase/admin'
import { getToolsForAgent } from '@/lib/agents/tools'

type ZodShape = Record<string, z.ZodTypeAny>

/**
 * Adapt an AI SDK tool to register it as an MCP tool.
 *
 * CRITICAL: AI SDK tools have brandId baked into their closure at creation time.
 * We can't reuse a pre-built tool with a different brandId. Instead, we rebuild
 * the tool fresh for each MCP call with the correct brandId from the args.
 */
export function adaptToolForMCP(
  name: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  aiSdkTool: any,
  mcpServer: McpServer,
  userId: string,
  toolFactory: (brandId: string) => Record<string, unknown>,
) {
  if (!aiSdkTool.execute) return

  const zodSchema = aiSdkTool.inputSchema ?? aiSdkTool.parameters
  const originalShape: ZodShape = zodSchema?.shape ?? {}

  const mcpShape: ZodShape = {
    brand_id: z.string().describe('Brand ID — call list_brands first to get IDs'),
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

    // Rebuild the tool with the CORRECT brandId — not the dummy placeholder
    const freshTools = toolFactory(brandId)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const freshTool = freshTools[name] as any

    if (!freshTool?.execute) {
      return {
        content: [{ type: 'text' as const, text: `Error: Tool "${name}" not available for this brand.` }],
        isError: true,
      }
    }

    try {
      const result = await freshTool.execute(toolArgs, {
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
 * The toolFactory rebuilds tools with the correct brandId per call.
 */
export function adaptToolsForMCP(
  tools: Record<string, unknown>,
  mcpServer: McpServer,
  userId: string,
  toolFactory: (brandId: string) => Record<string, unknown>,
) {
  for (const [name, tool] of Object.entries(tools)) {
    if (tool && typeof tool === 'object' && 'execute' in tool) {
      adaptToolForMCP(name, tool, mcpServer, userId, toolFactory)
    }
  }
}

/**
 * The only AI SDK tools an external MCP client may invoke directly.
 *
 * MCP clients are messengers. They can inspect agency state and perform a
 * small set of bounded utilities, but all other work must pass through the
 * Director so its brand, compliance, Review, and approval rules apply. This
 * is deliberately an allowlist: newly added tools stay Director-only unless
 * they are explicitly reviewed for direct MCP use.
 */
export const DIRECT_MCP_TOOLS: ReadonlySet<string> = new Set([
  // Read-only agency state
  'query_media',
  'query_calendar',
  'query_outputs',
  'query_analytics',
  'query_social_analytics',

  // Bounded, non-public utilities
  'scan_website',
  'browse_page',
  'generate_image',
  'save_output',
])

export function isDirectMcpTool(name: string): boolean {
  return DIRECT_MCP_TOOLS.has(name)
}

export function isDirectorOnlyMcpTool(name: string): boolean {
  return !isDirectMcpTool(name)
}

export function getDirectMcpToolEntries<T>(tools: Record<string, T>): Array<[string, T]> {
  return Object.entries(tools).filter(([name]) => isDirectMcpTool(name)) as Array<[string, T]>
}

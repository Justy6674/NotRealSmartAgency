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

  // Read-only design library
  'search_designs',
  'list_brand_kits',
  'get_export_formats',

  // Bounded, non-public utilities
  'scan_website',
  'browse_page',
  'generate_image',
  'save_output',

  // Asset handling. These write only to the owner's own media library or
  // produce a download URL — they publish nothing and write no marketing copy,
  // so routing them through the Director added a round trip without adding a
  // safeguard. Getting finished artwork out of Canva and into the library is
  // the step every carousel needs, and it was the slowest part of the loop.
  'upload_media',
  'export_design',
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

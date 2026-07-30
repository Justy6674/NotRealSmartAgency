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
  // The brand contract. This is the whole reason a plugged-in assistant can be
  // trusted to build anything: without it, only copy routed through the
  // Director was brand-aware and every design was a guess.
  'get_brand_kit',

  // The goal interview. This is the one thing that must work from whichever
  // surface he happens to be using — he sets goals when he thinks of them,
  // not when he is sitting in front of the web app. It asks one question and
  // records one answer per call, so a plug-in client cannot use it to write a
  // goal he never agreed to.
  'goal_interview',

  // Setting a project up in Canva. Bounded and idempotent — it writes the
  // owner's own recorded brand into his own Canva account and nothing else —
  // and he does this when he thinks of it, which is rarely at a desk.
  'sync_brand_to_canva',

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

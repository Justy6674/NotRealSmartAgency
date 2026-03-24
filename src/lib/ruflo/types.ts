// ---------------------------------------------------------------------------
// Ruflo memory types — used by both the Ruflo MCP (dev-time) and
// the Supabase-backed runtime client
// ---------------------------------------------------------------------------

export interface MemoryEntry {
  key: string
  namespace: string
  value: string | Record<string, unknown>
  tags: string[]
  created_at: string
  updated_at: string
}

export interface MemorySearchResult {
  key: string
  namespace: string
  value: string | Record<string, unknown>
  similarity: number
  tags: string[]
}

export interface AgentStatus {
  agentId: string
  agentType: string
  status: 'spawned' | 'active' | 'idle' | 'terminated'
  model: string
  domain?: string
  createdAt: string
}

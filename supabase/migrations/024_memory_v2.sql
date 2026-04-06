-- Memory System v2: pgvector semantic search + user isolation + LLM extraction
-- Transforms agent_memories from keyword-only (broken) to production-grade learning

-- 1. Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;

-- 2. Add new columns to agent_memories
ALTER TABLE agent_memories
  ADD COLUMN IF NOT EXISTS embedding extensions.vector(1536),
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS memory_type text DEFAULT 'conversation',
  ADD COLUMN IF NOT EXISTS confidence real DEFAULT 1.0,
  ADD COLUMN IF NOT EXISTS source text DEFAULT 'regex',
  ADD COLUMN IF NOT EXISTS conversation_id uuid;

-- 3. HNSW index for fast cosine similarity search
CREATE INDEX IF NOT EXISTS idx_agent_memories_embedding
  ON agent_memories USING hnsw (embedding extensions.vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- 4. Index on user_id for RLS filtering
CREATE INDEX IF NOT EXISTS idx_agent_memories_user_id
  ON agent_memories (user_id);

-- 5. Index on memory_type for priority-based retrieval
CREATE INDEX IF NOT EXISTS idx_agent_memories_type
  ON agent_memories (memory_type);

-- 6. Composite index for user + namespace (most common query pattern)
CREATE INDEX IF NOT EXISTS idx_agent_memories_user_namespace
  ON agent_memories (user_id, namespace);

-- 7. Semantic search function
CREATE OR REPLACE FUNCTION match_memories(
  query_embedding extensions.vector(1536),
  match_threshold float DEFAULT 0.7,
  match_count int DEFAULT 10,
  filter_namespace text DEFAULT NULL,
  filter_user_id uuid DEFAULT NULL
) RETURNS TABLE (
  id uuid,
  key text,
  namespace text,
  value text,
  tags text[],
  memory_type text,
  confidence real,
  similarity float,
  created_at timestamptz,
  updated_at timestamptz
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  SELECT
    am.id,
    am.key,
    am.namespace,
    am.value,
    am.tags,
    am.memory_type,
    am.confidence,
    (1 - (am.embedding <=> query_embedding))::float AS similarity,
    am.created_at,
    am.updated_at
  FROM agent_memories am
  WHERE (filter_namespace IS NULL OR am.namespace = filter_namespace)
    AND (filter_user_id IS NULL OR am.user_id = filter_user_id)
    AND am.embedding IS NOT NULL
    AND (1 - (am.embedding <=> query_embedding)) > match_threshold
  ORDER BY am.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- 8. Backfill user_id from brand ownership (namespace format: nrs-{brandSlug}-{agentType})
-- Extract brand slug from namespace, look up brand owner
UPDATE agent_memories am
SET user_id = b.user_id
FROM brands b
WHERE am.user_id IS NULL
  AND am.namespace LIKE 'nrs-%'
  AND b.slug = split_part(
    regexp_replace(am.namespace, '^nrs-', ''),
    '-',
    1
  );

-- For global namespace memories (nrs-agency), assign to the first user (admin)
UPDATE agent_memories
SET user_id = (SELECT id FROM auth.users ORDER BY created_at ASC LIMIT 1)
WHERE user_id IS NULL AND namespace = 'nrs-agency';

-- Catch any remaining orphans — assign to first user
UPDATE agent_memories
SET user_id = (SELECT id FROM auth.users ORDER BY created_at ASC LIMIT 1)
WHERE user_id IS NULL;

-- 9. RLS policies for multi-tenant isolation
-- Drop existing overly permissive policies
DROP POLICY IF EXISTS "Service role manages memories" ON agent_memories;

-- Owner can do everything with their own memories
CREATE POLICY "Users manage own memories"
  ON agent_memories FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Team members can read brand memories (via namespace containing brand slug)
CREATE POLICY "Team members read brand memories"
  ON agent_memories FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM team_members tm
      JOIN brands b ON b.user_id = agent_memories.user_id
      WHERE tm.member_id = auth.uid()
        AND tm.owner_id = agent_memories.user_id
        AND (
          tm.brand_ids IS NULL  -- NULL = access to all brands
          OR b.id = ANY(tm.brand_ids)
        )
        AND agent_memories.namespace LIKE 'nrs-' || b.slug || '%'
    )
  );

-- Team admins can also write memories (their conversations contribute)
CREATE POLICY "Team admins write brand memories"
  ON agent_memories FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM team_members tm
      WHERE tm.member_id = auth.uid()
        AND tm.owner_id = agent_memories.user_id
        AND tm.role IN ('admin', 'owner')
    )
  );

-- Service role keeps full access (for cron jobs, consolidation)
CREATE POLICY "Service role full access"
  ON agent_memories FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

import type { SupabaseClient } from '@supabase/supabase-js'
import type { AgentType } from '@/types/database'
import { wordCount } from './word-count'
import { createSaveOutputTool } from './save-output'

interface ToolContext {
  supabase: SupabaseClient
  userId: string
  brandId: string
  conversationId: string | null
}

export function getToolsForAgent(agentType: AgentType, ctx: ToolContext) {
  const saveOutput = createSaveOutputTool(
    ctx.supabase,
    ctx.userId,
    ctx.brandId,
    ctx.conversationId
  )

  // All agents get save_output. Agents that produce text content also get word_count.
  const toolSets: Record<AgentType, Record<string, typeof saveOutput | typeof wordCount>> = {
    content: { save_output: saveOutput, word_count: wordCount },
    seo: { save_output: saveOutput, word_count: wordCount },
    paid_ads: { save_output: saveOutput, word_count: wordCount },
    strategy: { save_output: saveOutput },
    email: { save_output: saveOutput, word_count: wordCount },
    growth: { save_output: saveOutput },
    brand: { save_output: saveOutput },
    competitor: { save_output: saveOutput },
    website: { save_output: saveOutput, word_count: wordCount },
    compliance: { save_output: saveOutput },
  }

  return toolSets[agentType] ?? { save_output: saveOutput }
}

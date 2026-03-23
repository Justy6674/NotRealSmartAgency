import type { SupabaseClient } from '@supabase/supabase-js'
import type { AgentType } from '@/types/database'
import { wordCount } from './word-count'
import { createSaveOutputTool } from './save-output'
import { createScanWebsiteTool } from './scan-website'
import { createScanGithubTool } from './scan-github'
import { createScanSocialTool } from './scan-social'
import { createMarketingAuditTool } from './marketing-audit'

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

  const scanWebsite = createScanWebsiteTool(ctx.supabase, ctx.userId, ctx.brandId)
  const scanGithub = createScanGithubTool(ctx.supabase, ctx.userId, ctx.brandId)
  const scanSocial = createScanSocialTool(ctx.supabase, ctx.userId, ctx.brandId)
  const marketingAudit = createMarketingAuditTool(ctx.supabase, ctx.userId, ctx.brandId)

  // Tool sets per agent type
  const toolSets: Partial<Record<AgentType, Record<string, unknown>>> = {
    overall: {
      save_output: saveOutput,
      scan_website: scanWebsite,
      scan_github: scanGithub,
      scan_social: scanSocial,
      marketing_audit: marketingAudit,
    },
    content: { save_output: saveOutput, word_count: wordCount },
    growth: { save_output: saveOutput, word_count: wordCount, scan_website: scanWebsite },
    strategy: { save_output: saveOutput },
    competitor: { save_output: saveOutput, scan_website: scanWebsite },
    website: { save_output: saveOutput, word_count: wordCount, scan_website: scanWebsite },
    compliance: { save_output: saveOutput, scan_website: scanWebsite },
    martech: { save_output: saveOutput, scan_github: scanGithub },
    // Archived agents — still functional for old conversations
    seo: { save_output: saveOutput, word_count: wordCount },
    paid_ads: { save_output: saveOutput, word_count: wordCount },
    email: { save_output: saveOutput, word_count: wordCount },
    brand: { save_output: saveOutput },
  }

  return (toolSets[agentType] ?? { save_output: saveOutput }) as Record<string, typeof saveOutput>
}

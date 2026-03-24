import type { SupabaseClient } from '@supabase/supabase-js'
import type { AgentType, Brand } from '@/types/database'
import { wordCount } from './word-count'
import { createSaveOutputTool } from './save-output'
import { createScanWebsiteTool } from './scan-website'
import { createScanGithubTool } from './scan-github'
import { createScanSocialTool } from './scan-social'
import { createMarketingAuditTool } from './marketing-audit'
import { createCreateTaskTool } from './create-task'
import { createRequestApprovalTool } from './request-approval'
import { createHandoffTool } from './handoff'

export interface ToolContext {
  supabase: SupabaseClient
  userId: string
  brandId: string
  conversationId: string | null
  agentRegistryId?: string | null
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

  // Management tools — available to all agents
  const createTask = createCreateTaskTool({
    supabase: ctx.supabase,
    userId: ctx.userId,
    brandId: ctx.brandId,
    agentRegistryId: ctx.agentRegistryId ?? null,
  })

  const requestApproval = createRequestApprovalTool({
    supabase: ctx.supabase,
    userId: ctx.userId,
    agentRegistryId: ctx.agentRegistryId ?? null,
  })

  const handoff = createHandoffTool({
    supabase: ctx.supabase,
    userId: ctx.userId,
    brandId: ctx.brandId,
    agentRegistryId: ctx.agentRegistryId ?? null,
  })

  // Base management tools every agent gets
  const managementTools = {
    create_task: createTask,
    request_approval: requestApproval,
    handoff_to_department: handoff,
  }

  // Tool sets per agent type
  // Note: delegate_to_agent is added separately in the chat route for the Director
  const toolSets: Partial<Record<AgentType, Record<string, unknown>>> = {
    overall: {
      save_output: saveOutput,
      scan_website: scanWebsite,
      scan_github: scanGithub,
      scan_social: scanSocial,
      marketing_audit: marketingAudit,
      ...managementTools,
    },
    content: { save_output: saveOutput, word_count: wordCount, ...managementTools },
    growth: { save_output: saveOutput, word_count: wordCount, scan_website: scanWebsite, ...managementTools },
    strategy: { save_output: saveOutput, ...managementTools },
    competitor: { save_output: saveOutput, scan_website: scanWebsite, ...managementTools },
    website: { save_output: saveOutput, word_count: wordCount, scan_website: scanWebsite, ...managementTools },
    compliance: { save_output: saveOutput, scan_website: scanWebsite, ...managementTools },
    seo: { save_output: saveOutput, word_count: wordCount, scan_website: scanWebsite, ...managementTools },
    paid_ads: { save_output: saveOutput, word_count: wordCount, ...managementTools },
    email: { save_output: saveOutput, word_count: wordCount, ...managementTools },
    brand: { save_output: saveOutput, ...managementTools },
    analytics: { save_output: saveOutput, scan_website: scanWebsite, ...managementTools },
    automation: { save_output: saveOutput, scan_github: scanGithub, ...managementTools },
    martech: { save_output: saveOutput, scan_github: scanGithub },
  }

  return (toolSets[agentType] ?? { save_output: saveOutput, ...managementTools }) as Record<string, typeof saveOutput>
}

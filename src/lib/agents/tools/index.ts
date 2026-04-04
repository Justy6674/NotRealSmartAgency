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
import { createSendEmailTool } from './send-email'
import { createGenerateImageTool } from './generate-image'
import { createBrowsePageTool } from './browse-page'
import { createReadGmailTool } from './read-gmail'
import { createGenerateSlidesTool } from './generate-slides'
import { createQueryOutputsTool } from './query-outputs'
import { createQueryCalendarTool } from './query-calendar'
import { createQueryAnalyticsTool } from './query-analytics'
import { createQueryMediaTool } from './query-media'
import { createProcessMediaTool } from './process-media'
import { createRepurposeContentTool } from './repurpose-content'
import { createFillCalendarTool } from './fill-calendar'
import { createSaveBrandInfoTool } from './save-brand-info'
import { createReadProformaTool, createUpdateProformaTool } from './proforma'
import { createDesignGraphicTool, createExportDesignTool, createSearchDesignsTool, createSearchFoldersTool, createListFolderItemsTool, createListBrandKitsTool, createGetDesignTool } from './canva'
import { createCreateVideoTool } from './create-video'
import { createWriteBlogTool } from './write-blog'
import { createWriteEmailCampaignTool } from './write-email-campaign'
import { createDeepCompetitorScanTool } from './deep-competitor-scan'
import { createManagePostsTool } from './manage-posts'
import { createAnalyseVoiceTool } from './analyse-voice'
import { createWriteAdsTool } from './write-ads'
import { createAddInspirationTool, createSearchInspirationTool } from './inspiration'

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

  // New capability tools
  const sendEmail = createSendEmailTool()
  const generateImageTool = createGenerateImageTool()
  const browsePage = createBrowsePageTool()
  const readGmail = createReadGmailTool()
  const generateSlides = createGenerateSlidesTool()
  const queryOutputs = createQueryOutputsTool(ctx.supabase, ctx.userId, ctx.brandId)
  const queryCalendar = createQueryCalendarTool(ctx.supabase, ctx.userId, ctx.brandId)
  const queryAnalytics = createQueryAnalyticsTool(ctx.supabase, ctx.userId, ctx.brandId)
  const queryMedia = createQueryMediaTool(ctx.supabase, ctx.userId, ctx.brandId)
  const processMedia = createProcessMediaTool(ctx.supabase, ctx.userId, ctx.brandId, ctx.conversationId)
  const repurposeContent = createRepurposeContentTool(ctx.supabase, ctx.userId, ctx.brandId, ctx.conversationId)
  const fillCalendar = createFillCalendarTool(ctx.supabase, ctx.userId, ctx.brandId, ctx.conversationId)
  const saveBrandInfo = createSaveBrandInfoTool(ctx.supabase, ctx.userId, ctx.brandId, ctx.conversationId)
  const readProforma = createReadProformaTool(ctx.supabase, ctx.brandId)
  const updateProforma = createUpdateProformaTool(ctx.supabase, ctx.brandId, ctx.conversationId)
  const designGraphic = createDesignGraphicTool(ctx.supabase, ctx.userId, ctx.brandId)
  const exportDesign = createExportDesignTool(ctx.supabase, ctx.userId)
  const searchDesigns = createSearchDesignsTool(ctx.supabase, ctx.userId)
  const searchFolders = createSearchFoldersTool(ctx.supabase, ctx.userId)
  const listFolderItems = createListFolderItemsTool(ctx.supabase, ctx.userId)
  const listBrandKits = createListBrandKitsTool(ctx.supabase, ctx.userId)
  const getDesign = createGetDesignTool(ctx.supabase, ctx.userId)
  const createVideo = createCreateVideoTool(ctx.supabase, ctx.userId, ctx.brandId, ctx.conversationId)
  const writeBlog = createWriteBlogTool(ctx.supabase, ctx.userId, ctx.brandId, ctx.conversationId)
  const writeEmailCampaign = createWriteEmailCampaignTool(ctx.supabase, ctx.userId, ctx.brandId, ctx.conversationId)
  const deepCompetitorScan = createDeepCompetitorScanTool(ctx.supabase, ctx.userId, ctx.brandId)
  const managePosts = createManagePostsTool(ctx.supabase, ctx.userId, ctx.brandId)
  const analyseVoice = createAnalyseVoiceTool(ctx.supabase, ctx.userId, ctx.brandId)
  const writeAds = createWriteAdsTool(ctx.supabase, ctx.userId, ctx.brandId, ctx.conversationId)
  const addInspiration = createAddInspirationTool(ctx.supabase, ctx.userId)
  const searchInspiration = createSearchInspirationTool(ctx.supabase, ctx.userId)

  // Base management tools every agent gets
  const managementTools = {
    create_task: createTask,
    request_approval: requestApproval,
    handoff_to_department: handoff,
    query_outputs: queryOutputs,
    read_proforma: readProforma,
  }

  // Tool sets per agent type
  // Note: delegate_to_agent is added separately in the chat route for the Director
  const toolSets: Partial<Record<AgentType, Record<string, unknown>>> = {
    overall: {
      save_output: saveOutput,
      save_brand_info: saveBrandInfo,
      scan_website: scanWebsite,
      scan_github: scanGithub,
      scan_social: scanSocial,
      marketing_audit: marketingAudit,
      browse_page: browsePage,
      generate_image: generateImageTool,
      send_email: sendEmail,
      read_gmail: readGmail,
      generate_slides: generateSlides,
      process_media: processMedia,
      repurpose_content: repurposeContent,
      fill_calendar: fillCalendar,
      query_calendar: queryCalendar,
      query_analytics: queryAnalytics,
      query_media: queryMedia,
      update_proforma: updateProforma,
      design_graphic: designGraphic,
      export_design: exportDesign,
      search_designs: searchDesigns,
      search_folders: searchFolders,
      list_folder_items: listFolderItems,
      list_brand_kits: listBrandKits,
      get_design: getDesign,
      create_video: createVideo,
      write_blog: writeBlog,
      deep_competitor_scan: deepCompetitorScan,
      write_email_campaign: writeEmailCampaign,
      manage_posts: managePosts,
      analyse_voice: analyseVoice,
      write_ads: writeAds,
      add_inspiration: addInspiration,
      search_inspiration: searchInspiration,
      ...managementTools,
    },
    content: { save_output: saveOutput, word_count: wordCount, generate_image: generateImageTool, generate_slides: generateSlides, repurpose_content: repurposeContent, write_blog: writeBlog, analyse_voice: analyseVoice, search_designs: searchDesigns, list_brand_kits: listBrandKits, design_graphic: designGraphic, export_design: exportDesign, ...managementTools },
    growth: { save_output: saveOutput, word_count: wordCount, scan_website: scanWebsite, send_email: sendEmail, browse_page: browsePage, read_gmail: readGmail, ...managementTools },
    strategy: { save_output: saveOutput, browse_page: browsePage, generate_slides: generateSlides, fill_calendar: fillCalendar, query_calendar: queryCalendar, manage_posts: managePosts, search_inspiration: searchInspiration, ...managementTools },
    competitor: { save_output: saveOutput, scan_website: scanWebsite, browse_page: browsePage, deep_competitor_scan: deepCompetitorScan, ...managementTools },
    website: { save_output: saveOutput, word_count: wordCount, scan_website: scanWebsite, browse_page: browsePage, generate_image: generateImageTool, ...managementTools },
    compliance: { save_output: saveOutput, scan_website: scanWebsite, browse_page: browsePage, ...managementTools },
    seo: { save_output: saveOutput, word_count: wordCount, scan_website: scanWebsite, browse_page: browsePage, write_blog: writeBlog, ...managementTools },
    paid_ads: { save_output: saveOutput, word_count: wordCount, generate_image: generateImageTool, write_ads: writeAds, search_designs: searchDesigns, list_brand_kits: listBrandKits, design_graphic: designGraphic, export_design: exportDesign, ...managementTools },
    email: { save_output: saveOutput, word_count: wordCount, send_email: sendEmail, read_gmail: readGmail, write_email_campaign: writeEmailCampaign, ...managementTools },
    brand: { save_output: saveOutput, generate_image: generateImageTool, design_graphic: designGraphic, export_design: exportDesign, search_designs: searchDesigns, search_folders: searchFolders, list_folder_items: listFolderItems, list_brand_kits: listBrandKits, get_design: getDesign, analyse_voice: analyseVoice, ...managementTools },
    analytics: { save_output: saveOutput, scan_website: scanWebsite, browse_page: browsePage, query_analytics: queryAnalytics, ...managementTools },
    automation: { save_output: saveOutput, scan_github: scanGithub, browse_page: browsePage, ...managementTools },
    video: { save_output: saveOutput, word_count: wordCount, process_media: processMedia, repurpose_content: repurposeContent, query_media: queryMedia, create_video: createVideo, ...managementTools },
    martech: { save_output: saveOutput, scan_github: scanGithub },
  }

  return (toolSets[agentType] ?? { save_output: saveOutput, ...managementTools }) as Record<string, typeof saveOutput>
}

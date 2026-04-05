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
import { createDesignGraphicTool, createExportDesignTool, createSearchDesignsTool, createSearchFoldersTool, createListFolderItemsTool, createListBrandKitsTool, createGetDesignTool, createStartEditingTransactionTool, createPerformEditingOperationsTool, createCommitEditingTransactionTool, createCancelEditingTransactionTool, createGetDesignContentTool, createGetDesignPagesTool, createGetDesignAssetsTool, createResizeDesignTool, createUploadAssetFromUrlTool, createDesignFromCandidateTool, createRequestOutlineReviewTool, createImportDesignFromUrlTool } from './canva'
import { createCreateVideoTool } from './create-video'
import { createWriteBlogTool } from './write-blog'
import { createWriteEmailCampaignTool } from './write-email-campaign'
import { createDeepCompetitorScanTool } from './deep-competitor-scan'
import { createManagePostsTool } from './manage-posts'
import { createAnalyseVoiceTool } from './analyse-voice'
import { createWriteAdsTool } from './write-ads'
import { createAddInspirationTool, createSearchInspirationTool } from './inspiration'
import { createQuerySocialAnalyticsTool } from './query-social-analytics'
import { createManageTagsTool } from './manage-tags'
import { createBrowseMixpostMediaTool } from './browse-mixpost-media'
import { createVideoAgentTool } from './video-agent'
import { createMultiSceneVideoTool } from './multi-scene-video'
import { createRegisterWebhookTool } from './register-webhook'
import { createTranslateVideoTool } from './translate-video'
import { createTranslationStatusTool } from './translation-status'
import { createListHeyGenTemplatesTool, createGetHeyGenTemplateTool, createGenerateFromTemplateTool } from './heygen-templates'

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
  const startEditingTransaction = createStartEditingTransactionTool(ctx.supabase, ctx.userId)
  const performEditingOperations = createPerformEditingOperationsTool(ctx.supabase, ctx.userId)
  const commitEditingTransaction = createCommitEditingTransactionTool(ctx.supabase, ctx.userId)
  const cancelEditingTransaction = createCancelEditingTransactionTool(ctx.supabase, ctx.userId)
  const getDesignContent = createGetDesignContentTool(ctx.supabase, ctx.userId)
  const getDesignPages = createGetDesignPagesTool(ctx.supabase, ctx.userId)
  const getDesignAssets = createGetDesignAssetsTool(ctx.supabase, ctx.userId)
  const resizeDesign = createResizeDesignTool(ctx.supabase, ctx.userId)
  const uploadAssetFromUrl = createUploadAssetFromUrlTool(ctx.supabase, ctx.userId)
  const designFromCandidate = createDesignFromCandidateTool(ctx.supabase, ctx.userId)
  const requestOutlineReview = createRequestOutlineReviewTool(ctx.supabase, ctx.userId)
  const importDesignFromUrl = createImportDesignFromUrlTool(ctx.supabase, ctx.userId)
  const createVideo = createCreateVideoTool(ctx.supabase, ctx.userId, ctx.brandId, ctx.conversationId)
  const writeBlog = createWriteBlogTool(ctx.supabase, ctx.userId, ctx.brandId, ctx.conversationId)
  const writeEmailCampaign = createWriteEmailCampaignTool(ctx.supabase, ctx.userId, ctx.brandId, ctx.conversationId)
  const deepCompetitorScan = createDeepCompetitorScanTool(ctx.supabase, ctx.userId, ctx.brandId)
  const managePosts = createManagePostsTool(ctx.supabase, ctx.userId, ctx.brandId)
  const analyseVoice = createAnalyseVoiceTool(ctx.supabase, ctx.userId, ctx.brandId)
  const writeAds = createWriteAdsTool(ctx.supabase, ctx.userId, ctx.brandId, ctx.conversationId)
  const addInspiration = createAddInspirationTool(ctx.supabase, ctx.userId)
  const searchInspiration = createSearchInspirationTool(ctx.supabase, ctx.userId)
  const querySocialAnalytics = createQuerySocialAnalyticsTool(ctx.supabase, ctx.userId, ctx.brandId)
  const manageTags = createManageTagsTool()
  const browseMixpostMedia = createBrowseMixpostMediaTool()
  const videoAgent = createVideoAgentTool(ctx.supabase, ctx.userId, ctx.brandId, ctx.conversationId)
  const multiSceneVideo = createMultiSceneVideoTool(ctx.supabase, ctx.userId, ctx.brandId, ctx.conversationId)
  const registerWebhook = createRegisterWebhookTool(ctx.supabase, ctx.userId)
  const translateVideoTool = createTranslateVideoTool(ctx.supabase, ctx.userId, ctx.brandId, ctx.conversationId)
  const translationStatus = createTranslationStatusTool(ctx.supabase, ctx.userId)
  const listHeyGenTemplates = createListHeyGenTemplatesTool(ctx.supabase, ctx.userId)
  const getHeyGenTemplate = createGetHeyGenTemplateTool(ctx.supabase, ctx.userId)
  const generateFromTemplateTool = createGenerateFromTemplateTool(ctx.supabase, ctx.userId, ctx.brandId, ctx.conversationId)

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
      start_editing_transaction: startEditingTransaction,
      perform_editing_operations: performEditingOperations,
      commit_editing_transaction: commitEditingTransaction,
      cancel_editing_transaction: cancelEditingTransaction,
      get_design_content: getDesignContent,
      get_design_pages: getDesignPages,
      get_design_assets: getDesignAssets,
      resize_design: resizeDesign,
      upload_asset_from_url: uploadAssetFromUrl,
      design_from_candidate: designFromCandidate,
      request_outline_review: requestOutlineReview,
      import_design_from_url: importDesignFromUrl,
      create_video: createVideo,
      write_blog: writeBlog,
      deep_competitor_scan: deepCompetitorScan,
      write_email_campaign: writeEmailCampaign,
      manage_posts: managePosts,
      analyse_voice: analyseVoice,
      write_ads: writeAds,
      add_inspiration: addInspiration,
      search_inspiration: searchInspiration,
      generate_video_agent: videoAgent,
      create_multi_scene_video: multiSceneVideo,
      register_webhook: registerWebhook,
      translate_video: translateVideoTool,
      translation_status: translationStatus,
      list_heygen_templates: listHeyGenTemplates,
      get_heygen_template: getHeyGenTemplate,
      generate_from_template: generateFromTemplateTool,
      query_social_analytics: querySocialAnalytics,
      manage_tags: manageTags,
      browse_mixpost_media: browseMixpostMedia,
      ...managementTools,
    },
    content: { save_output: saveOutput, word_count: wordCount, generate_image: generateImageTool, generate_slides: generateSlides, repurpose_content: repurposeContent, write_blog: writeBlog, analyse_voice: analyseVoice, search_designs: searchDesigns, list_brand_kits: listBrandKits, design_graphic: designGraphic, export_design: exportDesign, start_editing_transaction: startEditingTransaction, perform_editing_operations: performEditingOperations, commit_editing_transaction: commitEditingTransaction, cancel_editing_transaction: cancelEditingTransaction, get_design_content: getDesignContent, get_design_pages: getDesignPages, get_design_assets: getDesignAssets, resize_design: resizeDesign, upload_asset_from_url: uploadAssetFromUrl, design_from_candidate: designFromCandidate, import_design_from_url: importDesignFromUrl, generate_video_agent: videoAgent, translate_video: translateVideoTool, list_heygen_templates: listHeyGenTemplates, get_heygen_template: getHeyGenTemplate, generate_from_template: generateFromTemplateTool, browse_mixpost_media: browseMixpostMedia, ...managementTools },
    growth: { save_output: saveOutput, word_count: wordCount, scan_website: scanWebsite, send_email: sendEmail, browse_page: browsePage, read_gmail: readGmail, ...managementTools },
    strategy: { save_output: saveOutput, browse_page: browsePage, generate_slides: generateSlides, fill_calendar: fillCalendar, query_calendar: queryCalendar, manage_posts: managePosts, search_inspiration: searchInspiration, query_social_analytics: querySocialAnalytics, manage_tags: manageTags, ...managementTools },
    competitor: { save_output: saveOutput, scan_website: scanWebsite, browse_page: browsePage, deep_competitor_scan: deepCompetitorScan, ...managementTools },
    website: { save_output: saveOutput, word_count: wordCount, scan_website: scanWebsite, browse_page: browsePage, generate_image: generateImageTool, ...managementTools },
    compliance: { save_output: saveOutput, scan_website: scanWebsite, browse_page: browsePage, get_design_content: getDesignContent, get_design_pages: getDesignPages, ...managementTools },
    seo: { save_output: saveOutput, word_count: wordCount, scan_website: scanWebsite, browse_page: browsePage, write_blog: writeBlog, ...managementTools },
    paid_ads: { save_output: saveOutput, word_count: wordCount, generate_image: generateImageTool, write_ads: writeAds, search_designs: searchDesigns, list_brand_kits: listBrandKits, design_graphic: designGraphic, export_design: exportDesign, start_editing_transaction: startEditingTransaction, perform_editing_operations: performEditingOperations, commit_editing_transaction: commitEditingTransaction, cancel_editing_transaction: cancelEditingTransaction, get_design_content: getDesignContent, get_design_pages: getDesignPages, get_design_assets: getDesignAssets, resize_design: resizeDesign, upload_asset_from_url: uploadAssetFromUrl, design_from_candidate: designFromCandidate, list_heygen_templates: listHeyGenTemplates, get_heygen_template: getHeyGenTemplate, generate_from_template: generateFromTemplateTool, ...managementTools },
    email: { save_output: saveOutput, word_count: wordCount, send_email: sendEmail, read_gmail: readGmail, write_email_campaign: writeEmailCampaign, ...managementTools },
    brand: { save_output: saveOutput, generate_image: generateImageTool, design_graphic: designGraphic, export_design: exportDesign, search_designs: searchDesigns, search_folders: searchFolders, list_folder_items: listFolderItems, list_brand_kits: listBrandKits, get_design: getDesign, start_editing_transaction: startEditingTransaction, perform_editing_operations: performEditingOperations, commit_editing_transaction: commitEditingTransaction, cancel_editing_transaction: cancelEditingTransaction, get_design_content: getDesignContent, get_design_pages: getDesignPages, get_design_assets: getDesignAssets, resize_design: resizeDesign, upload_asset_from_url: uploadAssetFromUrl, design_from_candidate: designFromCandidate, import_design_from_url: importDesignFromUrl, analyse_voice: analyseVoice, ...managementTools },
    analytics: { save_output: saveOutput, scan_website: scanWebsite, browse_page: browsePage, query_analytics: queryAnalytics, query_social_analytics: querySocialAnalytics, ...managementTools },
    automation: { save_output: saveOutput, scan_github: scanGithub, browse_page: browsePage, register_webhook: registerWebhook, ...managementTools },
    video: { save_output: saveOutput, word_count: wordCount, process_media: processMedia, repurpose_content: repurposeContent, query_media: queryMedia, create_video: createVideo, generate_video_agent: videoAgent, create_multi_scene_video: multiSceneVideo, translate_video: translateVideoTool, translation_status: translationStatus, list_heygen_templates: listHeyGenTemplates, get_heygen_template: getHeyGenTemplate, generate_from_template: generateFromTemplateTool, browse_mixpost_media: browseMixpostMedia, ...managementTools },
    martech: { save_output: saveOutput, scan_github: scanGithub },
  }

  return (toolSets[agentType] ?? { save_output: saveOutput, ...managementTools }) as Record<string, typeof saveOutput>
}

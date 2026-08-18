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
import { createProjectBriefTool } from './project-brief'
import { createGoalInterviewTool } from './goal-interview'
import { createSyncBrandToCanvaTool } from './sync-brand-canva'
import { createHandoffTool } from './handoff'
import { createSendEmailTool } from './send-email'
import { createGenerateImageTool } from './generate-image'
import { createBrowsePageTool } from './browse-page'
import { createReadGmailTool } from './read-gmail'
import { createGenerateSlidesTool } from './generate-slides'
import { createQueryOutputsTool } from './query-outputs'
import { createQueryCalendarTool } from './query-calendar'
import { createQueryAnalyticsTool } from './query-analytics'
import { createQuerySiteTrafficTool } from './query-site-traffic'
import { createApproveProposalTool } from './approve-proposal'
import { createCaptionVideoTool } from './caption-video'
import { createTightenVideoTool } from './tighten-video'
import { createSearchBrainTool } from './search-brain'
import { createQueryMediaTool } from './query-media'
import { createProcessMediaTool } from './process-media'
import { createRepurposeContentTool } from './repurpose-content'
import { getZernioReplyTool } from './zernio-reply'
import { getZernioAdsTool, getZernioAnalyticsTool } from './zernio-ads'
import { createFillCalendarTool } from './fill-calendar'
import { createSaveBrandInfoTool } from './save-brand-info'
import { createReadProformaTool, createUpdateProformaTool } from './proforma'
import { createDesignGraphicTool, createExportDesignTool, createSearchDesignsTool, createSearchFoldersTool, createListFolderItemsTool, createListBrandKitsTool, createCanvaTemplateCopyTool, createGetBrandTemplateDatasetTool, createGetDesignTool, createGetDesignContentTool, createGetDesignPagesTool, createGetDesignAssetsTool, createResizeDesignTool, createUploadAssetFromUrlTool, createDesignFromCandidateTool, createRequestOutlineReviewTool, createImportDesignFromUrlTool, createCommentOnDesignTool, createListCommentsTool, createListRepliesTool, createReplyToCommentTool, createCreateFolderTool, createMoveItemToFolderTool, createGetExportFormatsTool, createResolveShortlinkTool, createGenerateDesignStructuredTool, createGetPresenterNotesTool } from './canva'
import { createWriteBlogTool } from './write-blog'
import { createWriteEmailCampaignTool } from './write-email-campaign'
import { createDeepCompetitorScanTool } from './deep-competitor-scan'
import { createManagePostsTool } from './manage-posts'
import { createCollageTool } from './create-collage'
import { createVerifyProductTool } from './verify-product'
import { createAnalyseVoiceTool } from './analyse-voice'
import { createWriteAdsTool } from './write-ads'
import { createAddInspirationTool, createSearchInspirationTool } from './inspiration'
import { createQuerySocialAnalyticsTool } from './query-social-analytics'
import { createManageTagsTool } from './manage-tags'
import { createBrowseMixpostMediaTool } from './browse-mixpost-media'
import { createListMixpostTemplatesTool, createCreateMixpostTemplateTool } from './mixpost-templates'
import { createAnalyseContentGapsTool } from './analyse-content-gaps'
import { createPublishToSocialTool } from './publish-to-social'
import { createProposePostTool } from './propose-post'
import { createFillComposeDeskTool } from './fill-compose-desk'
import { createUploadMediaTool } from './upload-media'
import { createManageCollectionsTool } from './manage-collections'
import { createManageMediaTagsTool } from './manage-media-tags'
import { createResearchIndustryTool } from './research-industry'
import { createBlotatoListAccountsTool, createBlotatoPublishTool, createBlotatoExtractContentTool, createBlotatoSourceStatusTool, createBlotatoListTemplatesTool, createBlotatoCreateVisualTool, createBlotatoVisualStatusTool, createBlotatoPostStatusTool } from './blotato'
import { createExtractBrandKitTool } from './extract-brand-kit'
import { createGetBrandKitTool } from './get-brand-kit'
import { createReviewContentTool } from './review-content'
import { createInspectProjectMarketingBackendTool } from './project-backend-marketing'
import { createSetActiveGoalTool, createUpdateGoalProgressTool } from './manage-goal'
import { createAbeAiTool } from './abeai'
import { createPicoSearchTool } from './pico'
import { createImportCanvaDesignToMediaTool } from './import-canva-design-to-media'
import { createCarouselProposalTool } from './create-carousel-proposal'
import { readCanvaTemplateContract } from '@/lib/canva/template-contract'

export interface ToolContext {
  supabase: SupabaseClient
  userId: string
  brandId: string
  /** Used to remove regulated-only tools from non-regulated brand runs. */
  brand?: Pick<Brand, 'slug' | 'compliance_flags' | 'brand_dna_constraints'>
  conversationId: string | null
  agentRegistryId?: string | null
  /** Present for autonomous heartbeat work; approval requests retain this link. */
  taskId?: string | null
  /**
   * The owner's own words for this turn, verbatim — never the model's
   * paraphrase, and never NRS's own media directive (strip that first).
   *
   * Used by manage_posts to decide, deterministically, when a deictic "use
   * THIS image" must beat the older media id the model recalled from the
   * transcript. Optional: channels that have no owner turn (heartbeat work,
   * plug-in tool calls) simply leave it off and behave exactly as before.
   */
  ownerMessage?: string
}

export function getToolsForAgent(agentType: AgentType, ctx: ToolContext) {
  const templateContract = readCanvaTemplateContract(ctx.brand?.brand_dna_constraints)
  const templateLockedVisuals = templateContract?.requireTemplateForSocialVisuals === true
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

  const zernioReply = getZernioReplyTool(ctx.supabase, ctx.userId, ctx.brandId)
  const zernioAds = getZernioAdsTool()
  const zernioAnalytics = getZernioAnalyticsTool()
  
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
    brandId: ctx.brandId,
    agentRegistryId: ctx.agentRegistryId ?? null,
    taskId: ctx.taskId ?? null,
  })

  const handoff = createHandoffTool({
    supabase: ctx.supabase,
    userId: ctx.userId,
    brandId: ctx.brandId,
    agentRegistryId: ctx.agentRegistryId ?? null,
  })

  const setActiveGoal = createSetActiveGoalTool({
    supabase: ctx.supabase,
    userId: ctx.userId,
    brandId: ctx.brandId,
    agentRegistryId: ctx.agentRegistryId ?? null,
  })
  const updateGoalProgress = createUpdateGoalProgressTool({
    supabase: ctx.supabase,
    userId: ctx.userId,
    brandId: ctx.brandId,
    agentRegistryId: ctx.agentRegistryId ?? null,
  })

  // New capability tools
  const sendEmail = createSendEmailTool()
  const generateImageTool = createGenerateImageTool(ctx.supabase, ctx.userId, ctx.brandId)
  const browsePage = createBrowsePageTool()
  const readGmail = createReadGmailTool()
  const generateSlides = createGenerateSlidesTool()
  const queryOutputs = createQueryOutputsTool(ctx.supabase, ctx.userId, ctx.brandId)
  const queryCalendar = createQueryCalendarTool(ctx.supabase, ctx.userId, ctx.brandId)
  const queryAnalytics = createQueryAnalyticsTool(ctx.supabase, ctx.userId, ctx.brandId)
  const querySiteTraffic = createQuerySiteTrafficTool(ctx.supabase, ctx.userId, ctx.brandId)
  const approveProposal = createApproveProposalTool(ctx.supabase, ctx.userId, ctx.brandId)
  const captionVideo = createCaptionVideoTool(ctx.brandId, ctx.userId)
  const tightenVideo = createTightenVideoTool(ctx.brandId, ctx.userId)
  // Available to every department: his written rules apply to all of them.
  const searchBrain = createSearchBrainTool()
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
  const listBrandKits = createListBrandKitsTool(ctx.supabase, ctx.userId, ctx.brandId)
  const createCanvaTemplateCopy = createCanvaTemplateCopyTool(ctx.supabase, ctx.userId, ctx.brandId)
  const getBrandTemplateDataset = createGetBrandTemplateDatasetTool(ctx.supabase, ctx.userId, ctx.brandId)
  const getDesign = createGetDesignTool(ctx.supabase, ctx.userId)
  const getDesignContent = createGetDesignContentTool(ctx.supabase, ctx.userId)
  const getDesignPages = createGetDesignPagesTool(ctx.supabase, ctx.userId)
  const getDesignAssets = createGetDesignAssetsTool(ctx.supabase, ctx.userId)
  const resizeDesign = createResizeDesignTool(ctx.supabase, ctx.userId)
  const uploadAssetFromUrl = createUploadAssetFromUrlTool(ctx.supabase, ctx.userId)
  const designFromCandidate = createDesignFromCandidateTool(ctx.supabase, ctx.userId)
  const requestOutlineReview = createRequestOutlineReviewTool(ctx.supabase, ctx.userId)
  const importDesignFromUrl = createImportDesignFromUrlTool(ctx.supabase, ctx.userId)
  const commentOnDesign = createCommentOnDesignTool(ctx.supabase, ctx.userId)
  const listComments = createListCommentsTool(ctx.supabase, ctx.userId)
  const listReplies = createListRepliesTool(ctx.supabase, ctx.userId)
  const replyToComment = createReplyToCommentTool(ctx.supabase, ctx.userId)
  const createFolder = createCreateFolderTool(ctx.supabase, ctx.userId)
  const moveItemToFolder = createMoveItemToFolderTool(ctx.supabase, ctx.userId)
  const getExportFormats = createGetExportFormatsTool(ctx.supabase, ctx.userId)
  const resolveShortlink = createResolveShortlinkTool(ctx.supabase, ctx.userId)
  const generateDesignStructured = createGenerateDesignStructuredTool(ctx.supabase, ctx.userId, ctx.brandId)
  const importCanvaDesignToMedia = createImportCanvaDesignToMediaTool(ctx.supabase, ctx.userId, ctx.brandId)
  const createCarouselProposal = createCarouselProposalTool(ctx.supabase, ctx.userId, ctx.brandId)
  const getPresenterNotes = createGetPresenterNotesTool(ctx.supabase, ctx.userId)
  const writeBlog = createWriteBlogTool(ctx.supabase, ctx.userId, ctx.brandId, ctx.conversationId)
  const writeEmailCampaign = createWriteEmailCampaignTool(ctx.supabase, ctx.userId, ctx.brandId, ctx.conversationId)
  const deepCompetitorScan = createDeepCompetitorScanTool(ctx.supabase, ctx.userId, ctx.brandId)
  const managePosts = createManagePostsTool(
    ctx.supabase,
    ctx.userId,
    ctx.brandId,
    ctx.ownerMessage,
    ctx.conversationId,
  )
  const createCollage = createCollageTool(ctx.supabase, ctx.userId, ctx.brandId)
  const verifyProduct = createVerifyProductTool(ctx.supabase, ctx.brandId)
  const analyseVoice = createAnalyseVoiceTool(ctx.supabase, ctx.userId, ctx.brandId)
  const writeAds = createWriteAdsTool(ctx.supabase, ctx.userId, ctx.brandId, ctx.conversationId)
  const addInspiration = createAddInspirationTool(ctx.supabase, ctx.userId)
  const searchInspiration = createSearchInspirationTool(ctx.supabase, ctx.userId)
  const querySocialAnalytics = createQuerySocialAnalyticsTool(ctx.supabase, ctx.userId, ctx.brandId)
  const manageTags = createManageTagsTool()
  const browseMixpostMedia = createBrowseMixpostMediaTool()
  const listMixpostTemplates = createListMixpostTemplatesTool()
  const createMixpostTemplateTool = createCreateMixpostTemplateTool()
  const analyseContentGaps = createAnalyseContentGapsTool(ctx.supabase, ctx.userId, ctx.brandId)
  const publishToSocial = createPublishToSocialTool(ctx.supabase, ctx.userId, ctx.brandId)
  const proposePost = createProposePostTool(ctx.supabase, ctx.userId, ctx.brandId)
  const fillComposeDesk = createFillComposeDeskTool(ctx.supabase, ctx.userId, ctx.brandId)
  const uploadMedia = createUploadMediaTool(ctx.supabase, ctx.userId, ctx.brandId)
  const manageCollections = createManageCollectionsTool(ctx.supabase, ctx.userId, ctx.brandId)
  const manageMediaTags = createManageMediaTagsTool(ctx.supabase, ctx.userId, ctx.brandId)
  const researchIndustry = createResearchIndustryTool(ctx.supabase, ctx.userId, ctx.brandId)
  const extractBrandKit = createExtractBrandKitTool(ctx.supabase, ctx.userId, ctx.brandId)
  const projectBrief = createProjectBriefTool(ctx.supabase, ctx.userId, ctx.brandId)
  const goalInterview = createGoalInterviewTool(ctx.supabase, ctx.userId, ctx.brandId)
  const syncBrandToCanva = createSyncBrandToCanvaTool(ctx.supabase, ctx.userId, ctx.brandId)
  const getBrandKit = createGetBrandKitTool(ctx.supabase, ctx.userId, ctx.brandId)
  const reviewContent = createReviewContentTool(ctx.supabase, ctx.userId, ctx.brandId)
  const inspectProjectMarketingBackend = createInspectProjectMarketingBackendTool(ctx.supabase, ctx.brandId)
  // The regulatory corpus is not general marketing memory. Do not expose its
  // tool to ScentSell or another unregulated brand and rely on prompt prose to
  // stop a model from using it.
  const regulated = Boolean(ctx.brand?.compliance_flags?.ahpra || ctx.brand?.compliance_flags?.tga)
  const abeAi = regulated
    ? createAbeAiTool({
        supabase: ctx.supabase,
        userId: ctx.userId,
        agentRegistryId: ctx.agentRegistryId ?? null,
        taskId: ctx.taskId ?? null,
      })
    : null
  const picoSearch = createPicoSearchTool({
    supabase: ctx.supabase,
    userId: ctx.userId,
    agentRegistryId: ctx.agentRegistryId ?? null,
    taskId: ctx.taskId ?? null,
  })

  // Blotato tools (AI content creation, visual generation, content repurposing)
  // Used alongside Mixpost — Director chooses which is best per task
  const blotatoListAccountsTool = createBlotatoListAccountsTool(ctx.supabase, ctx.userId)
  const blotatoPublish = createBlotatoPublishTool(ctx.supabase, ctx.userId)
  const blotatoExtractContent = createBlotatoExtractContentTool(ctx.supabase, ctx.userId)
  const blotatoSourceStatus = createBlotatoSourceStatusTool(ctx.supabase, ctx.userId)
  const blotatoListTemplatesTool = createBlotatoListTemplatesTool(ctx.supabase, ctx.userId)
  const blotatoCreateVisualTool = createBlotatoCreateVisualTool(ctx.supabase, ctx.userId)
  const blotatoVisualStatus = createBlotatoVisualStatusTool(ctx.supabase, ctx.userId)
  const blotatoPostStatus = createBlotatoPostStatusTool(ctx.supabase, ctx.userId)

  // A template-locked brand deliberately cannot call an image or visual
  // generator. Prompt prose cannot prevent a model from inventing type or
  // layout, so the capabilities are absent at the tool boundary instead.
  const generatedImageTools = templateLockedVisuals
    ? {}
    : {
        generate_image: generateImageTool,
      }
  const visualGenerationTools = templateLockedVisuals
    ? {}
    : {
        ...generatedImageTools,
        blotato_list_templates: blotatoListTemplatesTool,
        blotato_create_visual: blotatoCreateVisualTool,
        blotato_visual_status: blotatoVisualStatus,
      }

  // Base management tools every agent gets
  const managementTools = {
    create_task: createTask,
    request_approval: requestApproval,
    handoff_to_department: handoff,
    query_outputs: queryOutputs,
    read_proforma: readProforma,
    // Every department needs the brand contract, not just the Director. A
    // department that cannot see the palette or the never-do list produces work
    // that has to be corrected after the fact.
    get_brand_kit: getBrandKit,
    project_brief: projectBrief,
    goal_interview: goalInterview,
    sync_brand_to_canva: syncBrandToCanva,
  }

  // Tool sets per agent type
  // Note: delegate_to_agent is added separately in the chat route for the Director
  const toolSets: Partial<Record<AgentType, Record<string, unknown>>> = {
    overall: {
      zernio_reply: zernioReply,
      zernio_ads: zernioAds,
      zernio_analytics: zernioAnalytics,
      save_output: saveOutput,
      save_brand_info: saveBrandInfo,
      scan_website: scanWebsite,
      scan_github: scanGithub,
      scan_social: scanSocial,
      marketing_audit: marketingAudit,
      browse_page: browsePage,
      ...visualGenerationTools,
      send_email: sendEmail,
      read_gmail: readGmail,
      generate_slides: generateSlides,
      process_media: processMedia,
      repurpose_content: repurposeContent,
      fill_calendar: fillCalendar,
      query_calendar: queryCalendar,
      query_analytics: queryAnalytics,
      query_site_traffic: querySiteTraffic,
      approve_proposal: approveProposal,
      search_brain: searchBrain,
      caption_video: captionVideo,
      tighten_video: tightenVideo,
      query_media: queryMedia,
      update_proforma: updateProforma,
      design_graphic: designGraphic,
      export_design: exportDesign,
      search_designs: searchDesigns,
      search_folders: searchFolders,
      list_folder_items: listFolderItems,
      list_brand_templates: listBrandKits,
      create_canva_template_copy: createCanvaTemplateCopy,
      get_brand_template_dataset: getBrandTemplateDataset,
      get_design: getDesign,
      get_design_content: getDesignContent,
      get_design_pages: getDesignPages,
      get_design_assets: getDesignAssets,
      resize_design: resizeDesign,
      upload_asset_from_url: uploadAssetFromUrl,
      design_from_candidate: designFromCandidate,
      request_outline_review: requestOutlineReview,
      import_design_from_url: importDesignFromUrl,
      comment_on_design: commentOnDesign,
      list_comments: listComments,
      list_replies: listReplies,
      reply_to_comment: replyToComment,
      create_folder: createFolder,
      move_item_to_folder: moveItemToFolder,
      get_export_formats: getExportFormats,
      resolve_shortlink: resolveShortlink,
      generate_design_structured: generateDesignStructured,
      import_canva_design_to_media: importCanvaDesignToMedia,
      create_carousel_proposal: createCarouselProposal,
      get_presenter_notes: getPresenterNotes,
      write_blog: writeBlog,
      deep_competitor_scan: deepCompetitorScan,
      write_email_campaign: writeEmailCampaign,
      manage_posts: managePosts,
      create_collage: createCollage,
      verify_product: verifyProduct,
      analyse_voice: analyseVoice,
      write_ads: writeAds,
      add_inspiration: addInspiration,
      search_inspiration: searchInspiration,
      query_social_analytics: querySocialAnalytics,
      manage_tags: manageTags,
      browse_mixpost_media: browseMixpostMedia,
      list_mixpost_templates: listMixpostTemplates,
      create_mixpost_template: createMixpostTemplateTool,
      analyse_content_gaps: analyseContentGaps,
      publish_to_social: publishToSocial,
      propose_post_from_media: proposePost,
      fill_compose_desk: fillComposeDesk,
      upload_media: uploadMedia,
      manage_collections: manageCollections,
      manage_media_tags: manageMediaTags,
      research_industry: researchIndustry,
      extract_brand_kit: extractBrandKit,
      review_content: reviewContent,
      inspect_project_marketing_backend: inspectProjectMarketingBackend,
      ...(abeAi ? { use_abe_ai: abeAi } : {}),
      use_pico_search: picoSearch,
      set_active_goal: setActiveGoal,
      update_goal_progress: updateGoalProgress,
      // Blotato (AI content creation + visual generation + repurposing)
      blotato_list_accounts: blotatoListAccountsTool,
      blotato_publish: blotatoPublish,
      blotato_extract_content: blotatoExtractContent,
      blotato_source_status: blotatoSourceStatus,
      blotato_post_status: blotatoPostStatus,
      ...managementTools,
    },
    content: { search_brain: searchBrain, approve_proposal: approveProposal, caption_video: captionVideo, tighten_video: tightenVideo, save_output: saveOutput, create_collage: createCollage, verify_product: verifyProduct, word_count: wordCount, query_media: queryMedia, propose_post_from_media: proposePost, ...visualGenerationTools, generate_slides: generateSlides, repurpose_content: repurposeContent, write_blog: writeBlog, analyse_voice: analyseVoice, search_designs: searchDesigns, list_brand_templates: listBrandKits, create_canva_template_copy: createCanvaTemplateCopy, get_brand_template_dataset: getBrandTemplateDataset, design_graphic: designGraphic, export_design: exportDesign, get_design_content: getDesignContent, get_design_pages: getDesignPages, get_design_assets: getDesignAssets, resize_design: resizeDesign, upload_asset_from_url: uploadAssetFromUrl, design_from_candidate: designFromCandidate, import_design_from_url: importDesignFromUrl, get_export_formats: getExportFormats, generate_design_structured: generateDesignStructured, import_canva_design_to_media: importCanvaDesignToMedia, create_carousel_proposal: createCarouselProposal, browse_mixpost_media: browseMixpostMedia, list_mixpost_templates: listMixpostTemplates, create_mixpost_template: createMixpostTemplateTool, upload_media: uploadMedia, manage_collections: manageCollections, manage_media_tags: manageMediaTags, blotato_extract_content: blotatoExtractContent, blotato_source_status: blotatoSourceStatus, ...managementTools },
    growth: { save_output: saveOutput, word_count: wordCount, scan_website: scanWebsite, send_email: sendEmail, browse_page: browsePage, read_gmail: readGmail, ...managementTools },
    strategy: { save_output: saveOutput, browse_page: browsePage, generate_slides: generateSlides, fill_calendar: fillCalendar, query_calendar: queryCalendar, manage_posts: managePosts, search_inspiration: searchInspiration, query_social_analytics: querySocialAnalytics, manage_tags: manageTags, request_outline_review: requestOutlineReview, import_design_from_url: importDesignFromUrl, get_presenter_notes: getPresenterNotes, list_mixpost_templates: listMixpostTemplates, create_mixpost_template: createMixpostTemplateTool, analyse_content_gaps: analyseContentGaps, publish_to_social: publishToSocial, manage_collections: manageCollections, manage_media_tags: manageMediaTags, research_industry: researchIndustry, ...managementTools },
    competitor: { save_output: saveOutput, scan_website: scanWebsite, browse_page: browsePage, deep_competitor_scan: deepCompetitorScan, research_industry: researchIndustry, ...managementTools },
    website: { save_output: saveOutput, word_count: wordCount, scan_website: scanWebsite, browse_page: browsePage, ...generatedImageTools, ...managementTools },
    compliance: { save_output: saveOutput, scan_website: scanWebsite, browse_page: browsePage, get_design_content: getDesignContent, get_design_pages: getDesignPages, comment_on_design: commentOnDesign, list_comments: listComments, reply_to_comment: replyToComment, review_content: reviewContent, ...(abeAi ? { use_abe_ai: abeAi } : {}), ...managementTools },
    seo: { save_output: saveOutput, word_count: wordCount, scan_website: scanWebsite, browse_page: browsePage, write_blog: writeBlog, ...managementTools },
    paid_ads: { save_output: saveOutput, word_count: wordCount, ...generatedImageTools, write_ads: writeAds, search_designs: searchDesigns, list_brand_templates: listBrandKits, create_canva_template_copy: createCanvaTemplateCopy, get_brand_template_dataset: getBrandTemplateDataset, design_graphic: designGraphic, export_design: exportDesign, get_design_content: getDesignContent, get_design_pages: getDesignPages, get_design_assets: getDesignAssets, resize_design: resizeDesign, upload_asset_from_url: uploadAssetFromUrl, design_from_candidate: designFromCandidate, get_export_formats: getExportFormats, generate_design_structured: generateDesignStructured, ...managementTools },
    email: { save_output: saveOutput, word_count: wordCount, send_email: sendEmail, read_gmail: readGmail, write_email_campaign: writeEmailCampaign, ...managementTools },
    brand: { save_output: saveOutput, create_collage: createCollage, ...generatedImageTools, design_graphic: designGraphic, export_design: exportDesign, search_designs: searchDesigns, search_folders: searchFolders, list_folder_items: listFolderItems, list_brand_templates: listBrandKits, create_canva_template_copy: createCanvaTemplateCopy, get_brand_template_dataset: getBrandTemplateDataset, get_design: getDesign, get_design_content: getDesignContent, get_design_pages: getDesignPages, get_design_assets: getDesignAssets, resize_design: resizeDesign, upload_asset_from_url: uploadAssetFromUrl, design_from_candidate: designFromCandidate, import_design_from_url: importDesignFromUrl, comment_on_design: commentOnDesign, list_comments: listComments, list_replies: listReplies, reply_to_comment: replyToComment, create_folder: createFolder, move_item_to_folder: moveItemToFolder, resolve_shortlink: resolveShortlink, generate_design_structured: generateDesignStructured, import_canva_design_to_media: importCanvaDesignToMedia, create_carousel_proposal: createCarouselProposal, analyse_voice: analyseVoice, upload_media: uploadMedia, manage_collections: manageCollections, manage_media_tags: manageMediaTags, ...managementTools },
    analytics: { search_brain: searchBrain, approve_proposal: approveProposal, save_output: saveOutput, scan_website: scanWebsite, browse_page: browsePage, query_analytics: queryAnalytics, query_site_traffic: querySiteTraffic, query_social_analytics: querySocialAnalytics, analyse_content_gaps: analyseContentGaps, inspect_project_marketing_backend: inspectProjectMarketingBackend, ...managementTools },
    automation: { save_output: saveOutput, scan_github: scanGithub, browse_page: browsePage, inspect_project_marketing_backend: inspectProjectMarketingBackend, ...managementTools },
    video: { save_output: saveOutput, verify_product: verifyProduct, word_count: wordCount, process_media: processMedia, repurpose_content: repurposeContent, query_media: queryMedia, propose_post_from_media: proposePost, upload_asset_from_url: uploadAssetFromUrl, browse_mixpost_media: browseMixpostMedia, publish_to_social: publishToSocial, upload_media: uploadMedia, ...managementTools },
    help: { save_output: saveOutput, browse_page: browsePage, ...managementTools },
    martech: { save_output: saveOutput, scan_github: scanGithub },
  }

  return (toolSets[agentType] ?? { save_output: saveOutput, ...managementTools }) as Record<string, typeof saveOutput>
}

export type ProfessionType =
  | 'gp'
  | 'nurse_practitioner'
  | 'allied_health'
  | 'specialist'
  | 'telehealth'
  | 'aesthetics'
  | 'cannabis'
  | 'mental_health'
  | 'weight_loss'
  | 'practice_manager'
  | 'other'

export type SubscriptionTier = 'free' | 'starter' | 'professional' | 'practice'
export type SubscriptionStatus = 'active' | 'cancelled' | 'past_due' | 'trialing' | 'incomplete'
export type PhaseStatus = 'not_started' | 'in_progress' | 'completed' | 'skipped'
export type ScanType = 'website' | 'social_media' | 'google_business'
export type IntegrationProvider = 'halaxy' | 'xero' | 'stripe' | 'google_analytics' | 'heygen' | 'runway' | 'synthesia' | 'kling' | 'google_veo' | 'github' | 'deepgram' | 'instagram_business' | 'facebook_page' | 'linkedin_company' | 'twitter_app' | 'tiktok_business' | 'youtube_channel' | 'ayrshare'

export interface User {
  id: string
  email: string
  full_name: string | null
  profession_type: ProfessionType
  clinic_name: string | null
  clinic_url: string | null
  state: string | null
  subscription_tier: SubscriptionTier
  subscription_status: SubscriptionStatus | null
  stripe_customer_id: string | null
  stripe_subscription_id: string | null
  current_phase: number
  onboarding_completed: boolean
  diagnostic_id: string | null
  created_at: string
  updated_at: string
}

export interface Phase {
  id: string
  number: number
  slug: string
  title: string
  subtitle: string | null
  description: string
  category: string
  icon: string | null
  tier_required: SubscriptionTier
  content: PhaseContent
  sort_order: number
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface PhaseContent {
  overview: string
  checklist: string[]
  mistakes: string[]
  tips: string[]
}

export interface UserPhase {
  id: string
  user_id: string
  phase_id: string
  status: PhaseStatus
  score: number | null
  checklist_data: Record<string, boolean>
  notes: string | null
  started_at: string | null
  completed_at: string | null
  created_at: string
  updated_at: string
}

export interface Tool {
  id: string
  name: string
  slug: string
  category: string
  description: string | null
  website_url: string | null
  pricing_model: string | null
  price_from: string | null
  price_to: string | null
  has_free_tier: boolean
  australian_data_residency: boolean | null
  bulk_billing: boolean | null
  integrations: string[]
  profession_types: ProfessionType[]
  phase_numbers: number[]
  pros: string[]
  cons: string[]
  best_for: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface Regulation {
  id: string
  authority: string
  title: string
  summary: string
  full_text: string | null
  source_url: string | null
  effective_date: string | null
  supersedes_id: string | null
  profession_types: ProfessionType[]
  phase_numbers: number[]
  severity: string
  is_current: boolean
  last_verified_at: string
  created_at: string
}

export interface Diagnostic {
  id: string
  user_id: string | null
  session_id: string
  email: string | null
  profession_type: ProfessionType
  clinic_url: string | null
  responses: Record<string, string>
  website_scan: WebsiteScanResult
  phase_scores: Record<string, number>
  overall_score: number | null
  recommended_phase: number | null
  gap_report: GapReport
  completed_at: string | null
  created_at: string
}

export interface WebsiteScanResult {
  violations: ComplianceViolation[]
  score: number
  raw_text_length: number
}

export interface ComplianceViolation {
  check_id: string
  severity: 'critical' | 'warning' | 'info'
  found: boolean
  evidence: string
  explanation: string
  suggested_fix: string
  regulation: string
}

export interface GapReport {
  critical: string[]
  warnings: string[]
  passed: string[]
}

export interface ComplianceScan {
  id: string
  user_id: string
  url: string
  scan_type: ScanType
  raw_text: string | null
  results: {
    checks: ComplianceViolation[]
    violations: ComplianceViolation[]
    suggestions: string[]
  }
  score: number | null
  issues_found: number
  issues_resolved: number
  ai_model: string | null
  tokens_used: number | null
  scanned_at: string
  created_at: string
}

export interface UserIntegration {
  id: string
  user_id: string
  provider: IntegrationProvider
  access_token_expires_at: string | null
  last_sync_at: string | null
  sync_status: string
  sync_error: string | null
  cached_data: Record<string, unknown>
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface AiUsage {
  id: string
  user_id: string
  query_type: string
  tokens_input: number
  tokens_output: number
  model: string
  cost_usd: number
  created_at: string
}

// Profession type display labels
export const PROFESSION_LABELS: Record<ProfessionType, string> = {
  gp: 'General Practitioner',
  nurse_practitioner: 'Nurse Practitioner',
  allied_health: 'Allied Health',
  specialist: 'Specialist',
  telehealth: 'Telehealth Provider',
  aesthetics: 'Aesthetics',
  cannabis: 'Medicinal Cannabis',
  mental_health: 'Mental Health',
  weight_loss: 'Weight Management',
  practice_manager: 'Practice Manager',
  other: 'Other',
}

// Australian states
export const AU_STATES = [
  'QLD', 'NSW', 'VIC', 'SA', 'WA', 'TAS', 'NT', 'ACT',
] as const

// ─── Agency Platform Types ───

export type AgentType =
  | 'overall'     // NRS Director
  | 'content'     // Content & Copy
  | 'seo'         // SEO & GEO
  | 'paid_ads'    // Paid Ads
  | 'strategy'    // Strategy & Launch
  | 'email'       // Email Marketing
  | 'growth'      // Growth & Partnerships
  | 'brand'       // Brand
  | 'competitor'  // Market Intelligence
  | 'website'     // Web & CRO
  | 'compliance'  // Compliance
  | 'analytics'   // Analytics & Reporting
  | 'automation'  // Automation & AI
  | 'video'       // Video & Scripting
  // Archived (kept for backward compat with existing conversations)
  | 'martech'

/** Active agent types shown in the UI — 1 Director + 12 departments */
export const ACTIVE_AGENT_TYPES: AgentType[] = [
  'overall',
  'content', 'seo', 'paid_ads', 'strategy', 'email', 'growth',
  'brand', 'competitor', 'website', 'compliance',
  'analytics', 'automation', 'video',
]

export type OutputType =
  | 'social_post'
  | 'blog_article'
  | 'ad_copy'
  | 'email_sequence'
  | 'landing_page'
  | 'seo_audit'
  | 'strategy_doc'
  | 'competitor_report'
  | 'compliance_check'
  | 'brand_guide'
  | 'analytics_report'
  | 'automation_workflow'
  | 'video_script'
  | 'video'
  | 'scheduled_post'
  | 'other'

export interface ToneOfVoice {
  formality: 'casual' | 'conversational' | 'professional' | 'formal'
  humour: 'none' | 'light' | 'moderate' | 'heavy'
  keywords: string[]
  avoid_words: string[]
}

export interface TargetAudience {
  demographics: string
  pain_points: string[]
  desires: string[]
}

export type ContentType = 'entertainment' | 'education' | 'inspiration' | 'promotional'

export type CompetitorCategory = 'direct' | 'adjacent' | 'aspirational' | 'indirect'

export interface Competitor {
  name: string
  url: string
  notes: string
  category?: CompetitorCategory
  why?: string            // WHY they're a competitor — injected into agent prompts
  watch_pages?: string[]  // specific pages to monitor: ['/pricing', '/blog']
  keywords?: string[]     // alert keywords for change detection
  is_active?: boolean
  last_snapshot_hash?: string
  last_checked_at?: string
}

export interface ComplianceFlags {
  ahpra: boolean
  tga: boolean
  tga_categories: string[]
}

export interface ProductService {
  name: string
  description: string
  price?: string
  target_audience?: string
  usps?: string[]
  compliance_notes?: string
}

export interface VideoPreferences {
  avatar_id?: string
  accent?: string
  presenter_style?: string
  background_preference?: string
}

export interface Brand {
  id: string
  user_id: string
  name: string
  slug: string
  tagline: string | null
  description: string | null
  website_url: string | null
  github_url: string | null
  logo_url: string | null
  business_stage: 'idea' | 'mvp' | 'launch' | 'growth' | 'scale' | 'mature'
  social_urls: Record<string, string>
  niche: string
  tone_of_voice: ToneOfVoice
  target_audience: TargetAudience
  competitors: Competitor[]
  compliance_flags: ComplianceFlags
  brand_colours: Record<string, string>
  content_pillars: string[]
  extra_context: string | null
  products_services: ProductService[]
  video_preferences: VideoPreferences
  github_context: string | null
  brand_dna_constraints: BrandDNAConstraints
  emulation_wishlist: EmulationEntry[]
  channel_strategy: ChannelStrategy
  post_signature: PostSignature
  marketing_status: 'unknown' | 'no_marketing' | 'early_stage' | 'needs_strategy' | 'active' | 'scaling'
  marketing_notes: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface ProjectScan {
  id: string
  brand_id: string
  user_id: string
  scan_type: 'github' | 'website' | 'social' | 'marketing_audit'
  status: 'pending' | 'running' | 'completed' | 'failed'
  results: Record<string, unknown>
  error: string | null
  created_at: string
  updated_at: string
}

export interface Conversation {
  id: string
  user_id: string
  brand_id: string
  agent_type: AgentType
  title: string | null
  is_archived: boolean
  created_at: string
  updated_at: string
}

export interface Message {
  id: string
  conversation_id: string
  role: 'user' | 'assistant' | 'system' | 'tool'
  content: string
  tool_calls: Record<string, unknown> | null
  tool_results: Record<string, unknown> | null
  tokens_input: number
  tokens_output: number
  model: string | null
  created_at: string
}

export interface Output {
  id: string
  user_id: string
  brand_id: string
  conversation_id: string | null
  message_id: string | null
  output_type: OutputType
  title: string
  content: string
  metadata: Record<string, unknown>
  content_type?: 'entertainment' | 'education' | 'inspiration' | 'promotional' | null
  content_pillar?: string | null
  is_approved: boolean
  created_at: string
  updated_at: string
}

export interface AgentConfig {
  id: string
  agent_type: AgentType
  display_name: string
  description: string
  icon: string
  system_prompt: string
  available_tools: string[]
  is_active: boolean
  created_at: string
  updated_at: string
}

export const AGENT_LABELS: Record<AgentType, string> = {
  overall: 'NRS Director',
  content: 'Write Content',
  seo: 'Get Found Online',
  paid_ads: 'Run Ads',
  strategy: 'Plan & Launch',
  email: 'Send Emails',
  growth: 'Find Partners',
  brand: 'Build My Brand',
  competitor: 'Watch Competitors',
  website: 'Improve My Website',
  compliance: 'Check Compliance',
  analytics: 'Track Results',
  automation: 'Automate My Work',
  video: 'Make Videos',
  // Archived
  martech: 'Connect My Tools',
}

/** Professional subtitle for each agent — shown as tooltip/secondary text */
export const AGENT_SUBTITLES: Record<AgentType, string> = {
  overall: 'Oversees all departments',
  content: 'Content & copy creation',
  seo: 'SEO & GEO strategy',
  paid_ads: 'Paid advertising campaigns',
  strategy: 'Strategy & launch planning',
  email: 'Email marketing & sequences',
  growth: 'Growth & partnership development',
  brand: 'Brand identity & guidelines',
  competitor: 'Market intelligence & analysis',
  website: 'Web optimisation & CRO',
  compliance: 'AHPRA, TGA & regulatory',
  analytics: 'Analytics & performance reporting',
  automation: 'Workflow automation & AI tools',
  video: 'Video scripting & production',
  martech: 'Marketing technology integrations',
}

export const OUTPUT_LABELS: Record<OutputType, string> = {
  social_post: 'Social Post',
  blog_article: 'Blog Article',
  ad_copy: 'Ad Copy',
  email_sequence: 'Email Sequence',
  landing_page: 'Landing Page',
  seo_audit: 'SEO Audit',
  strategy_doc: 'Strategy Document',
  competitor_report: 'Market Intelligence Report',
  compliance_check: 'Compliance Check',
  brand_guide: 'Brand Guide',
  analytics_report: 'Analytics Report',
  automation_workflow: 'Automation Workflow',
  video_script: 'Video Script',
  video: 'Video',
  scheduled_post: 'Scheduled Post',
  other: 'Other',
}

// ---------------------------------------------------------------------------
// Agentic Management types (Paperclip patterns)
// ---------------------------------------------------------------------------

export type AgentRole = 'director' | 'head' | 'worker'
export type AgentStatus = 'idle' | 'working' | 'paused' | 'terminated'
export type TaskStatus = 'backlog' | 'assigned' | 'in_progress' | 'review' | 'done' | 'blocked' | 'cancelled'
export type GoalStatus = 'planned' | 'active' | 'completed' | 'paused' | 'cancelled'
export type ApprovalStatus = 'pending' | 'approved' | 'rejected'
export type HeartbeatSource = 'cron' | 'event' | 'manual'
export type TaskPriority = 'critical' | 'high' | 'medium' | 'low'
export interface BrandDNAConstraints {
  voice_rules?: string[]           // deterministic rules, not adjectives
  banned_words?: string[]          // words the brand never uses
  founder_voice?: {
    name: string
    platforms: string[]            // where founder voice is used
    framing: 'first_person' | 'third_person'
  }
  content_philosophy?: 'storytelling_first' | 'product_first' | 'educational_first' | 'community_first'
  never_do?: string[]              // hard constraints: "before_after_images", "testimonials_in_ads", etc.
  narrative_world?: string         // the brand's story universe
}

export interface EmulationEntry {
  brand: string
  why: string
}

export interface InspirationEntry {
  id: string
  user_id: string
  brand_name: string
  industry: string
  platform: string | null
  format: string | null
  what_they_did: string
  why_it_works: string
  transferable_principle: string
  applicability_tags: string[]
  source_url: string | null
  observed_at: string
  performance_notes: string | null
  created_at: string
  updated_at: string
}

export interface ChannelStrategy {
  channels?: Record<string, number>      // platform → percentage (must sum to 100)
  content_mix?: Record<string, number>   // content type → percentage
  posting_frequency?: 'daily' | '3x_week' | '2x_week' | 'weekly' | 'custom'
  avoid?: string[]                       // things to skip: "email_campaigns", "google_ads", etc.
  growth_approach?: 'organic' | 'paid' | 'hybrid' | 'community'
  aeo_priority?: boolean                 // prioritise AI engine visibility
  notes?: string                         // freeform strategy notes
}

export interface PostSignature {
  enabled?: boolean
  text?: string           // "Developed by Not Real (Artificial) Smart (Intelligence) - Agentic Marketing Agency"
  format?: 'text' | 'mention' | 'hashtag'
  mention?: string        // "@notrealsmart"
  hashtag?: string        // "#NotRealSmart"
  banner_url?: string     // URL to banner image
}

export type TeamRole = 'owner' | 'admin' | 'viewer'
export type InviteStatus = 'pending' | 'accepted' | 'revoked'

export interface TeamMember {
  id: string
  owner_id: string
  member_email: string
  member_id: string | null
  role: TeamRole
  brand_ids: string[] | null
  invite_token: string | null
  status: InviteStatus
  invited_at: string
  accepted_at: string | null
  created_at: string
  updated_at: string
}

export type GoalLevel = 'objective' | 'key_result' | 'task'

export interface AgentRegistryEntry {
  id: string
  user_id: string
  agent_type: AgentType
  role: AgentRole
  department: string | null
  reports_to: string | null
  model: string
  status: AgentStatus
  is_active: boolean
  budget_monthly_cents: number
  spent_monthly_cents: number
  last_heartbeat_at: string | null
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface Goal {
  id: string
  user_id: string
  parent_id: string | null
  title: string
  description: string | null
  level: GoalLevel
  status: GoalStatus
  owner_agent_id: string | null
  brand_id: string | null
  deadline: string | null
  created_at: string
  updated_at: string
}

export interface Task {
  id: string
  user_id: string
  goal_id: string | null
  parent_id: string | null
  brand_id: string | null
  assigned_agent_id: string | null
  created_by_agent_id: string | null
  title: string
  description: string | null
  context: Record<string, unknown>
  status: TaskStatus
  priority: TaskPriority
  result: Record<string, unknown> | null
  tokens_used: number
  cost_cents: number
  started_at: string | null
  completed_at: string | null
  created_at: string
  updated_at: string
}

export interface AuditLogEntry {
  id: string
  user_id: string
  agent_id: string | null
  task_id: string | null
  action: string
  entity_type: string
  entity_id: string | null
  detail: Record<string, unknown>
  cost_cents: number
  created_at: string
}

export interface ApprovalQueueEntry {
  id: string
  user_id: string
  agent_id: string | null
  task_id: string | null
  action_type: string
  payload: Record<string, unknown>
  status: ApprovalStatus
  decision_note: string | null
  reviewed_at: string | null
  created_at: string
  updated_at: string
}

export type MediaStatus = 'pending' | 'transcribing' | 'transcribed' | 'failed'
export type PostPlatform = 'instagram' | 'facebook' | 'linkedin' | 'twitter' | 'tiktok' | 'youtube'
export type ScheduledPostStatus = 'draft' | 'scheduled' | 'publishing' | 'published' | 'failed' | 'cancelled'

export interface MediaItem {
  id: string
  user_id: string
  brand_id: string
  file_url: string
  file_name: string
  file_type: string
  file_size_bytes: number | null
  duration_seconds: number | null
  thumbnail_url: string | null
  transcription: string | null
  transcription_model: string | null
  transcription_status: MediaStatus
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface VisualAnalysis {
  scenes: string[]
  products: string[]
  textOnScreen: string[]
  mood: string
  thumbnailFrameIndex: number
  summary: string
}

export interface ScheduledPost {
  id: string
  user_id: string
  brand_id: string
  media_item_id: string | null
  output_id: string | null
  platform: PostPlatform
  caption: string
  hashtags: string[]
  scheduled_at: string
  published_at: string | null
  status: ScheduledPostStatus
  external_post_id: string | null
  error: string | null
  metadata: Record<string, unknown>
  content_type?: 'entertainment' | 'education' | 'inspiration' | 'promotional' | null
  content_pillar?: string | null
  created_at: string
  updated_at: string
}

export interface Heartbeat {
  id: string
  user_id: string
  agent_id: string | null
  triggered_by: HeartbeatSource
  status: 'queued' | 'running' | 'succeeded' | 'failed'
  tasks_checked: number
  tasks_actioned: number
  duration_ms: number | null
  error: string | null
  context_snapshot: Record<string, unknown> | null
  started_at: string | null
  finished_at: string | null
  created_at: string
}

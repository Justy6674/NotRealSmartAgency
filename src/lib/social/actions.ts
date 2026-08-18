import type {
  PlatformOptionsMap,
  SocialContentType,
  SocialCoverSource,
  SocialMediaRef,
  SocialPlatform,
  SocialSchedule,
  SocialTarget,
} from './model'

export type SocialDeskAction =
  | { type: 'set_master_caption'; caption: string }
  | { type: 'set_platforms'; platforms: SocialPlatform[] }
  | { type: 'restore_targets'; targets: SocialTarget[] }
  | { type: 'set_platform_caption'; targetId: string; caption: string | null }
  | { type: 'choose_accounts'; targetId: string; accountIds: string[] }
  | { type: 'set_platform_title'; targetId: string; title: string | null }
  | { type: 'set_first_comment'; targetId: string; firstComment: string | null }
  | { type: 'set_cover'; targetId: string; source: SocialCoverSource | null }
  | { type: 'add_media'; mediaItemId: string; at?: number }
  | { type: 'remove_media'; mediaItemId: string }
  | { type: 'restore_media'; media: SocialMediaRef[] }
  | { type: 'reorder_media'; mediaItemIds: string[] }
  | { type: 'set_content_type'; contentType: SocialContentType }
  | { type: 'set_hashtags'; hashtags: string[] }
  | { type: 'set_platform_options'; targetId: string; patch: PlatformOptionsMap }
  | { type: 'replace_platform_options'; targetId: string; options: PlatformOptionsMap }
  | { type: 'set_schedule'; schedule: SocialSchedule }
  | { type: 'save_draft' }
  | { type: 'schedule_post' }
  | { type: 'request_publish' }
  | { type: 'confirm_publish'; confirmationToken: string }
  | { type: 'undo'; commandId: string }

export interface SocialDeskCommand {
  commandId: string
  compositionId: string
  brandId: string
  expectedRevision: number
  source: 'manual' | 'director'
  actorUserId: string
  action: SocialDeskAction
  createdAt: string
}

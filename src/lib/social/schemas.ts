import { z } from 'zod/v3'
import { SOCIAL_CONTENT_TYPES, SOCIAL_PLATFORMS } from './model'

export const SocialPlatformSchema = z.enum(SOCIAL_PLATFORMS)
export const SocialContentTypeSchema = z.enum(SOCIAL_CONTENT_TYPES)

export const SocialMediaRefSchema = z.object({
  mediaItemId: z.string().uuid(),
  position: z.number().int().nonnegative(),
  type: z.enum(['image', 'video', 'gif', 'document']),
  title: z.string().max(500).optional(),
  altText: z.string().max(2_000).optional(),
  thumbnailUrl: z.string().url().optional(),
}).strict()

export const SocialCoverSourceSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('media'), mediaItemId: z.string().uuid() }).strict(),
  z.object({ kind: z.literal('url'), url: z.string().url().refine((url) => url.startsWith('https://'), 'HTTPS required') }).strict(),
  z.object({ kind: z.literal('frame'), offsetMs: z.number().int().nonnegative() }).strict(),
])

const InstagramOptionPatchSchema = z.object({
  shareToFeed: z.boolean().optional(),
  collaborators: z.array(z.string().trim().min(1).max(100)).max(3).optional(),
  userTags: z.array(z.object({
    username: z.string().trim().min(1).max(100),
    x: z.number().min(0).max(1).optional(),
    y: z.number().min(0).max(1).optional(),
  }).strict()).max(20).optional(),
  isAiGenerated: z.boolean().optional(),
  contentType: z.literal('story').optional(),
}).strict()

const FacebookOptionPatchSchema = z.object({
  contentType: z.enum(['story', 'reel']).optional(),
  title: z.string().trim().max(255).optional(),
}).strict()

const TikTokOptionPatchSchema = z.object({
  privacyLevel: z.enum(['PUBLIC_TO_EVERYONE', 'MUTUAL_FOLLOW_FRIENDS', 'SELF_ONLY']).optional(),
  allowComment: z.boolean().optional(),
  allowDuet: z.boolean().optional(),
  allowStitch: z.boolean().optional(),
  commercialContentType: z.enum(['none', 'brand_organic', 'brand_content']).optional(),
  expressConsentGiven: z.boolean().optional(),
  autoAddMusic: z.boolean().optional(),
  videoMadeWithAi: z.boolean().optional(),
  draft: z.boolean().optional(),
}).strict()

const YouTubeOptionPatchSchema = z.object({
  visibility: z.enum(['public', 'unlisted', 'private']).optional(),
  madeForKids: z.boolean().optional(),
  containsSyntheticMedia: z.boolean().optional(),
  categoryId: z.string().trim().min(1).max(20).optional(),
  playlistId: z.string().trim().min(1).max(200).optional(),
}).strict()

const LinkedInOptionPatchSchema = z.object({
  documentTitle: z.string().trim().min(1).max(400).optional(),
  organizationUrn: z.string().trim().min(1).max(200).optional(),
  disableLinkPreview: z.boolean().optional(),
}).strict()

const TwitterOptionPatchSchema = z.object({
  replySettings: z.enum(['following', 'mentionedUsers', 'subscribers', 'verified']).optional(),
  paidPartnership: z.boolean().optional(),
  madeWithAi: z.boolean().optional(),
  longVideo: z.boolean().optional(),
}).strict()

export const PlatformOptionPatchSchema = z.union([
  InstagramOptionPatchSchema,
  FacebookOptionPatchSchema,
  TikTokOptionPatchSchema,
  YouTubeOptionPatchSchema,
  LinkedInOptionPatchSchema,
  TwitterOptionPatchSchema,
])

export const SocialScheduleSchema = z.object({
  mode: z.enum(['draft', 'next_slot', 'at', 'now']),
  scheduledAt: z.string().datetime({ offset: true }).optional(),
  timezone: z.string().trim().min(1).max(100),
}).strict().superRefine((schedule, ctx) => {
  if (schedule.mode === 'at' && !schedule.scheduledAt) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['scheduledAt'], message: 'A chosen time is required' })
  }
  if (schedule.mode !== 'at' && schedule.scheduledAt) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['scheduledAt'], message: 'Only an exact-time schedule may include scheduledAt' })
  }
})

const SocialTargetSchema = z.object({
  targetId: z.string().min(1).max(200),
  platform: SocialPlatformSchema,
  accountIds: z.array(z.string().min(1).max(300)).max(50),
  captionOverride: z.string().max(100_000).optional(),
  title: z.string().max(2_200).optional(),
  firstComment: z.string().max(10_000).optional(),
  cover: SocialCoverSourceSchema.optional(),
  mediaOverride: z.array(SocialMediaRefSchema).max(35).optional(),
  options: z.record(z.unknown()),
}).strict()

export const SocialDeskActionSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('set_master_caption'), caption: z.string().max(100_000) }).strict(),
  z.object({ type: z.literal('set_platforms'), platforms: z.array(SocialPlatformSchema).max(SOCIAL_PLATFORMS.length) }).strict(),
  z.object({ type: z.literal('restore_targets'), targets: z.array(SocialTargetSchema).max(SOCIAL_PLATFORMS.length) }).strict(),
  z.object({ type: z.literal('set_platform_caption'), targetId: z.string().min(1).max(200), caption: z.string().max(100_000).nullable() }).strict(),
  z.object({ type: z.literal('choose_accounts'), targetId: z.string().min(1).max(200), accountIds: z.array(z.string().min(1).max(300)).max(50) }).strict(),
  z.object({ type: z.literal('set_platform_title'), targetId: z.string().min(1).max(200), title: z.string().max(2_200).nullable() }).strict(),
  z.object({ type: z.literal('set_first_comment'), targetId: z.string().min(1).max(200), firstComment: z.string().max(10_000).nullable() }).strict(),
  z.object({ type: z.literal('set_cover'), targetId: z.string().min(1).max(200), source: SocialCoverSourceSchema.nullable() }).strict(),
  z.object({ type: z.literal('add_media'), mediaItemId: z.string().uuid(), at: z.number().int().nonnegative().optional() }).strict(),
  z.object({ type: z.literal('remove_media'), mediaItemId: z.string().uuid() }).strict(),
  z.object({ type: z.literal('restore_media'), media: z.array(SocialMediaRefSchema).max(35) }).strict(),
  z.object({ type: z.literal('reorder_media'), mediaItemIds: z.array(z.string().uuid()).max(35) }).strict(),
  z.object({ type: z.literal('set_content_type'), contentType: SocialContentTypeSchema }).strict(),
  z.object({ type: z.literal('set_hashtags'), hashtags: z.array(z.string().trim().min(1).max(200)).max(100) }).strict(),
  z.object({ type: z.literal('set_platform_options'), targetId: z.string().min(1).max(200), patch: PlatformOptionPatchSchema }).strict(),
  z.object({ type: z.literal('replace_platform_options'), targetId: z.string().min(1).max(200), options: z.record(z.unknown()) }).strict(),
  z.object({ type: z.literal('set_schedule'), schedule: SocialScheduleSchema }).strict(),
  z.object({ type: z.literal('save_draft') }).strict(),
  z.object({ type: z.literal('schedule_post') }).strict(),
  z.object({ type: z.literal('request_publish') }).strict(),
  z.object({ type: z.literal('confirm_publish'), confirmationToken: z.string().min(32).max(500) }).strict(),
  z.object({ type: z.literal('undo'), commandId: z.string().uuid() }).strict(),
])

export const SocialDeskCommandSchema = z.object({
  commandId: z.string().uuid(),
  compositionId: z.string().uuid(),
  brandId: z.string().uuid(),
  expectedRevision: z.number().int().nonnegative(),
  source: z.enum(['manual', 'director']),
  actorUserId: z.string().uuid(),
  action: SocialDeskActionSchema,
  createdAt: z.string().datetime({ offset: true }),
}).strict()

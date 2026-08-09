import type { SupabaseClient } from '@supabase/supabase-js'
import type { PostPlatform } from '@/types/database'

const PLATFORM_NAMES: ReadonlyArray<readonly [RegExp, PostPlatform]> = [
  [/\btik\s*tok\b/i, 'tiktok'],
  [/\bfacebook\b/i, 'facebook'],
  [/\blinkedin\b/i, 'linkedin'],
  [/\b(?:x|twitter)\b/i, 'twitter'],
  [/\byoutube\b/i, 'youtube'],
  [/\bthreads\b/i, 'threads'],
  [/\bpinterest\b/i, 'pinterest'],
]

const HASHTAG_LINE = /(?:^|\n)\s*((?:#[\p{L}\d_]+(?:\s+|$))+)[\s\n]*$/u

/**
 * The Telegram caption contract puts hashtags on one trailing line. Keep the
 * owner-facing caption byte-for-byte intact while storing those tags in the
 * field Mixpost and the review UI actually understand.
 */
export function splitTelegramSocialCopy(text: string): { caption: string; hashtags: string[] } {
  const match = text.match(HASHTAG_LINE)
  if (!match?.[1]) return { caption: text.trim(), hashtags: [] }

  return {
    caption: text.slice(0, match.index).trim(),
    hashtags: match[1].match(/#[\p{L}\d_]+/gu)?.map((tag) => tag.slice(1)) ?? [],
  }
}

/** Prefer the surface the owner named; Instagram is the safe social fallback. */
export function telegramCaptionPlatform(message: string): PostPlatform {
  return PLATFORM_NAMES.find(([pattern]) => pattern.test(message))?.[1] ?? 'instagram'
}

/**
 * A caption generated for Telegram is a reviewable piece of work, not merely
 * a transient chat bubble. The job id makes the write replay-safe when a job
 * continuation is retried after the model has already answered.
 */
export async function storeTelegramSocialProposal({
  supabase,
  userId,
  brandId,
  jobId,
  ownerMessage,
  response,
  mediaItemIds = [],
}: {
  supabase: SupabaseClient
  userId: string
  brandId: string
  jobId: string
  ownerMessage: string
  response: string
  mediaItemIds?: string[]
}): Promise<string | null> {
  const { caption, hashtags } = splitTelegramSocialCopy(response)
  if (!caption) return null

  const { data: existing } = await supabase
    .from('outputs')
    .select('id')
    .eq('user_id', userId)
    .eq('brand_id', brandId)
    .eq('output_type', 'social_post')
    .contains('metadata', { telegram_job_id: jobId })
    .maybeSingle()
  if (existing?.id) return existing.id as string

  const platform = telegramCaptionPlatform(ownerMessage)
  const title = `${platform === 'tiktok' ? 'TikTok' : platform[0].toUpperCase() + platform.slice(1)} caption ready to review`
  const { data, error } = await supabase
    .from('outputs')
    .insert({
      user_id: userId,
      brand_id: brandId,
      output_type: 'social_post',
      title,
      content: caption,
      is_approved: false,
      metadata: {
        source: 'telegram_mini_app',
        delivery_source: 'telegram_mini_app',
        telegram_job_id: jobId,
        stage: 'proposal',
        post_type: 'single',
        platform,
        hashtags,
        media_item_ids: mediaItemIds,
      },
    })
    .select('id')
    .single()

  if (error || !data?.id) return null
  return data.id as string
}

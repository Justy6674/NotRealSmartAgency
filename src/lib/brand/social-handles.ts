/**
 * The brand's accounts, as handles rather than URLs.
 *
 * Two problems this exists to fix.
 *
 * The handle is NOT the same on every platform. Scent Sell is @scentsellsocials
 * on Instagram, @scentsell on TikTok and @ScentSellAustralia on Facebook and
 * YouTube. A model handed a list of URLs will confidently pick one and tag the
 * same name everywhere — which on three platforms out of four is either a
 * stranger's account or nobody's.
 *
 * And `social_urls` is not only social URLs. It has accumulated internal
 * bookkeeping — Mixpost account ids — and dead accounts kept for reference,
 * and all of it was being printed into the prompt as though it were an account
 * to tag. `instagram_legacy` was one edit away from being tagged in a caption.
 */

/** Never shown to the model: bookkeeping, not an account anyone can tag. */
const INTERNAL_KEYS = new Set(['mixpost_account_ids', 'mixpost_tag_id', 'mixpost_tag_uuid'])

/** Kept in the record for reference, but not an account to post to or tag. */
function isRetired(key: string): boolean {
  return /_(legacy|old|archived|inactive)$/.test(key)
}

const PLATFORM_LABELS: Record<string, string> = {
  instagram: 'Instagram',
  tiktok: 'TikTok',
  facebook: 'Facebook',
  youtube: 'YouTube',
  linkedin: 'LinkedIn',
  x: 'X',
  twitter: 'X',
  threads: 'Threads',
  pinterest: 'Pinterest',
}

export interface SocialHandle {
  platform: string
  label: string
  handle: string
  url: string
}

/**
 * Pull the handle out of a profile URL.
 *
 * Returns null rather than a guess. A wrong handle in a caption tags a
 * stranger, so no handle is strictly better than an invented one.
 */
export function handleFromUrl(url: string): string | null {
  let path: string
  try {
    path = new URL(url).pathname
  } catch {
    return null
  }

  const segments = path.split('/').filter(Boolean)
  if (segments.length === 0) return null

  // TikTok and YouTube already carry the @; Instagram and Facebook do not.
  // Company and channel pages are a path shape we cannot reduce to a handle.
  const last = segments[segments.length - 1]
  if (/^(channel|c|company|pages|profile\.php)$/.test(last)) return null
  if (segments.length > 1 && /^(channel|c|company|pages)$/.test(segments[0])) return null

  const bare = last.replace(/^@/, '')
  if (!bare || !/^[A-Za-z0-9._-]+$/.test(bare)) return null
  return `@${bare}`
}

/**
 * The accounts worth telling the model about, in a stable order.
 *
 * Sorted so the same brand produces the same prompt every time — an unstable
 * prompt makes every other difference in output impossible to attribute.
 */
export function socialHandles(socialUrls: Record<string, string> | null | undefined): SocialHandle[] {
  if (!socialUrls) return []

  const handles: SocialHandle[] = []
  for (const [key, value] of Object.entries(socialUrls)) {
    if (!value || typeof value !== 'string') continue
    if (INTERNAL_KEYS.has(key) || isRetired(key)) continue
    if (!/^https?:\/\//.test(value)) continue

    const handle = handleFromUrl(value)
    if (!handle) continue

    handles.push({
      platform: key,
      label: PLATFORM_LABELS[key] ?? key.replace(/_/g, ' '),
      handle,
      url: value,
    })
  }

  return handles.sort((a, b) => (a.platform < b.platform ? -1 : a.platform > b.platform ? 1 : 0))
}

/**
 * The accounts as a block of prompt text.
 *
 * Says outright that the handles differ, because the failure this prevents is
 * a model reasonably assuming they do not.
 */
export function socialHandlesPrompt(socialUrls: Record<string, string> | null | undefined): string | null {
  const handles = socialHandles(socialUrls)
  if (handles.length === 0) return null

  const lines = handles.map((h) => `- ${h.label}: ${h.handle} (${h.url})`)
  const distinct = new Set(handles.map((h) => h.handle.toLowerCase())).size > 1

  return [
    '**Our own accounts — use the handle for the platform being posted to:**',
    ...lines,
    distinct
      ? 'These handles are NOT the same across platforms. Never reuse one platform\'s handle on'
        + ' another, and never invent one: an @ that is wrong tags a stranger.'
      : 'Never invent a handle: an @ that is wrong tags a stranger.',
  ].join('\n')
}

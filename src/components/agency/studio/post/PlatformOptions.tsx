'use client'

import {
  composerFieldStatusForTransport,
  type FieldStatus,
} from '@/lib/publishers/zernio-platform-data'
import { FIRST_COMMENT_PLATFORMS } from '@/lib/social/capabilities'
import type { ZernioTikTokCreatorInfo } from '@/lib/zernio/accounts'

/**
 * Per-platform settings the owner can actually send.
 *
 * A switch we cannot deliver is shown as off, with the reason in plain English.
 * Silent no-ops are how this panel used to lie.
 */

interface PlatformOptionsProps {
  platform: string
  options: Record<string, unknown>
  onChange: (options: Record<string, unknown>) => void
  transport?: 'zernio' | 'mixpost'
  /**
   * What THIS TikTok account is allowed to do. TikTok's own pre-flight, and
   * required: the privacy levels a creator may pick, and whether comments,
   * duet and stitch exist for them at all, differ per account. Null means it
   * was not asked (not a TikTok account, or the check did not answer) — and an
   * unasked permission is shown as unavailable, never as allowed.
   */
  tiktokCreatorInfo?: ZernioTikTokCreatorInfo | null
}

function OptionLabel({ children }: { children: React.ReactNode }) {
  return <label className="block text-[11px] font-medium text-muted-foreground mb-1">{children}</label>
}

function OptionNote({ children }: { children: React.ReactNode }) {
  return <p className="text-[11px] leading-snug text-muted-foreground">{children}</p>
}

function OptionInput({
  label,
  value,
  onChange,
  placeholder,
  status,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  status?: FieldStatus | null
}) {
  if (status && !status.ships) {
    return (
      <div>
        <OptionLabel>{label}</OptionLabel>
        <OptionNote>{status.reason}</OptionNote>
      </div>
    )
  }
  return (
    <div>
      <OptionLabel>{label}</OptionLabel>
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-xs outline-none focus:ring-1 focus:ring-ring"
      />
    </div>
  )
}

function OptionTextarea({
  label,
  value,
  onChange,
  placeholder,
  rows = 2,
  status,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  rows?: number
  status?: FieldStatus | null
}) {
  if (status && !status.ships) {
    return (
      <div>
        <OptionLabel>{label}</OptionLabel>
        <OptionNote>{status.reason}</OptionNote>
      </div>
    )
  }
  return (
    <div>
      <OptionLabel>{label}</OptionLabel>
      <textarea
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        className="w-full resize-none rounded-md border border-border bg-background px-2.5 py-1.5 text-xs outline-none focus:ring-1 focus:ring-ring"
      />
    </div>
  )
}

function OptionSelect({
  label,
  value,
  onChange,
  options,
  status,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string }[]
  status?: FieldStatus | null
}) {
  if (status && !status.ships) {
    return (
      <div>
        <OptionLabel>{label}</OptionLabel>
        <OptionNote>{status.reason}</OptionNote>
      </div>
    )
  }
  return (
    <div>
      <OptionLabel>{label}</OptionLabel>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-xs outline-none focus:ring-1 focus:ring-ring"
      >
        {options.map(o => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  )
}

function OptionCheckbox({
  label,
  checked,
  onChange,
  status,
}: {
  label: string
  checked: boolean
  onChange: (v: boolean) => void
  status?: FieldStatus | null
}) {
  if (status && !status.ships) {
    return (
      <div>
        <OptionLabel>{label}</OptionLabel>
        <OptionNote>{status.reason}</OptionNote>
      </div>
    )
  }
  return (
    <label className="flex items-center gap-2 cursor-pointer">
      <input
        type="checkbox"
        checked={checked}
        onChange={e => onChange(e.target.checked)}
        className="h-3.5 w-3.5 rounded border-border accent-primary"
      />
      <span className="text-xs text-foreground/80">{label}</span>
    </label>
  )
}

const YOUTUBE_CATEGORIES = [
  { value: '1', label: 'Film & Animation' },
  { value: '2', label: 'Cars & Vehicles' },
  { value: '10', label: 'Music' },
  { value: '15', label: 'Pets & Animals' },
  { value: '17', label: 'Sport' },
  { value: '19', label: 'Travel & Events' },
  { value: '20', label: 'Gaming' },
  { value: '22', label: 'People & Blogs' },
  { value: '23', label: 'Comedy' },
  { value: '24', label: 'Entertainment' },
  { value: '25', label: 'News & Politics' },
  { value: '26', label: 'How-to & Style' },
  { value: '27', label: 'Education' },
  { value: '28', label: 'Science & Technology' },
  { value: '29', label: 'Non-profits & Activism' },
  { value: '30', label: 'Movies' },
  { value: '31', label: 'Anime/Animation' },
  { value: '32', label: 'Action/Adventure' },
  { value: '33', label: 'Classics' },
  { value: '35', label: 'Documentary' },
  { value: '36', label: 'Drama' },
  { value: '37', label: 'Family' },
]

function set(opts: Record<string, unknown>, key: string, val: unknown, onChange: (o: Record<string, unknown>) => void) {
  onChange({ ...opts, [key]: val })
}

/** A comma-separated box, stored as the list the publisher actually takes. */
function OptionList({
  label,
  value,
  onChange,
  placeholder,
  status,
}: {
  label: string
  value: unknown
  onChange: (v: string[]) => void
  placeholder?: string
  status?: FieldStatus | null
}) {
  const text = Array.isArray(value) ? value.join(', ') : typeof value === 'string' ? value : ''
  if (status && !status.ships) {
    return (
      <div>
        <OptionLabel>{label}</OptionLabel>
        <OptionNote>{status.reason}</OptionNote>
      </div>
    )
  }
  return (
    <div>
      <OptionLabel>{label}</OptionLabel>
      <input
        type="text"
        value={text}
        onChange={e =>
          onChange(
            e.target.value
              .split(',')
              .map(entry => entry.trim())
              .filter(entry => entry !== ''),
          )
        }
        placeholder={placeholder}
        className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-xs outline-none focus:ring-1 focus:ring-ring"
      />
    </div>
  )
}

/**
 * TikTok's per-account pre-flight, turned into a field status.
 *
 * NRS showed every TikTok switch unconditionally, so an owner could set a
 * privacy level or a duet permission this creator does not have and only find
 * out hours later when the publish failed. `commentDisabled` and friends are
 * read as "unavailable unless explicitly false" — the safe reading of an
 * unstated permission on a live platform is that it is not available.
 */
function tiktokAccountStatus(
  key: 'privacy' | 'allow_comments' | 'allow_duet' | 'allow_stitch',
  info: ZernioTikTokCreatorInfo | null | undefined,
): FieldStatus | null {
  if (!info) return null
  if (key === 'privacy') {
    return info.privacyLevelOptions.length > 0
      ? null
      : { ships: false, reason: 'TikTok has not offered any privacy choices for this account.' }
  }
  const disabled =
    key === 'allow_comments' ? info.commentDisabled
      : key === 'allow_duet' ? info.duetDisabled
      : info.stitchDisabled
  if (!disabled) return null
  const what = key === 'allow_comments' ? 'Comments' : key === 'allow_duet' ? 'Duet' : 'Stitch'
  return { ships: false, reason: `${what} is switched off for this TikTok account, so this cannot be set here.` }
}

/** TikTok's own privacy names, turned into words the owner recognises. */
const TIKTOK_PRIVACY_LABELS: Record<string, string> = {
  PUBLIC_TO_EVERYONE: 'Public',
  MUTUAL_FOLLOW_FRIENDS: 'Friends',
  FOLLOWER_OF_CREATOR: 'Followers',
  SELF_ONLY: 'Only me',
}

const TIKTOK_PRIVACY_COMPOSER: Record<string, string> = {
  PUBLIC_TO_EVERYONE: 'public',
  MUTUAL_FOLLOW_FRIENDS: 'friends',
  SELF_ONLY: 'private',
}

function fieldStatus(
  platform: string,
  key: string,
  transport: 'zernio' | 'mixpost',
): FieldStatus | null {
  return composerFieldStatusForTransport(platform, key, transport)
}

function TikTokOptions({
  options: o,
  onChange,
  transport,
  tiktokCreatorInfo,
}: {
  options: Record<string, unknown>
  onChange: (o: Record<string, unknown>) => void
  transport: 'zernio' | 'mixpost'
  tiktokCreatorInfo?: ZernioTikTokCreatorInfo | null
}) {
  const allowed = tiktokCreatorInfo?.privacyLevelOptions ?? []
  const privacyChoices = allowed.length > 0
    ? allowed.flatMap((level) => {
        const value = TIKTOK_PRIVACY_COMPOSER[level]
        return value ? [{ value, label: TIKTOK_PRIVACY_LABELS[level] ?? level }] : []
      })
    : [
        { value: 'public', label: 'Public' },
        { value: 'friends', label: 'Friends' },
        { value: 'private', label: 'Only me' },
      ]

  return (
    <div className="space-y-2.5">
      <OptionInput
        label="Title"
        value={(o.title as string) ?? ''}
        onChange={v => set(o, 'title', v, onChange)}
        placeholder="Optional TikTok title"
        status={fieldStatus('tiktok', 'title', transport)}
      />
      <OptionSelect
        label="Privacy"
        value={(o.privacy as string) ?? privacyChoices[0]?.value ?? 'public'}
        onChange={v => set(o, 'privacy', v, onChange)}
        options={privacyChoices}
        status={
          tiktokAccountStatus('privacy', tiktokCreatorInfo)
          ?? fieldStatus('tiktok', 'privacy', transport)
        }
      />
      <div className="space-y-1.5">
        <OptionCheckbox label="Allow comments" checked={(o.allow_comments as boolean) ?? true} onChange={v => set(o, 'allow_comments', v, onChange)} status={tiktokAccountStatus('allow_comments', tiktokCreatorInfo) ?? fieldStatus('tiktok', 'allow_comments', transport)} />
        <OptionCheckbox label="Allow duet" checked={(o.allow_duet as boolean) ?? true} onChange={v => set(o, 'allow_duet', v, onChange)} status={tiktokAccountStatus('allow_duet', tiktokCreatorInfo) ?? fieldStatus('tiktok', 'allow_duet', transport)} />
        <OptionCheckbox label="Allow stitch" checked={(o.allow_stitch as boolean) ?? true} onChange={v => set(o, 'allow_stitch', v, onChange)} status={tiktokAccountStatus('allow_stitch', tiktokCreatorInfo) ?? fieldStatus('tiktok', 'allow_stitch', transport)} />
        <OptionCheckbox label="Add a trending sound automatically" checked={(o.auto_add_music as boolean) ?? false} onChange={v => set(o, 'auto_add_music', v, onChange)} status={fieldStatus('tiktok', 'auto_add_music', transport)} />
        <OptionCheckbox label="AI-generated content disclosure" checked={(o.ai_disclosure as boolean) ?? false} onChange={v => set(o, 'ai_disclosure', v, onChange)} status={fieldStatus('tiktok', 'ai_disclosure', transport)} />
        <OptionCheckbox label="This is a paid partnership" checked={(o.brand_partnership as boolean) ?? false} onChange={v => set(o, 'brand_partnership', v, onChange)} status={fieldStatus('tiktok', 'brand_partnership', transport)} />
      </div>
      <OptionSelect
        label="Branded content"
        value={(o.commercial_content as string) ?? ''}
        onChange={v => set(o, 'commercial_content', v, onChange)}
        options={[
          { value: '', label: 'Not branded content' },
          { value: 'YOUR_BRAND', label: 'Promoting your own brand' },
          { value: 'BRANDED_CONTENT', label: 'Promoting someone else’s brand' },
        ]}
        status={fieldStatus('tiktok', 'commercial_content', transport)}
      />
      <OptionInput
        label="Cover image address"
        value={(o.cover_image_url as string) ?? ''}
        onChange={v => set(o, 'cover_image_url', v, onChange)}
        placeholder="https://…"
        status={fieldStatus('tiktok', 'cover_image_url', transport)}
      />
    </div>
  )
}

function YouTubeOptions({
  options: o,
  onChange,
  transport,
}: {
  options: Record<string, unknown>
  onChange: (o: Record<string, unknown>) => void
  transport: 'zernio' | 'mixpost'
}) {
  return (
    <div className="space-y-2.5">
      <OptionInput label="Title" value={(o.title as string) ?? ''} onChange={v => set(o, 'title', v, onChange)} placeholder="YouTube video title" status={fieldStatus('youtube', 'title', transport)} />
      <OptionSelect
        label="Category"
        value={(o.category as string) ?? '22'}
        onChange={v => set(o, 'category', v, onChange)}
        options={YOUTUBE_CATEGORIES}
        status={fieldStatus('youtube', 'category', transport)}
      />
      <OptionSelect
        label="Privacy"
        value={(o.privacy as string) ?? 'public'}
        onChange={v => set(o, 'privacy', v, onChange)}
        options={[
          { value: 'public', label: 'Public' },
          { value: 'unlisted', label: 'Unlisted' },
          { value: 'private', label: 'Private' },
        ]}
        status={fieldStatus('youtube', 'privacy', transport)}
      />
      <OptionInput label="Playlist" value={(o.playlist as string) ?? ''} onChange={v => set(o, 'playlist', v, onChange)} placeholder="Playlist to add this to" status={fieldStatus('youtube', 'playlist', transport)} />
      <div className="space-y-1.5">
        <OptionCheckbox label="YouTube Shorts" checked={(o.shorts as boolean) ?? false} onChange={v => set(o, 'shorts', v, onChange)} status={fieldStatus('youtube', 'shorts', transport)} />
        <OptionCheckbox label="Made for kids" checked={(o.made_for_kids as boolean) ?? false} onChange={v => set(o, 'made_for_kids', v, onChange)} status={fieldStatus('youtube', 'made_for_kids', transport)} />
        <OptionCheckbox label="AI-generated content disclosure" checked={(o.ai_disclosure as boolean) ?? false} onChange={v => set(o, 'ai_disclosure', v, onChange)} status={fieldStatus('youtube', 'ai_disclosure', transport)} />
      </div>
    </div>
  )
}

function InstagramOptions({
  options: o,
  onChange,
  transport,
}: {
  options: Record<string, unknown>
  onChange: (o: Record<string, unknown>) => void
  transport: 'zernio' | 'mixpost'
}) {
  return (
    <div className="space-y-2.5">
      <OptionInput label="Cover image address (Reels)" value={(o.cover_image_url as string) ?? ''} onChange={v => set(o, 'cover_image_url', v, onChange)} placeholder="https://…" status={fieldStatus('instagram', 'cover_image_url', transport)} />
      <OptionList
        label="Collaborators"
        value={o.collaborators}
        onChange={v => set(o, 'collaborators', v, onChange)}
        placeholder="Instagram handles, separated by commas"
        status={fieldStatus('instagram', 'collaborators', transport)}
      />
      <div className="space-y-1.5">
        <OptionCheckbox label="Also show a Reel on the main grid" checked={(o.share_to_feed as boolean) ?? true} onChange={v => set(o, 'share_to_feed', v, onChange)} status={fieldStatus('instagram', 'share_to_feed', transport)} />
        <OptionCheckbox label="AI-generated content disclosure" checked={(o.ai_disclosure as boolean) ?? false} onChange={v => set(o, 'ai_disclosure', v, onChange)} status={fieldStatus('instagram', 'ai_disclosure', transport)} />
      </div>
    </div>
  )
}

function FacebookOptions({
  options: o,
  onChange,
  transport,
}: {
  options: Record<string, unknown>
  onChange: (o: Record<string, unknown>) => void
  transport: 'zernio' | 'mixpost'
}) {
  return (
    <div className="space-y-2.5">
      <OptionInput label="Video title" value={(o.title as string) ?? ''} onChange={v => set(o, 'title', v, onChange)} placeholder="Shown on a video post" status={fieldStatus('facebook', 'title', transport)} />
      <OptionCheckbox label="Show link preview" checked={(o.link_preview as boolean) ?? true} onChange={v => set(o, 'link_preview', v, onChange)} status={fieldStatus('facebook', 'link_preview', transport)} />
    </div>
  )
}

function LinkedInOptions({
  options: o,
  onChange,
  transport,
}: {
  options: Record<string, unknown>
  onChange: (o: Record<string, unknown>) => void
  transport: 'zernio' | 'mixpost'
}) {
  return (
    <div className="space-y-2.5">
      <OptionInput label="Document title" value={(o.document_title as string) ?? ''} onChange={v => set(o, 'document_title', v, onChange)} placeholder="Shown above an attached PDF" status={fieldStatus('linkedin', 'document_title', transport)} />
      <OptionCheckbox label="Show link preview" checked={(o.link_preview as boolean) ?? true} onChange={v => set(o, 'link_preview', v, onChange)} status={fieldStatus('linkedin', 'link_preview', transport)} />
      <OptionInput label="Article link" value={(o.article_link as string) ?? ''} onChange={v => set(o, 'article_link', v, onChange)} placeholder="https://…" status={fieldStatus('linkedin', 'article_link', transport)} />
    </div>
  )
}

/**
 * Networks with no per-post settings of their own on this connection.
 *
 * This is not "we have not got round to it": Mixpost draws exactly ten option
 * panels and has no Threads, Bluesky or Facebook Group component at all,
 * because those networks take the caption and nothing else.
 */
const NOTHING_TO_SET =
  'takes the caption and the media, and nothing else per post — there is nothing to set here.'

function NoSettingsNetwork({ name }: { name: string }) {
  return <OptionNote>{name} {NOTHING_TO_SET}</OptionNote>
}

const PLATFORM_OPTIONS_MAP: Record<
  string,
  React.ComponentType<{
    options: Record<string, unknown>
    onChange: (o: Record<string, unknown>) => void
    transport: 'zernio' | 'mixpost'
    tiktokCreatorInfo?: ZernioTikTokCreatorInfo | null
  }>
> = {
  tiktok: TikTokOptions,
  youtube: YouTubeOptions,
  instagram: InstagramOptions,
  facebook: FacebookOptions,
  linkedin: LinkedInOptions,
}

const NO_SETTINGS_NETWORKS = new Set(['mastodon', 'pinterest', 'threads', 'bluesky', 'google_business'])

/**
 * The comment that goes up under the post, for the networks that take one.
 *
 * ── Why this is not a thread box ──────────────────────────────────────────
 * It used to be half of one component that drew either a first comment or a
 * written-out thread, decided by the network. The thread half only ever served
 * X, and X is no longer a network this composer offers, so the whole "which of
 * the two is this?" branch went with it. What is left is a single box for a
 * single string, which is exactly what `firstComment` is on the wire — the
 * shape the delivery side already expects, with no ambiguity left to get wrong.
 *
 * Instagram, Facebook, LinkedIn and YouTube take one; TikTok does not. The list
 * is `FIRST_COMMENT_PLATFORMS`, not a copy of it, so it cannot drift from the
 * capability table the reducer checks against.
 */
export function FirstComment({
  platform,
  options,
  onChange,
  transport,
}: {
  platform: string
  options: Record<string, unknown>
  onChange: (options: Record<string, unknown>) => void
  transport: 'zernio' | 'mixpost'
}) {
  if (!FIRST_COMMENT_PLATFORMS.includes(platform)) return null

  const status = composerFieldStatusForTransport(platform, 'first_comment', transport)
  if (!status) return null

  if (!status.ships) {
    return (
      <div className="mt-3">
        <p className="mb-1 text-[11px] font-medium" style={{ color: 'var(--ink-3)' }}>
          First comment
        </p>
        <p className="text-[11px] leading-snug" style={{ color: 'var(--ink-3)' }}>
          {status.reason}
        </p>
      </div>
    )
  }

  return (
    <div className="mt-3">
      <label className="mb-1 block text-[11px] font-medium" style={{ color: 'var(--ink-3)' }}>
        First comment
      </label>
      <textarea
        rows={2}
        value={(options.first_comment as string) ?? ''}
        onChange={(event) => onChange({ ...options, first_comment: event.target.value })}
        placeholder="Goes up as a comment under the post — good for hashtags or a link."
        className="w-full resize-none rounded-[8px] border px-[10px] py-[7px] text-[12.5px] outline-none"
        style={{
          borderColor: 'var(--line)',
          background: 'var(--panel)',
          color: 'var(--ink)',
        }}
      />
    </div>
  )
}

export function PlatformOptions({
  platform,
  options,
  onChange,
  transport = 'mixpost',
  tiktokCreatorInfo,
}: PlatformOptionsProps) {
  const title = platform
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')

  if (NO_SETTINGS_NETWORKS.has(platform)) {
    return (
      <div className="mt-3 rounded-lg border border-border/60 bg-muted/30 p-3">
        <NoSettingsNetwork name={title} />
      </div>
    )
  }

  const Component = PLATFORM_OPTIONS_MAP[platform]
  if (!Component) return null

  return (
    <div className="mt-3 rounded-lg border border-border/60 bg-muted/30 p-3 space-y-0">
      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
        {title} options
      </p>
      <Component
        options={options}
        onChange={onChange}
        transport={transport}
        tiktokCreatorInfo={tiktokCreatorInfo}
      />
    </div>
  )
}

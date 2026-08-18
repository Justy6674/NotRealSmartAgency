'use client'

import {
  composerFieldStatusForTransport,
  type FieldStatus,
} from '@/lib/publishers/zernio-platform-data'

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
}: {
  options: Record<string, unknown>
  onChange: (o: Record<string, unknown>) => void
  transport: 'zernio' | 'mixpost'
}) {
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
        value={(o.privacy as string) ?? 'public'}
        onChange={v => set(o, 'privacy', v, onChange)}
        options={[
          { value: 'public', label: 'Public' },
          { value: 'friends', label: 'Friends' },
          { value: 'private', label: 'Private' },
        ]}
        status={fieldStatus('tiktok', 'privacy', transport)}
      />
      <div className="space-y-1.5">
        <OptionCheckbox label="Allow comments" checked={(o.allow_comments as boolean) ?? true} onChange={v => set(o, 'allow_comments', v, onChange)} status={fieldStatus('tiktok', 'allow_comments', transport)} />
        <OptionCheckbox label="Allow duet" checked={(o.allow_duet as boolean) ?? true} onChange={v => set(o, 'allow_duet', v, onChange)} status={fieldStatus('tiktok', 'allow_duet', transport)} />
        <OptionCheckbox label="Allow stitch" checked={(o.allow_stitch as boolean) ?? true} onChange={v => set(o, 'allow_stitch', v, onChange)} status={fieldStatus('tiktok', 'allow_stitch', transport)} />
        <OptionCheckbox label="AI-generated content disclosure" checked={(o.ai_disclosure as boolean) ?? false} onChange={v => set(o, 'ai_disclosure', v, onChange)} status={fieldStatus('tiktok', 'ai_disclosure', transport)} />
      </div>
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
      <div className="space-y-1.5">
        <OptionCheckbox label="YouTube Shorts" checked={(o.shorts as boolean) ?? false} onChange={v => set(o, 'shorts', v, onChange)} status={fieldStatus('youtube', 'shorts', transport)} />
        <OptionCheckbox label="Made for kids" checked={(o.made_for_kids as boolean) ?? false} onChange={v => set(o, 'made_for_kids', v, onChange)} status={fieldStatus('youtube', 'made_for_kids', transport)} />
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
      <OptionTextarea label="First comment" value={(o.first_comment as string) ?? ''} onChange={v => set(o, 'first_comment', v, onChange)} placeholder="Hashtags or engagement prompt..." status={fieldStatus('instagram', 'first_comment', transport)} />
      <OptionInput label="Cover image URL (Reels)" value={(o.cover_image_url as string) ?? ''} onChange={v => set(o, 'cover_image_url', v, onChange)} placeholder="https://..." status={fieldStatus('instagram', 'cover_image_url', transport)} />
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
      <OptionInput label="Article link" value={(o.article_link as string) ?? ''} onChange={v => set(o, 'article_link', v, onChange)} placeholder="https://..." status={fieldStatus('linkedin', 'article_link', transport)} />
    </div>
  )
}

function TwitterOptions({
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
      <OptionCheckbox label="Post as thread" checked={(o.thread as boolean) ?? false} onChange={v => set(o, 'thread', v, onChange)} status={fieldStatus('twitter', 'thread', transport)} />
    </div>
  )
}

const NOT_ON_THE_LIST =
  'This network is not on the publishing list yet — these switches are not sent.'

function UnsupportedNetwork({ name }: { name: string }) {
  return <OptionNote>{name}: {NOT_ON_THE_LIST}</OptionNote>
}

const PLATFORM_OPTIONS_MAP: Record<
  string,
  React.ComponentType<{
    options: Record<string, unknown>
    onChange: (o: Record<string, unknown>) => void
    transport: 'zernio' | 'mixpost'
  }>
> = {
  tiktok: TikTokOptions,
  youtube: YouTubeOptions,
  instagram: InstagramOptions,
  facebook: FacebookOptions,
  linkedin: LinkedInOptions,
  twitter: TwitterOptions,
}

export function PlatformOptions({
  platform,
  options,
  onChange,
  transport = 'mixpost',
}: PlatformOptionsProps) {
  if (platform === 'mastodon' || platform === 'pinterest' || platform === 'threads' || platform === 'bluesky') {
    return (
      <div className="mt-3 rounded-lg border border-border/60 bg-muted/30 p-3">
        <UnsupportedNetwork name={platform.charAt(0).toUpperCase() + platform.slice(1)} />
      </div>
    )
  }

  const Component = PLATFORM_OPTIONS_MAP[platform]
  if (!Component) return null

  return (
    <div className="mt-3 rounded-lg border border-border/60 bg-muted/30 p-3 space-y-0">
      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
        {platform.charAt(0).toUpperCase() + platform.slice(1)} options
      </p>
      <Component options={options} onChange={onChange} transport={transport} />
    </div>
  )
}

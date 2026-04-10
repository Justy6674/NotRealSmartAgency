'use client'

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * PlatformOptions — per-platform metadata fields.
 *
 * Renders below the caption in PlatformVersionEditor when a specific
 * platform tab is active (not "All Platforms"). Each platform has
 * its own set of inputs reflecting real API fields (privacy, titles,
 * first comments, content warnings, etc.).
 *
 * All values are stored as Record<string, unknown> and passed up via
 * onChange so they can be included in scheduled_posts metadata on save.
 */

interface PlatformOptionsProps {
  platform: string
  options: Record<string, unknown>
  onChange: (options: Record<string, unknown>) => void
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function OptionLabel({ children }: { children: React.ReactNode }) {
  return <label className="block text-[11px] font-medium text-muted-foreground mb-1">{children}</label>
}

function OptionInput({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
}) {
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
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  rows?: number
}) {
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
}: {
  label: string
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string }[]
}) {
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
}: {
  label: string
  checked: boolean
  onChange: (v: boolean) => void
}) {
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

// ── YouTube categories ───────────────────────────────────────────────────────

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

// ── Bluesky language options ─────────────────────────────────────────────────

const BLUESKY_LANGUAGES = [
  { value: 'en', label: 'English' },
  { value: 'es', label: 'Spanish' },
  { value: 'fr', label: 'French' },
  { value: 'de', label: 'German' },
  { value: 'pt', label: 'Portuguese' },
  { value: 'ja', label: 'Japanese' },
  { value: 'ko', label: 'Korean' },
  { value: 'zh', label: 'Chinese' },
  { value: 'ar', label: 'Arabic' },
  { value: 'hi', label: 'Hindi' },
  { value: 'it', label: 'Italian' },
  { value: 'nl', label: 'Dutch' },
  { value: 'ru', label: 'Russian' },
]

// ── Per-platform field sets ──────────────────────────────────────────────────

function set(opts: Record<string, unknown>, key: string, val: unknown, onChange: (o: Record<string, unknown>) => void) {
  onChange({ ...opts, [key]: val })
}

function TikTokOptions({ options: o, onChange }: { options: Record<string, unknown>; onChange: (o: Record<string, unknown>) => void }) {
  return (
    <div className="space-y-2.5">
      <OptionInput label="Title" value={(o.title as string) ?? ''} onChange={v => set(o, 'title', v, onChange)} placeholder="Optional TikTok title" />
      <OptionSelect label="Privacy" value={(o.privacy as string) ?? 'public'} onChange={v => set(o, 'privacy', v, onChange)} options={[
        { value: 'public', label: 'Public' },
        { value: 'friends', label: 'Friends' },
        { value: 'private', label: 'Private' },
      ]} />
      <div className="space-y-1.5">
        <OptionCheckbox label="Allow comments" checked={(o.allow_comments as boolean) ?? true} onChange={v => set(o, 'allow_comments', v, onChange)} />
        <OptionCheckbox label="Allow duet" checked={(o.allow_duet as boolean) ?? true} onChange={v => set(o, 'allow_duet', v, onChange)} />
        <OptionCheckbox label="Allow stitch" checked={(o.allow_stitch as boolean) ?? true} onChange={v => set(o, 'allow_stitch', v, onChange)} />
        <OptionCheckbox label="AI-generated content disclosure" checked={(o.ai_disclosure as boolean) ?? false} onChange={v => set(o, 'ai_disclosure', v, onChange)} />
      </div>
    </div>
  )
}

function YouTubeOptions({ options: o, onChange }: { options: Record<string, unknown>; onChange: (o: Record<string, unknown>) => void }) {
  return (
    <div className="space-y-2.5">
      <OptionInput label="Title" value={(o.title as string) ?? ''} onChange={v => set(o, 'title', v, onChange)} placeholder="YouTube video title" />
      <OptionSelect label="Category" value={(o.category as string) ?? '22'} onChange={v => set(o, 'category', v, onChange)} options={YOUTUBE_CATEGORIES} />
      <OptionSelect label="Privacy" value={(o.privacy as string) ?? 'public'} onChange={v => set(o, 'privacy', v, onChange)} options={[
        { value: 'public', label: 'Public' },
        { value: 'unlisted', label: 'Unlisted' },
        { value: 'private', label: 'Private' },
      ]} />
      <div className="space-y-1.5">
        <OptionCheckbox label="YouTube Shorts" checked={(o.shorts as boolean) ?? false} onChange={v => set(o, 'shorts', v, onChange)} />
        <OptionCheckbox label="Made for kids" checked={(o.made_for_kids as boolean) ?? false} onChange={v => set(o, 'made_for_kids', v, onChange)} />
      </div>
    </div>
  )
}

function InstagramOptions({ options: o, onChange }: { options: Record<string, unknown>; onChange: (o: Record<string, unknown>) => void }) {
  return (
    <div className="space-y-2.5">
      <OptionTextarea label="First comment" value={(o.first_comment as string) ?? ''} onChange={v => set(o, 'first_comment', v, onChange)} placeholder="Hashtags or engagement prompt..." />
      <OptionInput label="Cover image URL (Reels)" value={(o.cover_image_url as string) ?? ''} onChange={v => set(o, 'cover_image_url', v, onChange)} placeholder="https://..." />
    </div>
  )
}

function FacebookOptions({ options: o, onChange }: { options: Record<string, unknown>; onChange: (o: Record<string, unknown>) => void }) {
  return (
    <div className="space-y-2.5">
      <OptionCheckbox label="Show link preview" checked={(o.link_preview as boolean) ?? true} onChange={v => set(o, 'link_preview', v, onChange)} />
    </div>
  )
}

function LinkedInOptions({ options: o, onChange }: { options: Record<string, unknown>; onChange: (o: Record<string, unknown>) => void }) {
  return (
    <div className="space-y-2.5">
      <OptionInput label="Article link" value={(o.article_link as string) ?? ''} onChange={v => set(o, 'article_link', v, onChange)} placeholder="https://..." />
    </div>
  )
}

function TwitterOptions({ options: o, onChange }: { options: Record<string, unknown>; onChange: (o: Record<string, unknown>) => void }) {
  return (
    <div className="space-y-2.5">
      <OptionCheckbox label="Post as thread" checked={(o.thread as boolean) ?? false} onChange={v => set(o, 'thread', v, onChange)} />
    </div>
  )
}

function MastodonOptions({ options: o, onChange }: { options: Record<string, unknown>; onChange: (o: Record<string, unknown>) => void }) {
  return (
    <div className="space-y-2.5">
      <OptionInput label="Content warning" value={(o.content_warning as string) ?? ''} onChange={v => set(o, 'content_warning', v, onChange)} placeholder="Optional CW text" />
      <OptionSelect label="Visibility" value={(o.visibility as string) ?? 'public'} onChange={v => set(o, 'visibility', v, onChange)} options={[
        { value: 'public', label: 'Public' },
        { value: 'unlisted', label: 'Unlisted' },
        { value: 'private', label: 'Followers only' },
        { value: 'direct', label: 'Direct' },
      ]} />
    </div>
  )
}

function PinterestOptions({ options: o, onChange }: { options: Record<string, unknown>; onChange: (o: Record<string, unknown>) => void }) {
  return (
    <div className="space-y-2.5">
      <OptionInput label="Pin link URL" value={(o.pin_link as string) ?? ''} onChange={v => set(o, 'pin_link', v, onChange)} placeholder="https://..." />
      <OptionInput label="Alt text" value={(o.alt_text as string) ?? ''} onChange={v => set(o, 'alt_text', v, onChange)} placeholder="Describe the image for accessibility" />
    </div>
  )
}

function ThreadsOptions({ options: o, onChange }: { options: Record<string, unknown>; onChange: (o: Record<string, unknown>) => void }) {
  return (
    <div className="space-y-2.5">
      <OptionSelect label="Reply control" value={(o.reply_control as string) ?? 'anyone'} onChange={v => set(o, 'reply_control', v, onChange)} options={[
        { value: 'anyone', label: 'Anyone' },
        { value: 'followers', label: 'Followers only' },
        { value: 'mentioned', label: 'Mentioned only' },
      ]} />
    </div>
  )
}

function BlueskyOptions({ options: o, onChange }: { options: Record<string, unknown>; onChange: (o: Record<string, unknown>) => void }) {
  return (
    <div className="space-y-2.5">
      <OptionSelect label="Language" value={(o.language as string) ?? 'en'} onChange={v => set(o, 'language', v, onChange)} options={BLUESKY_LANGUAGES} />
    </div>
  )
}

// ── Platform → Component map ─────────────────────────────────────────────────

const PLATFORM_OPTIONS_MAP: Record<string, React.ComponentType<{ options: Record<string, unknown>; onChange: (o: Record<string, unknown>) => void }>> = {
  tiktok: TikTokOptions,
  youtube: YouTubeOptions,
  instagram: InstagramOptions,
  facebook: FacebookOptions,
  linkedin: LinkedInOptions,
  twitter: TwitterOptions,
  mastodon: MastodonOptions,
  pinterest: PinterestOptions,
  threads: ThreadsOptions,
  bluesky: BlueskyOptions,
}

export function PlatformOptions({ platform, options, onChange }: PlatformOptionsProps) {
  const Component = PLATFORM_OPTIONS_MAP[platform]
  if (!Component) return null

  return (
    <div className="mt-3 rounded-lg border border-border/60 bg-muted/30 p-3 space-y-0">
      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
        {platform.charAt(0).toUpperCase() + platform.slice(1)} options
      </p>
      <Component options={options} onChange={onChange} />
    </div>
  )
}

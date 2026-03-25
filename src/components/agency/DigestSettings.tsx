'use client'

interface DigestSettingsProps {
  settings: {
    digest_enabled: boolean
    competitor_watch: boolean
    digest_keywords: string
    digest_recipients: string
  }
  onChange: (settings: DigestSettingsProps['settings']) => void
}

export function DigestSettings({ settings, onChange }: DigestSettingsProps) {
  return (
    <div className="space-y-4">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Daily Intel Digest
      </p>
      <p className="text-[11px] text-muted-foreground">
        Configure what this brand contributes to your daily intel email. Competitor changes and AI news land in your inbox every morning.
      </p>

      <label className="flex items-center gap-3 rounded-lg border p-3 cursor-pointer hover:bg-muted/50 transition-colors">
        <input
          type="checkbox"
          checked={settings.digest_enabled}
          onChange={e => onChange({ ...settings, digest_enabled: e.target.checked })}
          className="rounded"
        />
        <div>
          <p className="text-sm font-medium">Include in daily digest</p>
          <p className="text-[11px] text-muted-foreground">AI news relevant to this brand&apos;s niche will appear in your morning email</p>
        </div>
      </label>

      <label className="flex items-center gap-3 rounded-lg border p-3 cursor-pointer hover:bg-muted/50 transition-colors">
        <input
          type="checkbox"
          checked={settings.competitor_watch}
          onChange={e => onChange({ ...settings, competitor_watch: e.target.checked })}
          className="rounded"
        />
        <div>
          <p className="text-sm font-medium">Monitor competitors for changes</p>
          <p className="text-[11px] text-muted-foreground">Scrape competitor websites daily, alert you when pricing, features, or content changes</p>
        </div>
      </label>

      <div>
        <label className="text-[10px] font-medium text-muted-foreground">AI news keywords for this brand</label>
        <input
          value={settings.digest_keywords}
          onChange={e => onChange({ ...settings, digest_keywords: e.target.value })}
          placeholder="e.g., telehealth, GLP-1, weight management, Medicare"
          className="w-full rounded-md border border-border bg-background px-2 py-1 text-xs mt-0.5"
        />
        <p className="text-[10px] text-muted-foreground mt-0.5">Comma-separated. News matching these keywords gets highlighted.</p>
      </div>

      <div>
        <label className="text-[10px] font-medium text-muted-foreground">Additional email recipients</label>
        <input
          value={settings.digest_recipients}
          onChange={e => onChange({ ...settings, digest_recipients: e.target.value })}
          placeholder="partner@example.com, va@example.com"
          className="w-full rounded-md border border-border bg-background px-2 py-1 text-xs mt-0.5"
        />
        <p className="text-[10px] text-muted-foreground mt-0.5">Comma-separated. Your email is always included.</p>
      </div>
    </div>
  )
}

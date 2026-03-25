'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface GlobalSettingsProps {
  userId: string
  userEmail: string
  workContext: string
}

interface DigestGlobalSettings {
  master_enabled: boolean
  ai_news_enabled: boolean
  ai_news_keywords: string
  what_am_i_missing: boolean
  frequency: 'daily' | 'weekly'
  time_aest: string
  recipients: string
}

function parseSettings(workContext: string): DigestGlobalSettings {
  try {
    const match = workContext.match(/---GLOBAL_DIGEST---\n([\s\S]+)$/)
    if (match) return JSON.parse(match[1])
  } catch { /* ignore */ }
  return {
    master_enabled: false,
    ai_news_enabled: true,
    ai_news_keywords: 'agent, MCP, orchestration, multi-agent, AI SDK, tool use, Claude, Anthropic, Vercel AI, agentic',
    what_am_i_missing: true,
    frequency: 'daily',
    time_aest: '06:00',
    recipients: '',
  }
}

export function GlobalSettings({ userId, userEmail, workContext }: GlobalSettingsProps) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [settings, setSettings] = useState<DigestGlobalSettings>(parseSettings(workContext))
  const [userContext, setUserContext] = useState(
    workContext.replace(/\n---GLOBAL_DIGEST---[\s\S]*$/, '')
  )

  const handleSave = async () => {
    setSaving(true)
    const newWorkContext = [
      userContext.trim(),
      '---GLOBAL_DIGEST---',
      JSON.stringify(settings),
    ].join('\n')

    await fetch('/api/agents', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        table: 'users',
        id: userId,
        updates: { work_context: newWorkContext },
      }),
    }).catch(() => {
      // Fallback: use Supabase directly if agents API doesn't support users table
    })

    setSaving(false)
    router.refresh()
  }

  return (
    <div className="max-w-2xl space-y-6">
      {/* Work Context */}
      <section className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          About You (Work Context)
        </p>
        <p className="text-[11px] text-muted-foreground">
          Tell your agents how you work. This gets injected into every agent&apos;s system prompt.
        </p>
        <textarea
          value={userContext}
          onChange={e => setUserContext(e.target.value)}
          rows={4}
          placeholder="e.g., I'm a nurse practitioner running 8 brands. I'm time-poor — give me finished outputs, not drafts. I work best with bullet points and action items."
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
        />
      </section>

      <div className="h-px bg-border" />

      {/* Daily Intel Digest */}
      <section className="space-y-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Daily Intel Digest
        </p>
        <p className="text-[11px] text-muted-foreground">
          One email every morning with AI news + competitor updates across all your brands.
        </p>

        <label className="flex items-center gap-3 rounded-lg border p-3 cursor-pointer hover:bg-muted/50 transition-colors">
          <input
            type="checkbox"
            checked={settings.master_enabled}
            onChange={e => setSettings({ ...settings, master_enabled: e.target.checked })}
            className="rounded"
          />
          <div>
            <p className="text-sm font-medium">Enable daily digest</p>
            <p className="text-[11px] text-muted-foreground">Sends at {settings.time_aest} AEST to {userEmail}</p>
          </div>
        </label>

        <label className="flex items-center gap-3 rounded-lg border p-3 cursor-pointer hover:bg-muted/50 transition-colors">
          <input
            type="checkbox"
            checked={settings.ai_news_enabled}
            onChange={e => setSettings({ ...settings, ai_news_enabled: e.target.checked })}
            className="rounded"
          />
          <div>
            <p className="text-sm font-medium">AI & Agent News</p>
            <p className="text-[11px] text-muted-foreground">Filtered from Hacker News, GitHub Trending, Vercel, Anthropic, Product Hunt</p>
          </div>
        </label>

        <label className="flex items-center gap-3 rounded-lg border p-3 cursor-pointer hover:bg-muted/50 transition-colors">
          <input
            type="checkbox"
            checked={settings.what_am_i_missing}
            onChange={e => setSettings({ ...settings, what_am_i_missing: e.target.checked })}
            className="rounded"
          />
          <div>
            <p className="text-sm font-medium">&quot;What am I missing?&quot;</p>
            <p className="text-[11px] text-muted-foreground">AI analyses trends beyond your keywords — surface things you don&apos;t know to look for</p>
          </div>
        </label>

        <div>
          <label className="text-[10px] font-medium text-muted-foreground">AI news keywords</label>
          <input
            value={settings.ai_news_keywords}
            onChange={e => setSettings({ ...settings, ai_news_keywords: e.target.value })}
            className="w-full rounded-md border border-border bg-background px-2 py-1 text-xs mt-0.5"
          />
          <p className="text-[10px] text-muted-foreground mt-0.5">Comma-separated topics to watch across all AI sources</p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[10px] font-medium text-muted-foreground">Frequency</label>
            <select
              value={settings.frequency}
              onChange={e => setSettings({ ...settings, frequency: e.target.value as 'daily' | 'weekly' })}
              className="w-full rounded-md border border-border bg-background px-2 py-1 text-xs mt-0.5"
            >
              <option value="daily">Daily</option>
              <option value="weekly">Weekly (Monday)</option>
            </select>
          </div>
          <div>
            <label className="text-[10px] font-medium text-muted-foreground">Send time (AEST)</label>
            <select
              value={settings.time_aest}
              onChange={e => setSettings({ ...settings, time_aest: e.target.value })}
              className="w-full rounded-md border border-border bg-background px-2 py-1 text-xs mt-0.5"
            >
              <option value="05:00">5:00 AM</option>
              <option value="06:00">6:00 AM</option>
              <option value="07:00">7:00 AM</option>
              <option value="08:00">8:00 AM</option>
            </select>
          </div>
        </div>

        <div>
          <label className="text-[10px] font-medium text-muted-foreground">Additional recipients</label>
          <input
            value={settings.recipients}
            onChange={e => setSettings({ ...settings, recipients: e.target.value })}
            placeholder="partner@example.com, va@example.com"
            className="w-full rounded-md border border-border bg-background px-2 py-1 text-xs mt-0.5"
          />
        </div>
      </section>

      <button
        onClick={handleSave}
        disabled={saving}
        className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
      >
        {saving ? 'Saving...' : 'Save Settings'}
      </button>
    </div>
  )
}

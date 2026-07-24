'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'

interface ApiKeyDisplay {
  id: string
  name: string
  prefix: string
  last_used_at: string | null
  created_at: string
  projects?: Array<{ id: string; name: string }>
}

interface ProjectOption {
  id: string
  name: string
  slug: string
}

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
  notify_post_published: boolean
  notify_post_failed: boolean
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
    notify_post_published: true,
    notify_post_failed: true,
  }
}

export function GlobalSettings({ userId, userEmail, workContext }: GlobalSettingsProps) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [settings, setSettings] = useState<DigestGlobalSettings>(parseSettings(workContext))
  const [userContext, setUserContext] = useState(
    workContext.replace(/\n---GLOBAL_DIGEST---[\s\S]*$/, '')
  )

  const handleSave = async () => {
    setSaving(true)
    setError(null)

    const newWorkContext = [
      userContext.trim(),
      '---GLOBAL_DIGEST---',
      JSON.stringify(settings),
    ].join('\n')

    try {
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ work_context: newWorkContext }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || `Save failed (${res.status})`)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save settings')
    } finally {
      setSaving(false)
      router.refresh()
    }
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

      <div className="h-px bg-border" />

      {/* Post Notifications */}
      <section className="space-y-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Post Notifications
        </p>
        <p className="text-[11px] text-muted-foreground">
          Get emailed when your scheduled posts go live or fail to publish.
        </p>

        <label className="flex items-center gap-3 rounded-lg border p-3 cursor-pointer hover:bg-muted/50 transition-colors">
          <input
            type="checkbox"
            checked={settings.notify_post_published}
            onChange={e => setSettings({ ...settings, notify_post_published: e.target.checked })}
            className="rounded"
          />
          <div>
            <p className="text-sm font-medium">Notify when a post goes live</p>
            <p className="text-[11px] text-muted-foreground">Email confirmation when your content publishes to any platform</p>
          </div>
        </label>

        <label className="flex items-center gap-3 rounded-lg border p-3 cursor-pointer hover:bg-muted/50 transition-colors">
          <input
            type="checkbox"
            checked={settings.notify_post_failed}
            onChange={e => setSettings({ ...settings, notify_post_failed: e.target.checked })}
            className="rounded"
          />
          <div>
            <p className="text-sm font-medium">Notify when a post fails</p>
            <p className="text-[11px] text-muted-foreground">Get alerted if publishing fails so you can fix it quickly</p>
          </div>
        </label>
      </section>

      {error && (
        <p className="text-sm text-red-500">{error}</p>
      )}

      <button
        onClick={handleSave}
        disabled={saving}
        className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
      >
        {saving ? 'Saving...' : 'Save Settings'}
      </button>

      <div className="h-px bg-border" />

      {/* Calendar Sync */}
      <CalendarFeedSection />

      <div className="h-px bg-border" />

      {/* API Keys for CLI / MCP Access */}
      <ApiKeysSection />

      <div className="h-px bg-border" />

      <TelegramPairingSection />
    </div>
  )
}

function CalendarFeedSection() {
  const [keys, setKeys] = useState<ApiKeyDisplay[]>([])
  const [copiedFeed, setCopiedFeed] = useState(false)

  useEffect(() => {
    fetch('/api/keys').then(r => r.ok ? r.json() : { keys: [] }).then(d => setKeys(d.keys ?? []))
  }, [])

  const firstKey = keys[0]
  const feedUrl = firstKey
    ? `https://www.notrealsmart.com.au/api/calendar/feed?key=${firstKey.prefix}...`
    : null

  // We can't show the full key (only prefix stored). User needs to use a key they know.
  // Show instructions instead.

  return (
    <section className="space-y-3">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Calendar Sync (Google Calendar / Apple Calendar)
      </p>
      <p className="text-[11px] text-muted-foreground">
        See all your scheduled posts in Google Calendar or Apple Calendar.
        Colour-coded by brand. Auto-updates every hour.
      </p>

      <div className="rounded-lg border p-4 space-y-3">
        <p className="text-sm font-medium">How to subscribe</p>
        <ol className="text-[12px] text-muted-foreground space-y-1 list-decimal list-inside">
          <li>Create an API key below (if you haven&apos;t already)</li>
          <li>Copy your calendar feed URL: <code className="text-[11px] bg-muted px-1 rounded">https://www.notrealsmart.com.au/api/calendar/feed?key=YOUR_API_KEY</code></li>
          <li>In Google Calendar: <strong>+ Other calendars → From URL</strong> → paste</li>
          <li>For one brand only, add <code className="text-[11px] bg-muted px-1 rounded">&amp;brand=your-brand-slug</code></li>
        </ol>
        <p className="text-[11px] text-muted-foreground">
          Works with Apple Calendar too — add your Google account to your Mac and it syncs automatically.
        </p>
      </div>
    </section>
  )
}

function ApiKeysSection() {
  const [keys, setKeys] = useState<ApiKeyDisplay[]>([])
  const [projects, setProjects] = useState<ProjectOption[]>([])
  const [selectedProjectIds, setSelectedProjectIds] = useState<string[]>([])
  const [newKeyName, setNewKeyName] = useState('')
  const [createdKey, setCreatedKey] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [copied, setCopied] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

  const loadKeys = useCallback(async () => {
    const res = await fetch('/api/keys')
    if (res.ok) {
      const data = await res.json()
      setKeys(data.keys ?? [])
      setProjects(data.projects ?? [])
    }
  }, [])

  useEffect(() => { loadKeys() }, [loadKeys])

  const handleCreate = async () => {
    if (!newKeyName.trim() || selectedProjectIds.length === 0) return
    setCreating(true)
    setCreatedKey(null)
    setCreateError(null)
    try {
      const res = await fetch('/api/keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newKeyName.trim(), project_ids: selectedProjectIds }),
      })
      if (res.ok) {
        const data = await res.json()
        setCreatedKey(data.key)
        setNewKeyName('')
        setSelectedProjectIds([])
        loadKeys()
      } else {
        const data = await res.json().catch(() => ({}))
        setCreateError(data.error ?? 'Could not create this scoped connection.')
      }
    } finally {
      setCreating(false)
    }
  }

  const handleRevoke = async (id: string) => {
    await fetch(`/api/keys?id=${id}`, { method: 'DELETE' })
    loadKeys()
  }

  const handleCopy = () => {
    if (createdKey) {
      navigator.clipboard.writeText(createdKey)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <section className="space-y-4">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Connect from Claude Desktop, Mobile &amp; Code
      </p>

      <div className="rounded-lg border p-4 space-y-2">
        <p className="text-sm font-medium">Quick connect (Claude Desktop &amp; Mobile)</p>
        <p className="text-[11px] text-muted-foreground">
          Settings → Integrations → Add custom connector → Name: <strong>NotRealSmart</strong>,
          URL: <strong>https://www.notrealsmart.com.au/api/mcp</strong> → Click Add → Log in → Done.
          Your 12 agency tools appear in every conversation.
        </p>
      </div>

      <div className="space-y-1">
        <p className="text-xs font-medium text-muted-foreground">API Keys (Claude Code / Cowork / Terminal)</p>
        <p className="text-[11px] text-muted-foreground">
          For Claude Code or Cowork, create a key below and tell Claude to add it.
          Or add it to ~/.mcp.json manually.
        </p>
      </div>

      <fieldset className="space-y-2" aria-describedby="mcp-project-scope-help">
        <legend className="text-xs font-medium text-muted-foreground">Projects this connection can use</legend>
        <p id="mcp-project-scope-help" className="text-[11px] text-muted-foreground">
          Choose only the workspaces you want this device or AI connection to access. You can create another key later for a different set.
        </p>
        {projects.length > 0 ? (
          <div className="grid gap-2 sm:grid-cols-2">
            {projects.map((project) => {
              const selected = selectedProjectIds.includes(project.id)
              return (
                <label key={project.id} className="flex min-w-0 items-center gap-2 rounded-md border px-3 py-2 text-sm hover:bg-muted/40">
                  <input
                    type="checkbox"
                    checked={selected}
                    onChange={() => setSelectedProjectIds((current) => selected
                      ? current.filter((id) => id !== project.id)
                      : [...current, project.id])}
                    className="size-4 shrink-0"
                  />
                  <span className="min-w-0 truncate">{project.name}</span>
                </label>
              )
            })}
          </div>
        ) : (
          <p className="rounded-md border border-dashed px-3 py-2 text-sm text-muted-foreground">
            No project workspaces are available for this account yet.
          </p>
        )}
      </fieldset>

      {/* Created key banner — shown once */}
      {createdKey && (
        <div className="rounded-lg border border-green-500/30 bg-green-500/5 p-4 space-y-2">
          <p className="text-sm font-medium text-green-400">Key created — copy it now. You won&apos;t see it again.</p>
          <div className="flex gap-2">
            <code className="flex-1 rounded bg-background px-3 py-2 text-xs font-mono break-all select-all">
              {createdKey}
            </code>
            <button
              onClick={handleCopy}
              className="shrink-0 rounded-md border px-3 py-1 text-xs hover:bg-muted transition-colors"
            >
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
          <details className="text-[10px] text-muted-foreground">
            <summary className="cursor-pointer">Setup instructions</summary>
            <pre className="mt-2 rounded bg-background p-3 overflow-x-auto text-[10px]">{`// Add to ~/.claude/settings.json (Claude Code)
// or Claude Desktop MCP config
{
  "mcpServers": {
    "notrealsmart": {
      "url": "https://notrealsmart.com.au/api/mcp",
      "headers": {
        "Authorization": "Bearer ${createdKey}"
      }
    }
  }
}`}</pre>
          </details>
        </div>
      )}

      {/* Create new key */}
      <div className="flex gap-2">
        <input
          value={newKeyName}
          onChange={e => setNewKeyName(e.target.value)}
          placeholder="Key name (e.g. Claude Code laptop)"
          className="flex-1 rounded-md border border-border bg-background px-3 py-1.5 text-sm"
          onKeyDown={e => e.key === 'Enter' && handleCreate()}
        />
        <button
          onClick={handleCreate}
          disabled={creating || !newKeyName.trim() || selectedProjectIds.length === 0}
          className="rounded-md bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          {creating ? 'Creating...' : 'Create Key'}
        </button>
      </div>

      {createError && <p role="alert" className="text-xs text-red-500">{createError}</p>}

      {/* Existing keys */}
      {keys.length > 0 && (
        <div className="rounded-lg border overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b bg-muted/30">
                <th className="px-3 py-2 text-left font-medium text-muted-foreground">Name</th>
                <th className="px-3 py-2 text-left font-medium text-muted-foreground">Key</th>
                <th className="px-3 py-2 text-left font-medium text-muted-foreground">Projects</th>
                <th className="px-3 py-2 text-left font-medium text-muted-foreground">Last used</th>
                <th className="px-3 py-2 text-right font-medium text-muted-foreground" />
              </tr>
            </thead>
            <tbody>
              {keys.map(k => (
                <tr key={k.id} className="border-b last:border-0">
                  <td className="px-3 py-2">{k.name}</td>
                  <td className="px-3 py-2 font-mono text-muted-foreground">{k.prefix}...</td>
                  <td className="px-3 py-2 text-muted-foreground">
                    <span className="block max-w-48 truncate" title={(k.projects ?? []).map((project) => project.name).join(', ')}>
                      {(k.projects ?? []).map((project) => project.name).join(', ') || 'No project scope'}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {k.last_used_at
                      ? new Date(k.last_used_at).toLocaleDateString('en-AU')
                      : 'Never'}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button
                      onClick={() => handleRevoke(k.id)}
                      className="text-red-400 hover:text-red-300 transition-colors"
                    >
                      Revoke
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {keys.length === 0 && !createdKey && (
        <p className="text-[11px] text-muted-foreground italic">
          No API keys yet. Create one to connect your AI client.
        </p>
      )}
    </section>
  )
}

function TelegramPairingSection() {
  const [projects, setProjects] = useState<ProjectOption[]>([])
  const [selectedProjectIds, setSelectedProjectIds] = useState<string[]>([])
  const [pairCommand, setPairCommand] = useState<string | null>(null)
  const [expiresAt, setExpiresAt] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/keys')
      .then((response) => response.ok ? response.json() : { projects: [] })
      .then((data) => setProjects(data.projects ?? []))
      .catch(() => setProjects([]))
  }, [])

  const createPairCommand = async () => {
    if (selectedProjectIds.length === 0) return
    setCreating(true)
    setError(null)
    setPairCommand(null)
    try {
      const response = await fetch('/api/telegram/pair', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project_ids: selectedProjectIds }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        setError(data.error ?? 'Could not create a Telegram pairing command.')
        return
      }
      setPairCommand(data.start_command)
      setExpiresAt(data.expires_at)
    } catch {
      setError('Could not create a Telegram pairing command.')
    } finally {
      setCreating(false)
    }
  }

  const copyPairCommand = () => {
    if (!pairCommand) return
    navigator.clipboard.writeText(pairCommand)
    setCopied(true)
    setTimeout(() => setCopied(false), 2_000)
  }

  return (
    <section className="space-y-4">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Private Telegram Control Channel
      </p>
      <p className="text-[11px] text-muted-foreground">
        Choose which project workspaces this private Telegram chat can use. It cannot discover or switch to any other project from a message. Telegram remains disabled until its token is rotated and production verification is complete.
      </p>

      <fieldset className="space-y-2" aria-describedby="telegram-project-scope-help">
        <legend className="text-xs font-medium text-muted-foreground">Projects this Telegram chat can use</legend>
        <p id="telegram-project-scope-help" className="text-[11px] text-muted-foreground">
          You will choose one of these projects in Telegram before making a marketing request. You can make another pairing command later if the access needs to change.
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          {projects.map((project) => {
            const selected = selectedProjectIds.includes(project.id)
            return (
              <label key={project.id} className="flex min-w-0 items-center gap-2 rounded-md border px-3 py-2 text-sm hover:bg-muted/40">
                <input
                  type="checkbox"
                  checked={selected}
                  onChange={() => setSelectedProjectIds((current) => selected
                    ? current.filter((id) => id !== project.id)
                    : [...current, project.id])}
                  className="size-4 shrink-0"
                />
                <span className="min-w-0 truncate">{project.name}</span>
              </label>
            )
          })}
        </div>
      </fieldset>

      <button
        onClick={createPairCommand}
        disabled={creating || selectedProjectIds.length === 0}
        className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
      >
        {creating ? 'Creating pairing command…' : 'Create pairing command'}
      </button>

      {error && <p role="alert" className="text-xs text-red-500">{error}</p>}

      {pairCommand && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 space-y-2">
          <p className="text-sm font-medium">Send this once to the NRS Telegram bot</p>
          <p className="text-[11px] text-muted-foreground">It expires {expiresAt ? new Date(expiresAt).toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit' }) : 'soon'} and cannot be used again.</p>
          <div className="flex gap-2">
            <code className="flex-1 rounded bg-background px-3 py-2 text-xs font-mono break-all select-all">{pairCommand}</code>
            <button onClick={copyPairCommand} className="shrink-0 rounded-md border px-3 py-1 text-xs hover:bg-muted transition-colors">
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
        </div>
      )}
    </section>
  )
}

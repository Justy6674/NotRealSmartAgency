'use client'

import Script from 'next/script'
import { FormEvent, useEffect, useMemo, useState } from 'react'

interface TelegramWebApp {
  initData: string
  ready: () => void
  expand: () => void
}

interface TelegramProject {
  id: string
  name: string
  project_id: string
}

interface TelegramMessage {
  role: 'user' | 'director'
  text: string
}

declare global {
  interface Window {
    Telegram?: { WebApp?: TelegramWebApp }
  }
}

async function wait(ms: number) {
  await new Promise((resolve) => window.setTimeout(resolve, ms))
}

export default function TelegramMiniAppPage() {
  const [initData, setInitData] = useState('')
  const [firstName, setFirstName] = useState('')
  const [projects, setProjects] = useState<TelegramProject[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [messages, setMessages] = useState<TelegramMessage[]>([])
  const [draft, setDraft] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const selectedProject = useMemo(() => projects.find((project) => project.id === selectedId) ?? null, [projects, selectedId])

  useEffect(() => {
    let cancelled = false
    const connect = async () => {
      const webApp = window.Telegram?.WebApp
      if (!webApp?.initData) {
        if (!cancelled) {
          setError('Open this page from the NRS Telegram Mini App button.')
          setLoading(false)
        }
        return
      }
      webApp.ready()
      webApp.expand()
      setInitData(webApp.initData)
      const response = await fetch('/api/telegram/mini-app/session', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ init_data: webApp.initData }),
      })
      const data = await response.json().catch(() => ({})) as {
        error?: string
        user?: { first_name?: string | null }
        projects?: TelegramProject[]
        active_project_id?: string | null
      }
      if (cancelled) return
      if (!response.ok) {
        setError(data.error ?? 'NRS could not open this Telegram session.')
      } else {
        setFirstName(data.user?.first_name ?? '')
        setProjects(data.projects ?? [])
        setSelectedId(data.active_project_id ?? data.projects?.[0]?.id ?? null)
      }
      setLoading(false)
    }
    const timer = window.setTimeout(connect, 100)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [])

  const chooseProject = async (grantId: string) => {
    setError(null)
    const response = await fetch('/api/telegram/mini-app/select', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ init_data: initData, grant_id: grantId }),
    })
    const data = await response.json().catch(() => ({})) as { error?: string }
    if (!response.ok) {
      setError(data.error ?? 'Could not select that project.')
      return
    }
    setSelectedId(grantId)
  }

  const sendMessage = async (event: FormEvent) => {
    event.preventDefault()
    const message = draft.trim()
    if (!message || !selectedProject || sending) return
    setSending(true)
    setError(null)
    setMessages((current) => [...current, { role: 'user', text: message }])
    setDraft('')
    const response = await fetch('/api/telegram/mini-app/message', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ init_data: initData, message }),
    })
    const data = await response.json().catch(() => ({})) as { error?: string; job_id?: string }
    if (!response.ok || !data.job_id) {
      setError(data.error ?? 'NRS could not start that request.')
      setSending(false)
      return
    }

    for (let attempt = 0; attempt < 60; attempt += 1) {
      await wait(2_500)
      const poll = await fetch(`/api/telegram/mini-app/jobs/${data.job_id}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ init_data: initData }),
      })
      const result = await poll.json().catch(() => ({})) as { status?: string; response?: string; error?: string }
      if (result.status === 'done') {
        setMessages((current) => [...current, { role: 'director', text: result.response ?? '' }])
        setSending(false)
        return
      }
      if (result.status === 'error') {
        setError(result.error ?? 'The Director could not complete that request.')
        setSending(false)
        return
      }
    }
    setError('The Director is still working. Reopen the Mini App shortly to check the result.')
    setSending(false)
  }

  return (
    <main className="min-h-screen bg-[var(--tg-theme-bg-color,#0e151c)] text-[var(--tg-theme-text-color,#f2f4f6)]">
      <Script src="https://telegram.org/js/telegram-web-app.js" strategy="beforeInteractive" />
      <div className="mx-auto flex min-h-screen w-full max-w-2xl flex-col px-4 py-5 sm:px-6">
        <header className="mb-5 flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--tg-theme-hint-color,#82909f)]">NRS Director</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight">{firstName ? `What are we moving forward, ${firstName}?` : 'What are we moving forward?'}</h1>
            <p className="mt-2 text-sm text-[var(--tg-theme-hint-color,#82909f)]">One focused request at a time, tied to your selected brand goal.</p>
          </div>
          <span className="rounded-full bg-[var(--tg-theme-secondary-bg-color,#17212b)] px-3 py-1 text-xs text-[var(--tg-theme-hint-color,#82909f)]">Private</span>
        </header>

        {loading && <p className="rounded-xl bg-[var(--tg-theme-secondary-bg-color,#17212b)] p-4 text-sm">Opening your NRS workspace…</p>}
        {error && <p role="alert" className="mb-4 rounded-xl border border-red-400/30 bg-red-400/10 p-4 text-sm text-red-100">{error}</p>}

        {!loading && !error && (
          <>
            <section aria-labelledby="projects-heading" className="mb-5">
              <div className="mb-2 flex items-center justify-between">
                <h2 id="projects-heading" className="text-sm font-medium">Working on</h2>
                <span className="text-xs text-[var(--tg-theme-hint-color,#82909f)]">Choose a workspace</span>
              </div>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {projects.map((project) => (
                  <button
                    key={project.id}
                    type="button"
                    onClick={() => chooseProject(project.id)}
                    className={`shrink-0 rounded-full border px-4 py-2 text-sm transition-colors ${selectedId === project.id ? 'border-[var(--tg-theme-button-color,#2aabee)] bg-[var(--tg-theme-button-color,#2aabee)] text-[var(--tg-theme-button-text-color,#fff)]' : 'border-white/10 bg-[var(--tg-theme-secondary-bg-color,#17212b)]'}`}
                  >
                    {project.name}
                  </button>
                ))}
              </div>
            </section>

            <section className="flex-1 space-y-3" aria-live="polite">
              {messages.length === 0 && (
                <div className="rounded-2xl bg-[var(--tg-theme-secondary-bg-color,#17212b)] p-5 text-sm text-[var(--tg-theme-hint-color,#82909f)]">
                  Ask the Director to move the selected brand toward its active goal. If no goal exists yet, it will ask you for the outcome first.
                </div>
              )}
              {messages.map((message, index) => (
                <div key={`${message.role}-${index}`} className={`max-w-[92%] whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm leading-6 ${message.role === 'user' ? 'ml-auto bg-[var(--tg-theme-button-color,#2aabee)] text-[var(--tg-theme-button-text-color,#fff)]' : 'bg-[var(--tg-theme-secondary-bg-color,#17212b)]'}`}>
                  {message.text}
                </div>
              ))}
              {sending && <div className="rounded-2xl bg-[var(--tg-theme-secondary-bg-color,#17212b)] px-4 py-3 text-sm text-[var(--tg-theme-hint-color,#82909f)]">The Director is working…</div>}
            </section>

            <form onSubmit={sendMessage} className="sticky bottom-0 mt-5 flex items-end gap-2 bg-[var(--tg-theme-bg-color,#0e151c)] py-2">
              <label className="sr-only" htmlFor="telegram-message">Message the NRS Director</label>
              <textarea id="telegram-message" value={draft} onChange={(event) => setDraft(event.target.value)} disabled={!selectedProject || sending} rows={2} placeholder={selectedProject ? `Ask about ${selectedProject.name}…` : 'Choose a project first'} className="min-h-12 flex-1 resize-none rounded-2xl border border-white/10 bg-[var(--tg-theme-secondary-bg-color,#17212b)] px-4 py-3 text-sm outline-none placeholder:text-[var(--tg-theme-hint-color,#82909f)] focus:border-[var(--tg-theme-button-color,#2aabee)]" />
              <button type="submit" disabled={!draft.trim() || !selectedProject || sending} className="rounded-2xl bg-[var(--tg-theme-button-color,#2aabee)] px-4 py-3 text-sm font-semibold text-[var(--tg-theme-button-text-color,#fff)] disabled:opacity-40">Send</button>
            </form>
          </>
        )}
      </div>
    </main>
  )
}

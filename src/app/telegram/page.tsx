'use client'

import Script from 'next/script'
import { FormEvent, useEffect, useMemo, useRef, useState } from 'react'

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

/** Attached and uploading, or uploaded and waiting on Send. */
interface StagedFile {
  name: string
  type: string
  percent: number
  /** Set once the bytes are in storage; until then it cannot be committed. */
  storagePath: string | null
}

interface TelegramProposal {
  output_id: string
  /** The Director's opening line — what it watched, and what it suggests next. */
  opener: string
  hook: string
  caption: string
  hashtags: string[]
  post_type: string
  approved: boolean
}

interface TelegramMediaItem {
  id: string
  file_name: string
  file_type: string
  /** See the media route for what each stage means. */
  stage: 'listening' | 'ready' | 'no_draft' | 'failed'
  proposal: TelegramProposal | null
}

declare global {
  interface Window {
    Telegram?: { WebApp?: TelegramWebApp }
  }
}

async function wait(ms: number) {
  await new Promise((resolve) => window.setTimeout(resolve, ms))
}


/**
 * PUT the file to the signed storage URL, reporting progress.
 *
 * XMLHttpRequest rather than fetch because fetch cannot report upload
 * progress, and a 224 MB video over phone data needs to show it is moving.
 */
function uploadWithProgress(
  signedUrl: string,
  file: File,
  onProgress: (percent: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest()
    request.open('PUT', signedUrl, true)
    request.setRequestHeader('content-type', file.type || 'application/octet-stream')
    request.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100))
    }
    request.onload = () => (request.status >= 200 && request.status < 300 ? resolve() : reject(new Error(String(request.status))))
    request.onerror = () => reject(new Error('network'))
    request.send(file)
  })
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
  const [staged, setStaged] = useState<StagedFile[]>([])
  const [mediaItems, setMediaItems] = useState<TelegramMediaItem[]>([])

  const selectedProject = useMemo(() => projects.find((project) => project.id === selectedId) ?? null, [projects, selectedId])

  /**
   * Bring the chosen brand into view.
   *
   * With fourteen brands the strip is far wider than a phone, and the active
   * one is routinely off-screen — so the app looked like it had lost the brand
   * that was in fact already selected. Highlighting it is not enough when the
   * highlight is past the right edge.
   */
  const selectedChipRef = useRef<HTMLButtonElement | null>(null)
  useEffect(() => {
    selectedChipRef.current?.scrollIntoView({ block: 'nearest', inline: 'center' })
  }, [selectedId, projects.length])

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
    setMediaItems([])
  }

  /** What has landed for this project, and what has been written about it. */
  const refreshMedia = async () => {
    if (!initData) return
    const response = await fetch('/api/telegram/mini-app/media', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ init_data: initData }),
    })
    if (!response.ok) return
    const data = (await response.json().catch(() => ({}))) as { items?: TelegramMediaItem[] }
    setMediaItems(data.items ?? [])
  }

  /** Show what is already waiting when the app opens, not just this session's uploads. */
  useEffect(() => {
    if (initData && selectedId) void refreshMedia()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initData, selectedId])

  /**
   * Keep checking only while something is still being listened to.
   *
   * Transcription and the first-pass proposal run in the background after the
   * upload returns, so the list has to fill itself in. Once every clip is ready
   * there is nothing left to wait for and the polling stops.
   */
  const awaitingWork = mediaItems.some((item) => item.stage === 'listening')
  useEffect(() => {
    if (!initData || !selectedId || !awaitingWork) return
    let cancelled = false
    const timer = window.setInterval(() => {
      if (!cancelled) void refreshMedia()
    }, 5_000)
    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initData, selectedId, awaitingWork])

  /**
   * Commit everything attached, using what was typed as the direction.
   *
   * The bytes are already in storage by now — attaching starts that straight
   * away so the wait happens while the direction is being typed. What waits for
   * Send is the part that matters: filing the clip and letting Content & Copy
   * write about it. Sending the file the moment it was picked meant the
   * direction had nowhere to go, because the writing had already begun.
   */
  const sendStaged = async (direction: string) => {
    const ready = staged.filter((item) => item.storagePath)
    if (ready.length === 0) return
    setSending(true)
    setError(null)
    setMessages((current) => [
      ...current,
      { role: 'user', text: [direction, `Sent ${ready.map((item) => item.name).join(', ')}`].filter(Boolean).join('\n') },
    ])
    setDraft('')
    setStaged([])

    const outcomes = await Promise.allSettled(
      ready.map(async (item) => {
        const finished = await fetch('/api/telegram/mini-app/upload', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            init_data: initData,
            action: 'complete',
            storage_path: item.storagePath,
            file_name: item.name,
            file_type: item.type,
            ...(direction ? { instruction: direction } : {}),
          }),
        })
        const data = (await finished.json().catch(() => ({}))) as { error?: string; media_item_id?: string }
        if (!finished.ok || !data.media_item_id) throw new Error(data.error ?? `${item.name} could not be filed.`)
      }),
    )
    const failures = outcomes.flatMap((outcome) =>
      outcome.status === 'rejected' ? [String(outcome.reason?.message ?? outcome.reason)] : [],
    )
    if (failures.length > 0) setError(failures.join(' '))
    setSending(false)
    void refreshMedia()
  }

  const sendMessage = async (event: FormEvent) => {
    event.preventDefault()
    const message = draft.trim()
    if (!selectedProject || sending) return
    if (staged.length > 0) {
      if (staged.some((item) => !item.storagePath)) {
        setError('Still uploading — give it a moment, then press Send.')
        return
      }
      await sendStaged(message)
      return
    }
    if (!message) return
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

  /**
   * Attach files and get their bytes moving, without committing them.
   *
   * The upload starts on attach so a 224 MB video is travelling while the
   * direction is being typed, but the clip is not filed and nothing is written
   * about it until Send. That split is why the route has separate `start` and
   * `complete` steps.
   *
   * The bytes go straight from here to storage using a signed URL. They do not
   * pass through the bot, which Telegram will not let fetch anything over
   * 20 MB — the reason no real footage had ever reached NRS — and they do not
   * pass through a serverless function either, whose request body limit a
   * 224 MB video would blow just as surely.
   */
  const attachFiles = async (files: File[]) => {
    if (!selectedProject || sending || files.length === 0) return
    setError(null)
    setStaged((current) => [
      ...current,
      ...files.map((file) => ({ name: file.name, type: file.type, percent: 0, storagePath: null })),
    ])

    await Promise.allSettled(
      files.map(async (file) => {
        const started = await fetch('/api/telegram/mini-app/upload', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            init_data: initData,
            action: 'start',
            file_name: file.name,
            file_type: file.type,
            file_size: file.size,
          }),
        })
        const startData = (await started.json().catch(() => ({}))) as {
          error?: string
          signed_url?: string
          storage_path?: string
        }
        if (!started.ok || !startData.signed_url || !startData.storage_path) {
          setStaged((current) => current.filter((item) => item.name !== file.name))
          setError(startData.error ?? `Could not start the upload for ${file.name}.`)
          return
        }

        try {
          await uploadWithProgress(startData.signed_url, file, (percent) =>
            setStaged((current) =>
              current.map((item) => (item.name === file.name ? { ...item, percent } : item)),
            ),
          )
        } catch {
          setStaged((current) => current.filter((item) => item.name !== file.name))
          setError(`${file.name} did not finish uploading. Check your connection.`)
          return
        }

        setStaged((current) =>
          current.map((item) =>
            item.name === file.name
              ? { ...item, percent: 100, storagePath: startData.storage_path as string }
              : item,
          ),
        )
      }),
    )
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

        {/*
          Once a session is open the workspace stays on screen, whatever went
          wrong. Hiding it behind `!error` turned every message into a dead end:
          "Still uploading — press Send" removed the Send button along with the
          brands, the attached files and the whole composer, leaving an
          instruction and no way to follow it, or to go back.

          A message about one upload is not a reason to take the app away. Only
          a session that never opened — no projects — has nothing to show.
        */}
        {!loading && projects.length > 0 && (
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
                    ref={selectedId === project.id ? selectedChipRef : null}
                    type="button"
                    aria-current={selectedId === project.id ? 'true' : undefined}
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
              {sending && <div className="rounded-2xl bg-[var(--tg-theme-secondary-bg-color,#17212b)] px-4 py-3 text-sm text-[var(--tg-theme-hint-color,#82909f)]">Working…</div>}

              {mediaItems.length > 0 && (
                <div className="space-y-2 pt-1">
                  {mediaItems.map((item) => (
                    <div key={item.id} className="rounded-2xl border border-white/10 bg-[var(--tg-theme-secondary-bg-color,#17212b)] p-4 text-sm">
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="truncate font-medium">{item.file_name}</span>
                        <span className="shrink-0 text-xs text-[var(--tg-theme-hint-color,#82909f)]">
                          {item.stage === 'listening'
                            ? 'listening…'
                            : item.stage === 'failed'
                              ? 'could not read'
                              : item.stage === 'no_draft'
                                ? 'transcribed — no draft yet'
                                : 'ready'}
                        </span>
                      </div>
                      {item.proposal?.opener && (
                        <p className="mt-3 leading-6 text-[var(--tg-theme-text-color,#f2f4f6)]">{item.proposal.opener}</p>
                      )}
                      {item.proposal && (
                        <div className="mt-3 space-y-2 rounded-xl border border-white/10 p-3">
                          {item.proposal.hook && <p className="font-semibold leading-6">{item.proposal.hook}</p>}
                          <p className="whitespace-pre-wrap leading-6 text-[var(--tg-theme-text-color,#f2f4f6)]">{item.proposal.caption}</p>
                          {item.proposal.hashtags.length > 0 && (
                            <p className="text-xs text-[var(--tg-theme-hint-color,#82909f)]">
                              {item.proposal.hashtags.map((tag) => `#${tag}`).join(' ')}
                            </p>
                          )}
                          <p className="text-xs text-[var(--tg-theme-hint-color,#82909f)]">
                            {item.proposal.post_type} · not in Mixpost yet — say what to change, or tell the Director to draft it
                          </p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>

            <div className="sticky bottom-0 mt-5 bg-[var(--tg-theme-bg-color,#0e151c)] py-2">
            {staged.length > 0 && (
              <div className="mb-2 space-y-1">
                {staged.map((item) => (
                  <div key={item.name} className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-[var(--tg-theme-secondary-bg-color,#17212b)] px-3 py-2 text-xs">
                    <span className="truncate">{item.name}</span>
                    <span className="shrink-0 text-[var(--tg-theme-hint-color,#82909f)]">
                      {item.storagePath ? 'attached' : `uploading… ${item.percent}%`}
                    </span>
                  </div>
                ))}
                <p className="px-1 text-xs text-[var(--tg-theme-hint-color,#82909f)]">
                  Say what you want from {staged.length === 1 ? 'it' : 'them'} — the story, the angle, the feel — then press Send.
                </p>
              </div>
            )}
            <form onSubmit={sendMessage} className="flex items-end gap-2">
              <label className="sr-only" htmlFor="telegram-message">Message the NRS Director</label>
              <textarea id="telegram-message" value={draft} onChange={(event) => setDraft(event.target.value)} disabled={!selectedProject || sending} rows={2} placeholder={staged.length > 0 ? 'What is this one about?' : selectedProject ? `Ask about ${selectedProject.name}…` : 'Choose a project first'} className="min-h-12 flex-1 resize-none rounded-2xl border border-white/10 bg-[var(--tg-theme-secondary-bg-color,#17212b)] px-4 py-3 text-sm outline-none placeholder:text-[var(--tg-theme-hint-color,#82909f)] focus:border-[var(--tg-theme-button-color,#2aabee)]" />
              <label className={`flex cursor-pointer items-center justify-center rounded-2xl border border-white/10 bg-[var(--tg-theme-secondary-bg-color,#17212b)] px-4 py-3 text-sm ${!selectedProject || sending ? 'opacity-40' : ''}`} title="Send a video, photo or recording">
                <span aria-hidden>+</span>
                <span className="sr-only">Attach a video, photo or recording</span>
                <input
                  type="file"
                  accept="video/*,image/*,audio/*"
                  multiple
                  disabled={!selectedProject || sending}
                  className="hidden"
                  onChange={(event) => {
                    const files = Array.from(event.target.files ?? [])
                    event.target.value = ''
                    if (files.length > 0) void attachFiles(files)
                  }}
                />
              </label>
              <button type="submit" disabled={(!draft.trim() && staged.length === 0) || !selectedProject || sending} className="rounded-2xl bg-[var(--tg-theme-button-color,#2aabee)] px-4 py-3 text-sm font-semibold text-[var(--tg-theme-button-text-color,#fff)] disabled:opacity-40">Send</button>
            </form>
            </div>
          </>
        )}
      </div>
    </main>
  )
}

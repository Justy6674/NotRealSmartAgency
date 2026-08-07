'use client'

import Script from 'next/script'
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { TimelineView } from './timeline-view'
import { mergeTimeline, type TimelineEvent } from '@/lib/telegram/timeline'
import { anchorAfterPrepend, nextScrollTop, shouldFollow, shouldOfferJump } from '@/lib/telegram/chat-scroll'

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

/** Attached and uploading, or uploaded and waiting on Send. */
interface StagedFile {
  name: string
  type: string
  percent: number
  /** Set once the bytes are in storage; until then it cannot be committed. */
  storagePath: string | null
}

declare global {
  interface Window {
    Telegram?: { WebApp?: TelegramWebApp }
  }
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
  const [events, setEvents] = useState<TimelineEvent[]>([])
  const [draft, setDraft] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [staged, setStaged] = useState<StagedFile[]>([])
  const [hasMore, setHasMore] = useState(false)
  const [oldestAnchorMs, setOldestAnchorMs] = useState<number | null>(null)
  const [showJump, setShowJump] = useState(false)
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const followingRef = useRef(true)
  const newestIdRef = useRef<string | null>(null)

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
    setEvents([])
    newestIdRef.current = null
    followingRef.current = true
  }

  /**
   * Fetch the whole conversation, in order, from the server.
   *
   * The server owns the order and the history. The client's job is to render
   * what it is given — it never sorts, and it no longer keeps the conversation
   * in React state where closing the app erased it.
   */
  const refreshTimeline = useCallback(async () => {
    if (!initData) return
    const response = await fetch('/api/telegram/mini-app/timeline', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ init_data: initData }),
    })
    if (!response.ok) return
    const data = (await response.json().catch(() => ({}))) as {
      events?: TimelineEvent[]
      has_more?: boolean
      oldest_anchor_ms?: number | null
    }
    const server = data.events ?? []
    setEvents((current) => mergeTimeline(current, server))
    setHasMore(Boolean(data.has_more))
    setOldestAnchorMs(data.oldest_anchor_ms ?? null)
  }, [initData])

  /** Load the conversation on open, and whenever the project changes. */
  useEffect(() => {
    if (initData && selectedId) void refreshTimeline()
  }, [initData, selectedId, refreshTimeline])

  /**
   * Keep checking only while something is actually outstanding.
   *
   * An answer being written, or a clip still being listened to, is the only
   * reason to poll. Once everything has settled the polling stops by itself —
   * so an idle app on phone data costs nothing.
   */
  const awaitingWork = useMemo(
    () => events.some((event) =>
      event.payload.kind === 'director_pending' ||
      (event.payload.kind === 'media_upload' && event.payload.stage === 'listening')),
    [events],
  )

  useEffect(() => {
    if (!initData || !selectedId || !awaitingWork) return
    let cancelled = false
    const timer = window.setInterval(() => {
      if (!cancelled) void refreshTimeline()
    }, 3_000)
    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [initData, selectedId, awaitingWork, refreshTimeline])

  /**
   * Follow the bottom, but only when the reader is already there.
   *
   * Always scrolling would yank the page away mid-sentence when a background
   * job finishes; never scrolling is what the old screen did, so a new answer
   * arrived below the fold and had to be hunted for.
   */
  useEffect(() => {
    const node = scrollRef.current
    if (!node || events.length === 0) return

    const newestId = events[events.length - 1].id
    const changed = newestIdRef.current !== null && newestIdRef.current !== newestId
    newestIdRef.current = newestId

    const top = nextScrollTop({
      following: followingRef.current,
      scrollHeight: node.scrollHeight,
      clientHeight: node.clientHeight,
      currentTop: node.scrollTop,
    })
    if (top !== node.scrollTop) node.scrollTop = top
    setShowJump(shouldOfferJump({ following: followingRef.current, newestChanged: changed }))
  }, [events])

  const onScroll = useCallback(() => {
    const node = scrollRef.current
    if (!node) return
    followingRef.current = shouldFollow({
      scrollHeight: node.scrollHeight,
      scrollTop: node.scrollTop,
      clientHeight: node.clientHeight,
    })
    if (followingRef.current) setShowJump(false)
  }, [])

  const jumpToLatest = useCallback(() => {
    const node = scrollRef.current
    if (!node) return
    node.scrollTop = Math.max(0, node.scrollHeight - node.clientHeight)
    followingRef.current = true
    setShowJump(false)
  }, [])

  /** Load older history above, keeping the same message under the eye. */
  const loadOlder = useCallback(async () => {
    const node = scrollRef.current
    if (!initData || !hasMore || oldestAnchorMs === null) return
    const previousHeight = node?.scrollHeight ?? 0
    const previousTop = node?.scrollTop ?? 0

    const response = await fetch('/api/telegram/mini-app/timeline', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ init_data: initData, before_anchor_ms: oldestAnchorMs }),
    })
    if (!response.ok) return
    const data = (await response.json().catch(() => ({}))) as {
      events?: TimelineEvent[]
      has_more?: boolean
      oldest_anchor_ms?: number | null
    }
    setEvents((current) => mergeTimeline(current, data.events ?? []))
    setHasMore(Boolean(data.has_more))
    setOldestAnchorMs(data.oldest_anchor_ms ?? null)

    window.requestAnimationFrame(() => {
      if (node) node.scrollTop = anchorAfterPrepend(previousHeight, node.scrollHeight, previousTop)
    })
  }, [initData, hasMore, oldestAnchorMs])

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
    // The clip is now a real row, so it comes back as part of the one timeline
    // rather than into a separate list with its own ordering.
    void refreshTimeline()
  }

  /**
   * Send a message.
   *
   * The optimistic bubble carries the same `client_event_id` the server
   * stores, so when the server reports the message back it REPLACES the local
   * copy instead of appearing beside it. That id is also what makes a repeated
   * tap safe: the unique index turns the second one into the same job.
   *
   * There is no polling loop here any more. The old one asked a job route 60
   * times and pushed the answer into React state — which is why the answer was
   * lost on brand switch, and why the whole conversation vanished on reload.
   * The timeline poller picks the answer up and puts it in its place.
   */
  const submitMessage = useCallback(async (message: string, reuseClientEventId?: string | null) => {
    if (!selectedProject || !message.trim()) return
    const clientEventId = reuseClientEventId ?? crypto.randomUUID()
    const nowMs = Date.now()

    setSending(true)
    setError(null)
    followingRef.current = true

    const optimistic: TimelineEvent = {
      id: `local:${clientEventId}`,
      kind: 'user_message',
      groupParentId: null,
      occurredAtMs: nowMs,
      side: 'owner',
      brandId: selectedProject.project_id,
      clientEventId,
      payload: { kind: 'user_message', text: message, mediaIds: [], status: 'sent' },
      groupId: `turn:local:${clientEventId}`,
      groupAnchorMs: nowMs,
      memberRank: 0,
      occurredAt: new Date(nowMs).toISOString(),
    }
    setEvents((current) => mergeTimeline([...current, optimistic], []))

    try {
      const response = await fetch('/api/telegram/mini-app/message', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ init_data: initData, message, client_event_id: clientEventId }),
      })
      const data = (await response.json().catch(() => ({}))) as { error?: string; job_id?: string }
      if (!response.ok || !data.job_id) {
        setError(data.error ?? 'NRS could not start that request.')
        return
      }
      // The server now has it; the timeline is the authority from here.
      await refreshTimeline()
    } catch {
      setError('That did not send. Check your connection and try again.')
    } finally {
      setSending(false)
    }
  }, [selectedProject, initData, refreshTimeline])

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
    setDraft('')
    await submitMessage(message)
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

            {/*
              ONE list, oldest at the top, newest at the bottom — the order the
              server built. This used to be three blocks with three orderings,
              which is why a clip from the morning sat below an afternoon
              message and above a clip from an hour earlier.
            */}
            <section className="relative flex-1 overflow-hidden">
              <div
                ref={scrollRef}
                onScroll={onScroll}
                className="h-full overflow-y-auto overscroll-contain pr-0.5"
                style={{ overflowAnchor: 'none' }}
                aria-live="polite"
                aria-label="Conversation"
              >
                {hasMore && (
                  <button
                    type="button"
                    onClick={() => void loadOlder()}
                    className="mx-auto mb-3 block rounded-full border border-white/10 px-4 py-1.5 text-xs text-[var(--tg-theme-hint-color,#82909f)] hover:bg-white/5"
                  >
                    Load earlier
                  </button>
                )}

                {events.length === 0 ? (
                  <div className="rounded-2xl bg-[var(--tg-theme-secondary-bg-color,#17212b)] p-5 text-sm text-[var(--tg-theme-hint-color,#82909f)]">
                    Ask the Director to move the selected brand toward its active goal, or send a video and it will write from that.
                  </div>
                ) : (
                  <TimelineView
                    events={events}
                    onRetry={(text, clientEventId) => void submitMessage(text, clientEventId)}
                  />
                )}
              </div>

              {showJump && (
                <button
                  type="button"
                  onClick={jumpToLatest}
                  className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-[var(--tg-theme-button-color,#2aabee)] px-4 py-2 text-xs font-medium text-[var(--tg-theme-button-text-color,#fff)] shadow-lg"
                >
                  New below ↓
                </button>
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

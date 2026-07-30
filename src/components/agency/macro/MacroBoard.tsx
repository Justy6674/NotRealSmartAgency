'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import {
  AlertTriangle,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Clock,
  Loader2,
  PlugZap,
  RefreshCw,
  ShieldAlert,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAgencyStore } from '@/stores/agency-store'
import type { BoardDecision, BoardProject, MacroBoard as MacroBoardData } from '@/lib/macro/board'

const STATE_STYLES: Record<BoardProject['state'], { dot: string; label: string }> = {
  attention: { dot: 'bg-red-500', label: 'Needs you' },
  waiting: { dot: 'bg-amber-500', label: 'Waiting on you' },
  steady: { dot: 'bg-emerald-500', label: 'Running' },
  quiet: { dot: 'bg-muted-foreground/40', label: 'Nothing planned' },
}

const URGENCY_STYLES: Record<
  BoardDecision['urgency'],
  { chip: string; label: string; Icon: typeof ShieldAlert }
> = {
  regulated: {
    chip: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/25',
    label: 'Rules',
    Icon: ShieldAlert,
  },
  blocked: {
    chip: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/25',
    label: 'Stuck',
    Icon: AlertTriangle,
  },
  waiting: {
    chip: 'bg-muted text-muted-foreground border-border',
    label: 'Waiting',
    Icon: Clock,
  },
}

export function MacroBoard() {
  const router = useRouter()
  const setBrand = useAgencyStore((s) => s.setBrand)
  const setPendingComposerText = useAgencyStore((s) => s.setPendingComposerText)
  const setConversation = useAgencyStore((s) => s.setConversation)

  const [data, setData] = useState<MacroBoardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = async () => {
    setError(null)
    try {
      const res = await fetch('/api/macro/board', { cache: 'no-store' })
      if (!res.ok) throw new Error('unavailable')
      setData(await res.json())
    } catch {
      setError('Could not load your projects just now. Try again in a moment.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /** Open the Director on this project with the suggestion already written. */
  const openDirector = (projectId: string, text: string) => {
    setBrand(projectId)
    setConversation(null)
    setPendingComposerText(text)
    router.push('/agency/chat')
  }

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center py-24 text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        Gathering your projects…
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 py-24">
        <p className="text-sm text-muted-foreground">{error}</p>
        <button
          onClick={() => { setLoading(true); void load() }}
          className="inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm hover:bg-accent"
        >
          <RefreshCw className="h-3.5 w-3.5" /> Try again
        </button>
      </div>
    )
  }

  const { projects, decisions, connectionsKnown } = data
  const needingYou = projects.filter((p) => p.state === 'attention').length

  return (
    <div className="mx-auto w-full max-w-6xl px-6 py-6">
      {/* ── Heading ───────────────────────────────────────────────────────── */}
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-foreground">
            Today across everything
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {decisions.length === 0
              ? `All ${projects.length} projects are running. Nothing needs you.`
              : needingYou > 0
                ? `${decisions.length} ${decisions.length === 1 ? 'thing needs' : 'things need'} a decision — ${needingYou} ${needingYou === 1 ? 'project' : 'projects'} can't move without you.`
                : `${decisions.length} ${decisions.length === 1 ? 'thing is' : 'things are'} waiting on you.`}
          </p>
        </div>
        <button
          onClick={() => { setLoading(true); void load() }}
          className="inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-xs text-muted-foreground hover:bg-accent"
        >
          <RefreshCw className="h-3.5 w-3.5" /> Refresh
        </button>
      </div>

      {/* ── What needs you ────────────────────────────────────────────────── */}
      <section className="mb-8">
        {decisions.length === 0 ? (
          <div className="flex items-center gap-3 rounded-lg border bg-card p-5">
            <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-500" />
            <p className="text-sm text-foreground">
              Nothing is waiting on you. Every project has content planned and going out.
            </p>
          </div>
        ) : (
          <ul className="divide-y overflow-hidden rounded-lg border bg-card">
            {decisions.map((d) => {
              const style = URGENCY_STYLES[d.urgency]
              return (
                <li key={d.id}>
                  <button
                    onClick={() => openDirector(d.projectId, d.suggestedAction)}
                    className="group flex w-full items-start gap-3 p-4 text-left transition hover:bg-accent/50"
                  >
                    <span
                      className={cn(
                        'mt-0.5 inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium',
                        style.chip,
                      )}
                    >
                      <style.Icon className="h-3 w-3" />
                      {style.label}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-baseline gap-x-2">
                        <span className="text-sm font-medium text-foreground">{d.headline}</span>
                        <span className="text-xs text-muted-foreground">· {d.projectName}</span>
                      </span>
                      <span className="mt-0.5 block text-xs text-muted-foreground">{d.detail}</span>
                    </span>
                    <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground opacity-0 transition group-hover:opacity-100" />
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      {/* ── Every project ─────────────────────────────────────────────────── */}
      <section>
        <h2 className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          All {projects.length} projects
        </h2>

        {!connectionsKnown && (
          <p className="mb-3 text-xs text-muted-foreground">
            Social connections could not be checked just now, so account numbers show as{' '}
            <span className="font-medium text-foreground">?</span> rather than none.
          </p>
        )}

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((p) => (
            <button
              key={p.id}
              onClick={() => openDirector(p.id, p.suggestedAction)}
              className="group flex flex-col rounded-lg border bg-card p-4 text-left transition hover:border-foreground/20 hover:bg-accent/40"
            >
              <div className="flex items-start gap-3">
                {p.logoUrl ? (
                  <Image
                    src={p.logoUrl}
                    alt=""
                    width={32}
                    height={32}
                    className="h-8 w-8 shrink-0 rounded object-contain"
                    unoptimized
                  />
                ) : (
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-muted text-xs font-semibold text-muted-foreground">
                    {p.name.slice(0, 2).toUpperCase()}
                  </span>
                )}
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5">
                    <span className="truncate text-sm font-medium text-foreground">{p.name}</span>
                    {p.regulated && (
                      <ShieldAlert
                        className="h-3.5 w-3.5 shrink-0 text-muted-foreground"
                        aria-label="Advertising rules apply"
                      />
                    )}
                  </span>
                  <span className="mt-0.5 flex items-center gap-1.5">
                    <span className={cn('h-1.5 w-1.5 rounded-full', STATE_STYLES[p.state].dot)} />
                    <span className="text-xs text-muted-foreground">
                      {STATE_STYLES[p.state].label}
                    </span>
                  </span>
                </span>
              </div>

              <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
                <Pip
                  icon={<CalendarDays className="h-3 w-3" />}
                  value={String(p.scheduledThisWeek)}
                  label="this week"
                />
                <Pip
                  icon={<Clock className="h-3 w-3" />}
                  value={String(p.draftsWaiting + p.awaitingApproval)}
                  label="waiting"
                />
                <Pip
                  icon={<PlugZap className="h-3 w-3" />}
                  value={p.accountCount === null ? '?' : String(p.accountCount)}
                  label={p.accountCount === null ? 'not known' : 'connected'}
                  muted={p.accountCount === null}
                />
              </dl>

              {(p.needsReconnecting.length > 0 || p.failed > 0 || p.unreviewedRegulated > 0) && (
                <p className="mt-3 text-xs text-amber-600 dark:text-amber-400">
                  {p.unreviewedRegulated > 0
                    ? `${p.unreviewedRegulated} scheduled without your sign-off`
                    : p.needsReconnecting.length > 0
                      ? `${p.needsReconnecting.join(', ')} needs reconnecting`
                      : `${p.failed} did not go out`}
                </p>
              )}
            </button>
          ))}
        </div>
      </section>
    </div>
  )
}

function Pip({
  icon,
  value,
  label,
  muted,
}: {
  icon: React.ReactNode
  value: string
  label: string
  muted?: boolean
}) {
  return (
    <div className="rounded-md bg-muted/50 py-1.5">
      <dt className="sr-only">{label}</dt>
      <dd
        className={cn(
          'flex items-center justify-center gap-1 text-sm font-semibold',
          muted ? 'text-muted-foreground' : 'text-foreground',
        )}
      >
        <span className="text-muted-foreground">{icon}</span>
        {value}
      </dd>
      <p className="mt-0.5 text-[10px] leading-none text-muted-foreground">{label}</p>
    </div>
  )
}

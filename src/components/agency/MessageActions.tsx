'use client'

import { useMemo, useState } from 'react'
import {
  BookmarkPlus, Mail, Forward, GitCompareArrows, RefreshCw,
  ListChecks, Copy, Brain, Maximize2, FileDown, Check, Loader2, X, CircleHelp, PenLine
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { useAgencyStore } from '@/stores/agency-store'
import { useComposeDeskStore } from '@/stores/compose-desk-store'
import { getNamespace } from '@/lib/ruflo/namespaces'
import { extractCaptionDraftFromMessage } from '@/lib/desk/extract-caption-draft'

interface MessageActionsProps {
  content: string
  onRegenerate?: () => void
  /** Rail uses brand paper tokens and surfaces caption apply first */
  variant?: 'default' | 'rail'
}

type ActionState = 'idle' | 'loading' | 'done' | 'error'

export function MessageActions({ content, onRegenerate, variant = 'default' }: MessageActionsProps) {
  const router = useRouter()
  const { activeBrandId, activeAgentType } = useAgencyStore()
  const captionDraft = useMemo(() => extractCaptionDraftFromMessage(content), [content])
  const [states, setStates] = useState<Record<string, ActionState>>({})
  const [showEmailInput, setShowEmailInput] = useState(false)
  const [emailTo, setEmailTo] = useState('')
  const [emailNote, setEmailNote] = useState('')
  const [showFullReport, setShowFullReport] = useState(false)
  const [todoCount, setTodoCount] = useState<number | null>(null)

  const setState = (key: string, state: ActionState) =>
    setStates(s => ({ ...s, [key]: state }))

  const getTitle = () => {
    const firstLine = content.split('\n').find(l => l.trim())
    return firstLine?.replace(/^#+\s*/, '').slice(0, 80) || 'Agency Report'
  }

  // 0. Add to caption — one press into Compose
  const handleAddToCaption = () => {
    if (!activeBrandId || !captionDraft) return
    setState('addCaption', 'loading')
    try {
      useComposeDeskStore.getState().setPendingCaptionApply({
        brandId: activeBrandId,
        caption: captionDraft.caption,
        hashtags: captionDraft.hashtags,
        platforms: captionDraft.platforms.length ? captionDraft.platforms : undefined,
        hashtagsAreSuggested: captionDraft.hashtagsAreSuggested,
      })
      if (!window.location.pathname.startsWith('/agency/social')) {
        router.push('/agency/social')
      }
      setState('addCaption', 'done')
    } catch {
      setState('addCaption', 'error')
    }
  }

  // 1. Save to Outputs
  const handleSave = async () => {
    if (!activeBrandId) return
    setState('save', 'loading')
    try {
      const res = await fetch('/api/outputs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brandId: activeBrandId,
          title: getTitle(),
          content,
          outputType: 'other',
        }),
      })
      setState('save', res.ok ? 'done' : 'error')
    } catch { setState('save', 'error') }
  }

  // 2. Email to Me
  const handleEmailMe = async () => {
    setState('emailMe', 'loading')
    try {
      const res = await fetch('/api/email-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, subject: getTitle() }),
      })
      setState('emailMe', res.ok ? 'done' : 'error')
    } catch { setState('emailMe', 'error') }
  }

  // 3. Email to Someone
  const handleEmailSomeone = async () => {
    if (!emailTo) return
    setState('emailSomeone', 'loading')
    try {
      const res = await fetch('/api/email-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, subject: getTitle(), to: emailTo, note: emailNote }),
      })
      setState('emailSomeone', res.ok ? 'done' : 'error')
      if (res.ok) setShowEmailInput(false)
    } catch { setState('emailSomeone', 'error') }
  }

  // 4. Save as Baseline
  const handleBaseline = async () => {
    if (!activeBrandId) return
    setState('baseline', 'loading')
    try {
      const res = await fetch('/api/outputs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brandId: activeBrandId,
          title: `[Baseline] ${getTitle()}`,
          content,
          outputType: 'other',
          metadata: { baseline: true, baselineDate: new Date().toISOString() },
        }),
      })
      setState('baseline', res.ok ? 'done' : 'error')
    } catch { setState('baseline', 'error') }
  }

  // 5. Re-analyse
  const handleReanalyse = () => {
    if (onRegenerate) {
      onRegenerate()
    }
  }

  // 6. Generate Todo
  const handleTodo = async () => {
    if (!activeBrandId) return
    setState('todo', 'loading')
    try {
      const res = await fetch('/api/extract-todos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, brandId: activeBrandId }),
      })
      if (res.ok) {
        const data = await res.json()
        setTodoCount(data.count)
        setState('todo', 'done')
      } else {
        setState('todo', 'error')
      }
    } catch { setState('todo', 'error') }
  }

  // 7. Copy
  const handleCopy = async () => {
    setState('copy', 'loading')
    try {
      await navigator.clipboard.writeText(content)
      setState('copy', 'done')
    } catch { setState('copy', 'error') }
  }

  // 8. Save to Memory
  const handleMemory = async () => {
    setState('memory', 'loading')
    try {
      // Get brand slug from the store
      const brandsRes = await fetch('/api/brands')
      const brands = await brandsRes.json()
        const brand = brands.find((b: { id: string }) => b.id === activeBrandId)
        if (brand) {
          const namespace = getNamespace(brand.slug, activeAgentType)
          await fetch('/api/memories', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              brandId: activeBrandId,
              namespace,
              key: `Report summary: ${getTitle()}`,
              value: content.slice(0, 500),
              tags: ['saved_report'],
            }),
          })
        }
      setState('memory', 'done')
    } catch { setState('memory', 'error') }
  }

  // 9. Open in Full
  const handleFullScreen = () => {
    setShowFullReport(true)
  }

  // 10. Export PDF
  const handleExport = () => {
    const printWindow = window.open('', '_blank')
    if (printWindow) {
      printWindow.document.write(`
        <html><head><title>${getTitle()}</title>
        <style>body{font-family:'IBM Plex Sans',system-ui,sans-serif;max-width:800px;margin:40px auto;padding:0 24px;color:#1a1a1a;line-height:1.7;font-size:14px;}h1,h2,h3{margin-top:24px;}h1{font-size:22px;}h2{font-size:18px;}h3{font-size:15px;}hr{border:none;border-top:1px solid #ddd;margin:20px 0;}strong{font-weight:600;}</style>
        </head><body>${content.replace(/^### (.+)$/gm, '<h3>$1</h3>').replace(/^## (.+)$/gm, '<h2>$1</h2>').replace(/^# (.+)$/gm, '<h1>$1</h1>').replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/^- (.+)$/gm, '<li>$1</li>').replace(/\n/g, '<br>')}</body></html>
      `)
      printWindow.document.close()
      printWindow.print()
    }
  }

  const actions: { key: string; icon: typeof Copy; label: string; onClick: () => void; extra?: string }[] = [
    { key: 'save', icon: BookmarkPlus, label: 'Save', onClick: handleSave },
    { key: 'emailMe', icon: Mail, label: 'Email Me', onClick: handleEmailMe },
    { key: 'emailSomeone', icon: Forward, label: 'Send to...', onClick: () => setShowEmailInput(!showEmailInput) },
    { key: 'baseline', icon: GitCompareArrows, label: variant === 'rail' ? 'Base' : 'Baseline', onClick: handleBaseline },
    { key: 'reanalyse', icon: RefreshCw, label: 'Re-analyse', onClick: handleReanalyse },
    { key: 'todo', icon: ListChecks, label: todoCount !== null ? `${todoCount} tasks` : 'Todo', onClick: handleTodo },
    { key: 'copy', icon: Copy, label: 'Copy', onClick: handleCopy },
    { key: 'memory', icon: Brain, label: 'Remember', onClick: handleMemory },
    { key: 'fullscreen', icon: Maximize2, label: 'Full View', onClick: handleFullScreen },
    { key: 'export', icon: FileDown, label: 'PDF', onClick: handleExport },
    { key: 'help', icon: CircleHelp, label: 'Help', onClick: () => window.open('https://help.notrealsmart.com.au', '_blank') },
  ]

  const visibleActions =
    variant === 'rail'
      ? actions.filter((a) => ['save', 'emailMe', 'emailSomeone', 'baseline'].includes(a.key))
      : actions

  const secondaryButtonClass = cn(
    'flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium transition-colors shrink-0',
    variant === 'rail'
      ? 'text-[var(--ink-3)] hover:bg-[var(--brand-wash)] hover:text-[var(--brand-deep)]'
      : 'text-muted-foreground hover:bg-muted hover:text-foreground',
  )

  const secondaryDoneClass =
    variant === 'rail'
      ? 'bg-[var(--brand-wash)] text-[var(--brand-deep)]'
      : 'bg-emerald-500/10 text-emerald-500'

  const secondaryErrorClass =
    variant === 'rail' ? 'bg-[var(--care-wash)] text-[var(--care)]' : 'bg-red-500/10 text-red-400'

  return (
    <>
      <div className="flex items-center gap-1 overflow-x-auto py-1.5 scrollbar-none">
        {captionDraft && (
          <button
            type="button"
            onClick={handleAddToCaption}
            disabled={states.addCaption === 'loading'}
            className={cn(
              'flex shrink-0 items-center gap-1.5 rounded-[8px] px-3 py-1.5 text-[11px] font-semibold transition-colors',
              states.addCaption === 'done' && secondaryDoneClass,
              states.addCaption === 'error' && secondaryErrorClass,
            )}
            style={
              states.addCaption === 'idle' || states.addCaption === 'loading'
                ? {
                    background: 'var(--brand-deep)',
                    color: 'var(--brand-ink)',
                  }
                : undefined
            }
          >
            {states.addCaption === 'loading' ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : states.addCaption === 'done' ? (
              <Check className="h-3 w-3" />
            ) : (
              <PenLine className="h-3 w-3" />
            )}
            <span>{states.addCaption === 'done' ? 'Added' : variant === 'rail' ? 'Use on post' : 'Add to caption'}</span>
          </button>
        )}

        {visibleActions.map(({ key, icon: Icon, label, onClick }) => {
          const state = states[key] ?? 'idle'
          return (
            <button
              key={key}
              onClick={onClick}
              disabled={state === 'loading'}
              className={cn(
                secondaryButtonClass,
                state === 'done' && secondaryDoneClass,
                state === 'error' && secondaryErrorClass,
              )}
            >
              {state === 'loading' ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : state === 'done' ? (
                <Check className="h-3 w-3" />
              ) : (
                <Icon className="h-3 w-3" />
              )}
              <span>{label}</span>
            </button>
          )
        })}
      </div>

      {/* Email to someone input */}
      {showEmailInput && (
        <div className="flex items-center gap-2 py-1.5">
          <input
            type="email"
            value={emailTo}
            onChange={e => setEmailTo(e.target.value)}
            placeholder="recipient@email.com"
            className="flex-1 rounded-md border border-border bg-background px-2 py-1 text-xs"
          />
          <input
            type="text"
            value={emailNote}
            onChange={e => setEmailNote(e.target.value)}
            placeholder="Optional note"
            className="flex-1 rounded-md border border-border bg-background px-2 py-1 text-xs"
          />
          <button
            onClick={handleEmailSomeone}
            disabled={!emailTo || states.emailSomeone === 'loading'}
            className="rounded-md bg-primary px-2 py-1 text-xs text-primary-foreground disabled:opacity-50"
          >
            {states.emailSomeone === 'loading' ? 'Sending...' : 'Send'}
          </button>
          <button onClick={() => setShowEmailInput(false)} className="text-muted-foreground hover:text-foreground">
            <X className="h-3 w-3" />
          </button>
        </div>
      )}

      {/* Full-screen report modal */}
      {showFullReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setShowFullReport(false)}>
          <div className="relative max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-xl bg-card p-8 shadow-2xl" onClick={e => e.stopPropagation()}>
            <button
              onClick={() => setShowFullReport(false)}
              className="absolute right-4 top-4 rounded-md p-1 text-muted-foreground hover:text-foreground"
            >
              <X className="h-5 w-5" />
            </button>
            <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap">
              {content}
            </div>
          </div>
        </div>
      )}
    </>
  )
}

'use client'

import { useState } from 'react'
import {
  BookmarkPlus, Mail, Forward, GitCompareArrows, RefreshCw,
  ListChecks, Copy, Brain, Maximize2, FileDown, Check, Loader2, X
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAgencyStore } from '@/stores/agency-store'
import { memoryStore } from '@/lib/ruflo/client'
import { getNamespace } from '@/lib/ruflo/namespaces'

interface MessageActionsProps {
  content: string
  onRegenerate?: () => void
}

type ActionState = 'idle' | 'loading' | 'done' | 'error'

export function MessageActions({ content, onRegenerate }: MessageActionsProps) {
  const { activeBrandId, activeAgentType } = useAgencyStore()
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
        await memoryStore(
          `Report summary: ${getTitle()}`,
          content.slice(0, 500),
          namespace
        )
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
    { key: 'baseline', icon: GitCompareArrows, label: 'Baseline', onClick: handleBaseline },
    { key: 'reanalyse', icon: RefreshCw, label: 'Re-analyse', onClick: handleReanalyse },
    { key: 'todo', icon: ListChecks, label: todoCount !== null ? `${todoCount} tasks` : 'Todo', onClick: handleTodo },
    { key: 'copy', icon: Copy, label: 'Copy', onClick: handleCopy },
    { key: 'memory', icon: Brain, label: 'Remember', onClick: handleMemory },
    { key: 'fullscreen', icon: Maximize2, label: 'Full View', onClick: handleFullScreen },
    { key: 'export', icon: FileDown, label: 'PDF', onClick: handleExport },
  ]

  return (
    <>
      <div className="flex items-center gap-1 overflow-x-auto py-1.5 scrollbar-none">
        {actions.map(({ key, icon: Icon, label, onClick }) => {
          const state = states[key] ?? 'idle'
          return (
            <button
              key={key}
              onClick={onClick}
              disabled={state === 'loading'}
              className={cn(
                'flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium transition-colors shrink-0',
                state === 'done'
                  ? 'bg-emerald-500/10 text-emerald-500'
                  : state === 'error'
                  ? 'bg-red-500/10 text-red-400'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
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

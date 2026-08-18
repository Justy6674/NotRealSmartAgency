'use client'

import { useState, type FormEvent, type KeyboardEvent } from 'react'
import { Loader2, SendHorizontal } from 'lucide-react'

/**
 * The note box under the post's history.
 *
 * A post is approved by a person before it goes anywhere, so the thing two
 * people need most on this screen is somewhere to say "change the second line"
 * against THIS post — not in a chat window that has drifted three posts on by
 * the time anyone reads it.
 *
 * Enter sends, Shift+Enter starts a new line. The failure is shown here rather
 * than thrown away, because losing what someone just typed is the one thing a
 * comment box must never do — the text stays in the field on a failure.
 */
export function ActivityCommentBox({
  onSubmit,
  disabled,
  placeholder = 'Leave a note on this post…',
}: {
  onSubmit: (body: string) => Promise<void>
  disabled?: boolean
  placeholder?: string
}) {
  const [value, setValue] = useState('')
  const [sending, setSending] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)

  const canSend = value.trim().length > 0 && !sending && !disabled

  async function send() {
    if (!canSend) return
    setSending(true)
    setProblem(null)
    try {
      await onSubmit(value)
      setValue('')
    } catch {
      // The words stay in the box. Whatever went wrong, retyping the note is
      // not part of the fix.
      setProblem('That note did not save. Try again in a moment.')
    } finally {
      setSending(false)
    }
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    void send()
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      void send()
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="shrink-0 border-t px-[15px] py-[11px]"
      style={{
        borderColor: 'var(--line, oklch(0.915 0.007 240))',
        background: 'var(--panel, oklch(1 0 0))',
      }}
    >
      {problem && (
        <p className="mb-[7px] text-[11.5px]" style={{ color: 'var(--st-fail, oklch(0.58 0.17 27))' }}>
          {problem}
        </p>
      )}
      <div className="flex items-end gap-[8px]">
        <textarea
          value={value}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={handleKeyDown}
          rows={2}
          disabled={disabled}
          placeholder={placeholder}
          aria-label="Leave a note on this post"
          className="min-h-[42px] flex-1 resize-none rounded-[8px] border px-[11px] py-[8px] text-[13px] leading-[1.5] outline-none disabled:opacity-60"
          style={{
            borderColor: 'var(--line, oklch(0.915 0.007 240))',
            background: 'var(--panel, oklch(1 0 0))',
            color: 'var(--ink, oklch(0.20 0.014 240))',
          }}
        />
        <button
          type="submit"
          disabled={!canSend}
          className="flex h-[38px] shrink-0 items-center gap-[7px] rounded-[8px] px-[12px] text-[12.5px] font-semibold transition-opacity duration-150 disabled:opacity-40"
          style={{
            background: 'var(--brand-deep, oklch(0.33 0.07 55))',
            color: 'var(--brand-ink, oklch(1 0 0))',
          }}
        >
          {sending ? (
            <Loader2 className="h-[14px] w-[14px] animate-spin" aria-hidden />
          ) : (
            <SendHorizontal className="h-[14px] w-[14px]" aria-hidden />
          )}
          Send
        </button>
      </div>
    </form>
  )
}

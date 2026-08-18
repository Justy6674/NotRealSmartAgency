'use client'

import { useState } from 'react'
import { Loader2, Send, Archive, CheckCheck, ExternalLink } from 'lucide-react'
import {
  replyToConversation,
  updateConversation,
  useConversationMessages,
  type SendResult,
} from '@/hooks/useEngagement'
import {
  absoluteTime,
  displayHandle,
  displayName,
  platformLabel,
  relativeTime,
  type InboxItem,
} from '@/components/agency/inbox/types'

/**
 * One conversation, and the box the answer is typed into.
 *
 * ── Why the reply box lives here and is shared ─────────────────────────
 * Every reply on this desk — a comment, a private message, a mention, a review
 * — goes through the same review before it leaves, and a refusal is an ANSWER
 * rather than an error: the words breach the rules the business advertises
 * under, and here is which part. Writing that treatment four times would mean
 * four chances to render it as a red failure, so `ReplyBox` is written once and
 * every surface uses it.
 */

const INK = 'var(--ink, oklch(0.20 0.014 240))'
const INK_3 = 'var(--ink-3, oklch(0.615 0.011 240))'
const LINE = 'var(--line, oklch(0.915 0.007 240))'
const BRAND_DEEP = 'var(--brand-deep, oklch(0.33 0.0209 240))'
const BRAND_INK = 'var(--brand-ink, oklch(1 0 0))'
const CARE = 'var(--care, oklch(0.52 0.150 25))'
const CARE_WASH = 'var(--care-wash, oklch(0.965 0.028 25))'

export function ReplyBox({
  placeholder,
  send,
  onSent,
  hint,
}: {
  placeholder: string
  send: (message: string) => Promise<SendResult>
  onSent?: () => void
  hint?: string
}) {
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [refused, setRefused] = useState<string | null>(null)
  const [failed, setFailed] = useState<string | null>(null)

  const submit = async () => {
    if (!text.trim() || sending) return
    setSending(true)
    setRefused(null)
    setFailed(null)
    const result = await send(text.trim())
    setSending(false)
    if (result.ok) {
      setText('')
      onSent?.()
      return
    }
    if (result.blocked) setRefused(result.reason ?? 'This cannot be sent as written.')
    else setFailed(result.reason ?? 'That could not be sent just now. Nothing was sent.')
  }

  return (
    <div className="space-y-2">
      {refused ? (
        // A refusal is the system working. It is shown in the healthcare
        // colour, not the failure colour, and it names what to change.
        <div
          className="rounded-[6px] px-3 py-2 text-[12.5px]"
          style={{ background: CARE_WASH, color: CARE }}
        >
          <span className="font-[600]">Not sent.</span> {refused}
        </div>
      ) : null}
      {failed ? (
        <div className="text-[12.5px]" style={{ color: INK_3 }}>
          {failed}
        </div>
      ) : null}
      <div className="flex items-end gap-2">
        <textarea
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder={placeholder}
          rows={2}
          className="min-h-[54px] flex-1 resize-y rounded-[6px] border bg-transparent px-3 py-2 text-[13px] outline-none"
          style={{ borderColor: LINE, color: INK }}
        />
        <button
          type="button"
          onClick={submit}
          disabled={!text.trim() || sending}
          className="flex items-center gap-1.5 rounded-[6px] px-3 py-2 text-[12.5px] font-[600] disabled:opacity-40"
          style={{ background: BRAND_DEEP, color: BRAND_INK }}
        >
          {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
          Send
        </button>
      </div>
      <p className="text-[11.5px]" style={{ color: INK_3 }}>
        {hint ?? 'Every reply is checked against this business’s advertising rules before it goes out.'}
      </p>
    </div>
  )
}

export function ConversationThread({
  brandId,
  item,
  onChanged,
}: {
  brandId: string
  item: InboxItem | null
  onChanged?: () => void
}) {
  const { messages, loading, problem, refresh } = useConversationMessages(brandId, item)
  const [working, setWorking] = useState(false)

  if (!item) {
    return (
      <div className="flex h-full items-center justify-center p-8 text-center">
        <p className="text-[13px]" style={{ color: INK_3 }}>
          Pick a conversation to read it.
        </p>
      </div>
    )
  }

  const act = async (action: 'mark_read' | 'archive') => {
    setWorking(true)
    await updateConversation({
      brandId,
      conversationId: item.id,
      accountId: item.accountId,
      action,
    })
    setWorking(false)
    onChanged?.()
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="shrink-0 border-b px-4 py-3" style={{ borderColor: LINE }}>
        <div className="flex items-center gap-2">
          <div className="min-w-0">
            <p className="truncate text-[14px] font-[600]" style={{ color: INK }}>
              {displayName(item)}
            </p>
            <p className="truncate text-[11.5px]" style={{ color: INK_3 }}>
              {platformLabel(item.platform)}
              {displayHandle(item) ? ` · ${displayHandle(item)}` : ''}
              {item.updatedAt ? ` · ${relativeTime(item.updatedAt)}` : ''}
            </p>
          </div>
          <div className="ml-auto flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => act('mark_read')}
              disabled={working}
              className="flex items-center gap-1 rounded-[5px] border px-2 py-1 text-[11.5px] disabled:opacity-40"
              style={{ borderColor: LINE, color: INK_3 }}
            >
              <CheckCheck className="h-3 w-3" /> Mark read
            </button>
            <button
              type="button"
              onClick={() => act('archive')}
              disabled={working}
              className="flex items-center gap-1 rounded-[5px] border px-2 py-1 text-[11.5px] disabled:opacity-40"
              style={{ borderColor: LINE, color: INK_3 }}
            >
              <Archive className="h-3 w-3" /> Archive
            </button>
            {item.url ? (
              <a
                href={item.url}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1 rounded-[5px] border px-2 py-1 text-[11.5px]"
                style={{ borderColor: LINE, color: INK_3 }}
              >
                <ExternalLink className="h-3 w-3" /> Open
              </a>
            ) : null}
          </div>
        </div>
      </header>

      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-4 py-3">
        {loading ? (
          <p className="text-[12.5px]" style={{ color: INK_3 }}>Opening the conversation…</p>
        ) : problem ? (
          <p className="text-[12.5px]" style={{ color: INK_3 }}>{problem}</p>
        ) : messages.length === 0 ? (
          <p className="text-[12.5px]" style={{ color: INK_3 }}>
            Nothing has been said in this conversation yet.
          </p>
        ) : (
          messages.map((message) => (
            <div
              key={message.id}
              className={`max-w-[80%] rounded-[8px] px-3 py-2 text-[13px] ${message.incoming ? '' : 'ml-auto'}`}
              style={{
                background: message.incoming
                  ? 'var(--line-soft, oklch(0.950 0.005 240))'
                  : 'var(--brand-wash, oklch(0.966 0.0068 240))',
                color: INK,
              }}
              title={message.at ? absoluteTime(message.at) : undefined}
            >
              {message.text || (message.attachmentUrl ? 'Sent an attachment' : '—')}
              {message.at ? (
                <span className="mt-1 block text-[10.5px]" style={{ color: INK_3 }}>
                  {relativeTime(message.at)}
                </span>
              ) : null}
            </div>
          ))
        )}
      </div>

      <div className="shrink-0 border-t px-4 py-3" style={{ borderColor: LINE }}>
        <ReplyBox
          placeholder={`Reply to ${displayName(item)}…`}
          send={(message) =>
            replyToConversation({
              brandId,
              conversationId: item.id,
              accountId: item.accountId,
              message,
            })
          }
          onSent={() => {
            void refresh()
            onChanged?.()
          }}
        />
      </div>
    </div>
  )
}

'use client'

import { useState } from 'react'
import { AtSign, ExternalLink, Loader2 } from 'lucide-react'
import { replyToMention, useMentions } from '@/hooks/useEngagement'
import { relativeTime } from '@/components/agency/inbox/types'
import { ReplyBox } from './ConversationThread'

/**
 * Where somebody else has named the business.
 *
 * ── Say what this covers, not what it is called ────────────────────────
 * The listing behind this is LinkedIn only today, and answering a mention is
 * possible on Instagram only. Calling the tab "Mentions" and letting a business
 * whose mentions are all on Instagram read an empty list as "nobody is talking
 * about us" is the exact sort of quiet wrongness this desk exists to stop, so
 * the coverage sentence is printed above the list rather than buried in a note.
 */

const INK = 'var(--ink, oklch(0.20 0.014 240))'
const INK_3 = 'var(--ink-3, oklch(0.615 0.011 240))'
const LINE = 'var(--line, oklch(0.915 0.007 240))'

export function MentionsList({ brandId }: { brandId: string }) {
  const { mentions, coverage, problem, loading, refresh } = useMentions(brandId)
  const [replyingTo, setReplyingTo] = useState<string | null>(null)

  return (
    <div className="space-y-3 p-4">
      {coverage ? (
        <p className="text-[12px]" style={{ color: INK_3 }}>{coverage}</p>
      ) : null}

      {loading ? (
        <div className="flex items-center gap-2">
          <Loader2 className="h-3.5 w-3.5 animate-spin" style={{ color: INK_3 }} />
          <span className="text-[12.5px]" style={{ color: INK_3 }}>Looking for mentions…</span>
        </div>
      ) : problem ? (
        <p className="text-[12.5px]" style={{ color: INK_3 }}>{problem}</p>
      ) : mentions.length === 0 ? (
        <p className="text-[12.5px]" style={{ color: INK_3 }}>
          Nobody has tagged you on a channel we can read yet.
        </p>
      ) : (
        mentions.map((mention) => (
          <div key={mention.id} className="rounded-[8px] border px-4 py-3" style={{ borderColor: LINE }}>
            <div className="flex items-baseline gap-2">
              <AtSign className="h-3.5 w-3.5" style={{ color: INK_3 }} />
              <span className="text-[12.5px] font-[600]" style={{ color: INK }}>
                {mention.authorName ?? 'Someone'}
              </span>
              {mention.createdAt ? (
                <span className="text-[11px]" style={{ color: INK_3 }}>
                  {relativeTime(mention.createdAt)}
                </span>
              ) : null}
              {mention.url ? (
                <a
                  href={mention.url}
                  target="_blank"
                  rel="noreferrer"
                  className="ml-auto flex items-center gap-1 text-[11.5px]"
                  style={{ color: INK_3 }}
                >
                  <ExternalLink className="h-3 w-3" /> Open
                </a>
              ) : null}
            </div>
            <p className="mt-1 text-[13px]" style={{ color: INK }}>{mention.message || '—'}</p>

            {mention.accountId && mention.mediaId ? (
              <div className="mt-2">
                <button
                  type="button"
                  onClick={() => setReplyingTo(replyingTo === mention.id ? null : mention.id)}
                  className="rounded-[5px] border px-2 py-1 text-[11.5px]"
                  style={{ borderColor: LINE, color: INK_3 }}
                >
                  Reply
                </button>
                {replyingTo === mention.id ? (
                  <div className="mt-2">
                    <ReplyBox
                      placeholder="Write your reply…"
                      send={(message) =>
                        replyToMention({
                          brandId,
                          accountId: mention.accountId as string,
                          mediaId: mention.mediaId as string,
                          message,
                        })
                      }
                      onSent={() => {
                        setReplyingTo(null)
                        void refresh()
                      }}
                    />
                  </div>
                ) : null}
              </div>
            ) : (
              <p className="mt-2 text-[11.5px]" style={{ color: INK_3 }}>
                This one has to be answered on the channel itself.
              </p>
            )}
          </div>
        ))
      )}
    </div>
  )
}

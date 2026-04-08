'use client'

import { useState } from 'react'
import { Send } from 'lucide-react'

interface Comment {
  author: string
  text: string
  timestamp: string
}

interface CommentThreadProps {
  postId: string
  comments: Comment[]
  onCommentAdded: () => void
}

export function CommentThread({ postId, comments, onCommentAdded }: CommentThreadProps) {
  const [newComment, setNewComment] = useState('')
  const [saving, setSaving] = useState(false)

  const rawId = postId.replace(/^(post|output)-/, '')

  const handleSubmit = async () => {
    if (!newComment.trim()) return
    setSaving(true)
    try {
      // Save comment to post metadata
      await fetch('/api/scheduled-posts', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: rawId,
          metadata: {
            comments: [
              ...comments,
              { author: 'You', text: newComment.trim(), timestamp: new Date().toISOString() },
            ],
          },
        }),
      })
      setNewComment('')
      onCommentAdded()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-2">
      <span className="text-[10px] font-medium text-muted-foreground">Comments</span>

      {comments.length > 0 ? (
        <div className="space-y-1.5 max-h-32 overflow-y-auto">
          {comments.map((c, i) => (
            <div key={i} className="rounded-md bg-muted/30 px-2.5 py-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-medium">{c.author}</span>
                <span className="text-[8px] text-muted-foreground">
                  {new Date(c.timestamp).toLocaleString('en-AU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              <p className="text-[10px] text-muted-foreground mt-0.5">{c.text}</p>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-[9px] text-muted-foreground/50">No comments yet.</p>
      )}

      {/* Add comment */}
      <div className="flex gap-1.5">
        <input
          type="text"
          value={newComment}
          onChange={e => setNewComment(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') handleSubmit() }}
          placeholder="Add a comment..."
          className="flex-1 rounded-md border bg-background px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary"
        />
        <button
          type="button"
          onClick={handleSubmit}
          disabled={saving || !newComment.trim()}
          className="rounded-md bg-muted p-1.5 text-muted-foreground hover:text-foreground disabled:opacity-50 transition-colors"
        >
          <Send className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  )
}

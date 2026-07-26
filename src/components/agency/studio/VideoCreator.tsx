'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'

interface VideoCreatorProps {
  brandId: string | null
}

export function VideoCreator({ brandId }: VideoCreatorProps) {
  const [script, setScript] = useState('')
  const [saving, setSaving] = useState(false)
  const [savedScriptId, setSavedScriptId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleSave() {
    if (!brandId || !script.trim()) return

    setSaving(true)
    setError(null)
    setSavedScriptId(null)

    try {
      const response = await fetch('/api/outputs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brand_id: brandId,
          output_type: 'video_script',
          title: `Video Script - ${new Date().toLocaleDateString('en-AU')}`,
          content: script.trim(),
        }),
      })
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to save script')
      }

      setSavedScriptId(data.id || data.data?.id || 'saved')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setSaving(false)
    }
  }

  if (!brandId) {
    return <p className="text-xs text-muted-foreground">Select a brand first.</p>
  }

  return (
    <div className="space-y-4">
      <div>
        <textarea
          rows={6}
          value={script}
          onChange={(event) => setScript(event.target.value)}
          placeholder="Write the narration or on-screen script..."
          className="w-full rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary/40 focus:outline-none focus:ring-1 focus:ring-primary/30"
        />
        <p className="mt-1 text-right text-xs text-muted-foreground">{script.length} characters</p>
      </div>

      <button
        type="button"
        onClick={handleSave}
        disabled={saving || !script.trim()}
        className={cn(
          'w-full rounded-lg px-4 py-2 text-sm font-medium transition-colors',
          saving || !script.trim()
            ? 'cursor-not-allowed bg-muted text-muted-foreground'
            : 'bg-primary/15 text-foreground hover:bg-primary/25'
        )}
      >
        {saving ? 'Saving...' : 'Save Video Script'}
      </button>

      {savedScriptId && (
        <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-3">
          <p className="text-xs text-emerald-400">Saved. The Director can now turn this into a shot list, captions, and a production brief.</p>
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-3">
          <p className="text-xs text-red-400">{error}</p>
        </div>
      )}
    </div>
  )
}

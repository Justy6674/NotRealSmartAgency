'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'

interface VideoCreatorProps {
  brandId: string | null
}

export function VideoCreator({ brandId }: VideoCreatorProps) {
  const [script, setScript] = useState('')
  const [generating, setGenerating] = useState(false)
  const [result, setResult] = useState<{ videoId: string; outputId: string } | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleGenerate() {
    if (!brandId || !script.trim()) return

    setGenerating(true)
    setError(null)
    setResult(null)

    try {
      // The /api/video/generate endpoint expects an output_id (a saved video_script output).
      // We first save the script as an output, then trigger video generation.
      const saveRes = await fetch('/api/outputs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brand_id: brandId,
          output_type: 'video_script',
          title: `Video Script - ${new Date().toLocaleDateString('en-AU')}`,
          content: script.trim(),
        }),
      })

      if (!saveRes.ok) {
        const saveData = await saveRes.json()
        throw new Error(saveData.error || 'Failed to save script')
      }

      const savedOutput = await saveRes.json()
      const outputId = savedOutput.id || savedOutput.data?.id

      if (!outputId) {
        throw new Error('Could not retrieve saved script ID')
      }

      // Now trigger video generation with the output_id
      const res = await fetch('/api/video/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          output_id: outputId,
          provider: 'heygen',
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Video generation failed')
      }

      const videoId = data.videoOutput?.metadata?.job_id || data.videoOutput?.id || 'unknown'
      const videoOutputId = data.videoOutput?.id || 'unknown'

      setResult({ videoId, outputId: videoOutputId })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setGenerating(false)
    }
  }

  if (!brandId) {
    return (
      <p className="text-xs text-muted-foreground">Select a brand first.</p>
    )
  }

  return (
    <div className="space-y-4">
      <div>
        <textarea
          rows={6}
          value={script}
          onChange={(e) => setScript(e.target.value)}
          placeholder="Write what the AI presenter should say..."
          className="w-full rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary/40 focus:outline-none focus:ring-1 focus:ring-primary/30"
        />
        <p className="mt-1 text-right text-xs text-muted-foreground">{script.length} characters</p>
      </div>

      <button
        type="button"
        onClick={handleGenerate}
        disabled={generating || !script.trim()}
        className={cn(
          'w-full rounded-lg px-4 py-2 text-sm font-medium transition-colors',
          generating || !script.trim()
            ? 'bg-muted text-muted-foreground cursor-not-allowed'
            : 'bg-primary/15 text-foreground hover:bg-primary/25'
        )}
      >
        {generating ? 'Generating...' : 'Generate Video'}
      </button>

      {result && (
        <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-3">
          <p className="text-xs text-emerald-400">
            Video generating! It will appear in your feed when ready.
          </p>
          <p className="mt-1 text-xs text-emerald-400/60">
            Video ID: {result.videoId}
          </p>
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

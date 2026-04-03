'use client'

import { useState } from 'react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { OUTPUT_LABELS } from '@/types/database'
import type { Output } from '@/types/database'

interface OutputCardProps {
  output: Output & { brands?: { name: string; slug: string } }
}

export function OutputCard({ output }: OutputCardProps) {
  const label = OUTPUT_LABELS[output.output_type] ?? output.output_type
  const [generating, setGenerating] = useState(false)
  const [checking, setChecking] = useState(false)

  // Safe type casting for metadata since JSONB could be anything
  const metadata = (output.metadata || {}) as Record<string, unknown>
  const [videoUrl, setVideoUrl] = useState<string | undefined>(metadata.video_url as string | undefined)
  const [status, setStatus] = useState<string | undefined>(metadata.status as string | undefined)

  const handleGenerate = async () => {
    setGenerating(true)
    const res = await fetch('/api/video/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ output_id: output.id, provider: 'heygen' }),
    })
    const data = await res.json()
    if (res.ok) {
      alert('Video generation started! Refresh the Output Library for the new video.')
    } else {
      alert('Error: ' + data.error)
    }
    setGenerating(false)
  }

  const handleCheckStatus = async () => {
    setChecking(true)
    const res = await fetch('/api/video/status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ video_output_id: output.id }),
    })
    const data = await res.json()
    if (res.ok) {
      setStatus(data.status)
      if (data.output?.metadata?.video_url) {
        setVideoUrl(data.output.metadata.video_url)
      }
    }
    setChecking(false)
  }

  // Compliance metadata
  const compliance = metadata.compliance as { flags?: string[]; warnings?: string[] } | undefined

  return (
    <Card className="p-4 space-y-2 flex flex-col">
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-sm font-medium line-clamp-1">{output.title}</h3>
        <Badge variant="outline" className="shrink-0 text-xs">
          {label}
        </Badge>
      </div>
      {output.brands && (
        <p className="text-xs text-muted-foreground">{output.brands.name}</p>
      )}

      {compliance && (compliance.flags?.length || compliance.warnings?.length) ? (
        <div className="p-2 bg-amber-500/10 border border-amber-500/20 rounded text-[10px] text-amber-700 dark:text-amber-400">
          <p className="font-semibold">Compliance Flags:</p>
          <ul className="list-disc list-inside ml-4">
            {compliance.flags?.map((f: string, i: number) => <li key={`f-${i}`}>{f}</li>)}
            {compliance.warnings?.map((w: string, i: number) => <li key={`w-${i}`}>{w}</li>)}
          </ul>
        </div>
      ) : null}

      {output.output_type === 'video' && videoUrl ? null : (
        <p className="text-xs text-muted-foreground line-clamp-3 flex-1">
          {output.content}
        </p>
      )}

      {output.output_type === 'video_script' && (
        <Button
          variant="secondary"
          size="sm"
          className="w-full mt-2"
          onClick={handleGenerate}
          disabled={generating}
        >
          {generating ? 'Generating...' : 'Generate Video (HeyGen)'}
        </Button>
      )}

      {output.output_type === 'video' && (
        <div className="mt-2 space-y-2">
          {videoUrl ? (
            <video src={videoUrl} controls className="w-full rounded-md bg-black" />
          ) : (
            <div className="p-4 bg-muted/50 rounded-md text-center">
              <p className="text-xs mb-2">Status: {status || 'processing'}</p>
              <Button size="sm" variant="outline" onClick={handleCheckStatus} disabled={checking}>
                {checking ? 'Checking...' : 'Check Status'}
              </Button>
            </div>
          )}
        </div>
      )}

      <p className="text-[11px] text-muted-foreground mt-auto pt-2">
        {new Date(output.created_at).toLocaleDateString('en-AU', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        })}
      </p>
    </Card>
  )
}

'use client'

import { useState } from 'react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Loader2, Recycle, Sparkles, Trash2, Video } from 'lucide-react'
import type { MediaItem } from '@/types/database'

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  pending: { label: 'Pending', className: 'bg-muted text-muted-foreground' },
  transcribing: { label: 'Transcribing', className: 'bg-amber-500/10 text-amber-500' },
  transcribed: { label: 'Ready', className: 'bg-green-500/10 text-green-500' },
  failed: { label: 'Failed', className: 'bg-red-500/10 text-red-500' },
}

interface MediaCardProps {
  mediaItem: MediaItem & { brands?: { name: string; slug: string } }
  onGenerate: (id: string) => void
  onDelete: (id: string) => void
  onRepurpose?: (id: string) => void
}

export function MediaCard({ mediaItem, onGenerate, onDelete, onRepurpose }: MediaCardProps) {
  const [generating, setGenerating] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const status = STATUS_CONFIG[mediaItem.transcription_status] ?? STATUS_CONFIG.pending

  const handleGenerate = async () => {
    setGenerating(true)
    await onGenerate(mediaItem.id)
    setGenerating(false)
  }

  const handleDelete = async () => {
    setDeleting(true)
    await onDelete(mediaItem.id)
  }

  const fileSizeMB = mediaItem.file_size_bytes
    ? (mediaItem.file_size_bytes / (1024 * 1024)).toFixed(1)
    : null

  return (
    <Card className="p-4 space-y-3 flex flex-col">
      {/* Video preview */}
      <div className="aspect-video bg-muted rounded-md overflow-hidden flex items-center justify-center">
        {mediaItem.file_type.startsWith('video') ? (
          <video
            src={mediaItem.file_url}
            className="w-full h-full object-cover"
            preload="metadata"
          />
        ) : (
          <Video className="h-8 w-8 text-muted-foreground" />
        )}
      </div>

      {/* Info */}
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-sm font-medium line-clamp-1">{mediaItem.file_name}</h3>
        <Badge variant="outline" className={`shrink-0 text-[10px] ${status.className}`}>
          {status.label}
        </Badge>
      </div>

      {mediaItem.brands && (
        <p className="text-xs text-muted-foreground">{mediaItem.brands.name}</p>
      )}

      <div className="flex gap-2 text-[10px] text-muted-foreground">
        {fileSizeMB && <span>{fileSizeMB} MB</span>}
        {mediaItem.duration_seconds && <span>{Math.round(mediaItem.duration_seconds)}s</span>}
        {mediaItem.transcription_model && <span>{mediaItem.transcription_model}</span>}
      </div>

      {/* Transcription preview */}
      {mediaItem.transcription && (
        <p className="text-xs text-muted-foreground line-clamp-3 bg-muted/50 p-2 rounded">
          {mediaItem.transcription}
        </p>
      )}

      {/* Actions */}
      <div className="flex flex-col gap-2 mt-auto pt-2">
        <div className="flex gap-2">
          {mediaItem.transcription_status === 'transcribed' && (
            <Button
              size="sm"
              variant="secondary"
              className="flex-1"
              onClick={handleGenerate}
              disabled={generating}
            >
              {generating ? (
                <><Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> Generating...</>
              ) : (
                <><Sparkles className="h-3.5 w-3.5 mr-1" /> Generate Content</>
              )}
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            onClick={handleDelete}
            disabled={deleting}
            className="text-muted-foreground"
          >
            {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
          </Button>
        </div>
        {mediaItem.transcription_status === 'transcribed' && onRepurpose && (
          <Button
            size="sm"
            variant="outline"
            className="w-full"
            onClick={() => onRepurpose(mediaItem.id)}
          >
            <Recycle className="h-3.5 w-3.5 mr-1" /> Repurpose All
          </Button>
        )}
      </div>

      <p className="text-[10px] text-muted-foreground">
        {new Date(mediaItem.created_at).toLocaleDateString('en-AU', {
          day: 'numeric', month: 'short', year: 'numeric',
        })}
      </p>
    </Card>
  )
}

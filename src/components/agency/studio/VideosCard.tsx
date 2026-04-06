'use client'

import { Video, Play, Loader2, AlertCircle, Plus } from 'lucide-react'
import { useState } from 'react'
import { sendToDirector } from '@/lib/chat-dispatch'
import type { Output } from '@/types/database'

interface VideosCardProps {
  videos: Output[]
}

export function VideosCard({ videos }: VideosCardProps) {
  const [playingId, setPlayingId] = useState<string | null>(null)

  const handleCreate = () => {
    sendToDirector('Create a video for my brand')
  }

  if (videos.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card p-5 space-y-3">
        <div className="flex items-center gap-2">
          <Video className="h-4 w-4 text-red-400" />
          <h3 className="text-sm font-semibold text-foreground">Videos</h3>
        </div>
        <div className="text-center py-4">
          <p className="text-xs text-muted-foreground mb-2">No videos yet — describe what you want and I&apos;ll create one.</p>
          <button
            onClick={handleCreate}
            className="text-xs font-medium text-primary hover:text-primary/80 transition-colors"
          >
            Create a video
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Video className="h-4 w-4 text-red-400" />
          <h3 className="text-sm font-semibold text-foreground">Videos</h3>
        </div>
        <button
          onClick={handleCreate}
          className="text-xs font-medium text-primary hover:text-primary/80 transition-colors flex items-center gap-1"
        >
          <Plus className="h-3 w-3" />
          New
        </button>
      </div>

      <div className="flex gap-3 overflow-x-auto pb-1 -mx-1 px-1">
        {videos.map(video => {
          const meta = video.metadata as Record<string, unknown> | null
          const status = (meta?.status as string) ?? 'unknown'
          const videoUrl = meta?.video_url as string | null
          const isPlaying = playingId === video.id

          return (
            <div key={video.id} className="shrink-0 w-[180px] space-y-1.5">
              {/* Video player / thumbnail */}
              <div className="relative aspect-video w-full overflow-hidden rounded-lg bg-muted border border-border">
                {isPlaying && videoUrl ? (
                  <video
                    src={videoUrl}
                    controls
                    autoPlay
                    className="h-full w-full object-cover"
                    onEnded={() => setPlayingId(null)}
                  />
                ) : (
                  <button
                    onClick={() => videoUrl && setPlayingId(video.id)}
                    disabled={!videoUrl}
                    className="flex h-full w-full items-center justify-center"
                  >
                    {status === 'processing' ? (
                      <div className="flex flex-col items-center gap-1">
                        <Loader2 className="h-6 w-6 text-amber-400 animate-spin" />
                        <span className="text-[10px] text-amber-400">Generating...</span>
                      </div>
                    ) : status === 'failed' ? (
                      <div className="flex flex-col items-center gap-1">
                        <AlertCircle className="h-6 w-6 text-red-400" />
                        <span className="text-[10px] text-red-400">Failed</span>
                      </div>
                    ) : videoUrl ? (
                      <Play className="h-8 w-8 text-foreground/60 hover:text-foreground transition-colors" />
                    ) : (
                      <Video className="h-6 w-6 text-muted-foreground/30" />
                    )}
                  </button>
                )}

                {/* Status badge */}
                {status !== 'unknown' && (
                  <span className={`absolute top-1.5 right-1.5 rounded-full px-1.5 py-0.5 text-[9px] font-medium ${
                    status === 'completed' ? 'bg-emerald-500/20 text-emerald-400' :
                    status === 'processing' ? 'bg-amber-500/20 text-amber-400' :
                    'bg-red-500/20 text-red-400'
                  }`}>
                    {status}
                  </span>
                )}
              </div>

              {/* Title */}
              <p className="text-[11px] text-muted-foreground truncate">
                {video.title || 'Untitled video'}
              </p>
            </div>
          )
        })}
      </div>
    </div>
  )
}

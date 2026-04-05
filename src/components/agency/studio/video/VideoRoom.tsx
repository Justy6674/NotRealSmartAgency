'use client'

import { useState } from 'react'
import { useAgencyStore } from '@/stores/agency-store'
import { useStudioData } from '@/hooks/useStudioData'
import { useStrategyContext } from '@/hooks/useStrategyContext'
import { VideoModeSelector, type VideoMode } from './VideoModeSelector'
import { VideoCreatePanel } from './VideoCreatePanel'
import { VideoEditPanel } from './VideoEditPanel'
import { VideoImportPanel } from './VideoImportPanel'
import { VideoExporter } from './VideoExporter'

export function VideoRoom() {
  const [mode, setMode] = useState<VideoMode>('create')
  const { activeBrandId } = useAgencyStore()
  const data = useStudioData(activeBrandId)
  const strategyContext = useStrategyContext(data.brand, data.posts, data.accounts)

  if (!activeBrandId) {
    return (
      <div className="rounded-xl border border-border bg-muted/30 p-8 text-center">
        <p className="text-sm text-muted-foreground">
          Select a brand from the sidebar to start creating videos.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <VideoModeSelector mode={mode} onModeChange={setMode} />

      <div className="grid gap-6 lg:grid-cols-[1fr,320px]">
        {/* Main panel */}
        <div className="rounded-xl border border-border bg-card/50 p-5">
          {mode === 'create' && (
            <VideoCreatePanel brand={data.brand} strategyContext={strategyContext} />
          )}
          {mode === 'edit' && (
            <VideoEditPanel brand={data.brand} strategyContext={strategyContext} />
          )}
          {mode === 'import' && (
            <VideoImportPanel brand={data.brand} />
          )}
        </div>

        {/* Side panel — exporter (visible in create and edit modes) */}
        {(mode === 'create' || mode === 'edit') && (
          <div>
            <VideoExporter brand={data.brand} />
          </div>
        )}
      </div>
    </div>
  )
}

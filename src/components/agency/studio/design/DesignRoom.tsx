'use client'

import { useState } from 'react'
import { useAgencyStore } from '@/stores/agency-store'
import { useStudioData } from '@/hooks/useStudioData'
import { useStrategyContext } from '@/hooks/useStrategyContext'
import { DesignModeSelector, type DesignMode } from './DesignModeSelector'
import { DesignCreatePanel } from './DesignCreatePanel'
import { DesignBrowsePanel } from './DesignBrowsePanel'
import { DesignUploadPanel } from './DesignUploadPanel'

export function DesignRoom() {
  const [mode, setMode] = useState<DesignMode>('create')
  const { activeBrandId } = useAgencyStore()
  const data = useStudioData(activeBrandId)
  const strategyContext = useStrategyContext(data.brand, data.posts, data.accounts)

  if (!activeBrandId) {
    return (
      <div className="rounded-xl border border-border bg-muted/30 p-8 text-center">
        <p className="text-sm text-muted-foreground">
          Select a brand from the sidebar to start designing.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <DesignModeSelector mode={mode} onModeChange={setMode} />

      <div className="rounded-xl border border-border bg-card/50 p-5">
        {mode === 'create' && (
          <DesignCreatePanel brand={data.brand} strategyContext={strategyContext} />
        )}
        {mode === 'browse' && (
          <DesignBrowsePanel brand={data.brand} />
        )}
        {mode === 'upload' && (
          <DesignUploadPanel brand={data.brand} />
        )}
      </div>
    </div>
  )
}

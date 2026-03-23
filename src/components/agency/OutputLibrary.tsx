'use client'

import { useEffect, useState } from 'react'
import { useAgencyStore } from '@/stores/agency-store'
import { OutputCard } from './OutputCard'
import type { Output } from '@/types/database'

export function OutputLibrary() {
  const [outputs, setOutputs] = useState<(Output & { brands?: { name: string; slug: string } })[]>([])
  const [loading, setLoading] = useState(true)
  const { activeBrandId } = useAgencyStore()

  useEffect(() => {
    setLoading(true)
    const params = new URLSearchParams()
    if (activeBrandId) params.set('brandId', activeBrandId)

    fetch(`/api/outputs?${params}`)
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setOutputs(data)
        setLoading(false)
      })
  }, [activeBrandId])

  if (loading) {
    return <p className="text-sm text-muted-foreground p-6">Loading outputs...</p>
  }

  if (outputs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center">
        <p className="text-sm text-muted-foreground">
          No saved outputs yet. Generate content with an agent and save it here.
        </p>
      </div>
    )
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {outputs.map((output) => (
        <OutputCard key={output.id} output={output} />
      ))}
    </div>
  )
}

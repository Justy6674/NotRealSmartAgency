'use client'

import { useState, useEffect } from 'react'

/** Platforms connected via Mixpost for a specific brand */
export function useConnectedPlatforms(brandId: string | null) {
  const [platforms, setPlatforms] = useState<string[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!brandId) {
      setPlatforms([])
      setLoading(false)
      return
    }

    let cancelled = false

    async function fetchPlatforms() {
      setLoading(true)
      try {
        const res = await fetch('/api/mixpost/accounts')
        if (!res.ok) {
          setPlatforms([])
          return
        }

        // Response shape from /api/mixpost/accounts:
        // {
        //   configured: boolean,
        //   accounts: Array<{ id, name, provider }>,
        //   brandMapping: Record<brandId, Array<{ platform, accountName, provider }>>
        // }
        const data = await res.json()

        if (!data.configured || !data.brandMapping) {
          if (!cancelled) setPlatforms([])
          return
        }

        // brandMapping is keyed by brand ID — extract unique friendly platform names
        const mappings = data.brandMapping[brandId!] as
          | Array<{ platform: string; accountName: string; provider: string }>
          | undefined

        if (!cancelled) {
          const connected = mappings
            ? [...new Set(mappings.map(m => m.platform))]
            : []
          setPlatforms(connected)
        }
      } catch {
        if (!cancelled) setPlatforms([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    fetchPlatforms()
    return () => { cancelled = true }
  }, [brandId])

  return { platforms, loading }
}

'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Megaphone, Play, Pause, Loader2 } from 'lucide-react'

interface ZernioAdsDataGridProps {
  brandId: string
}

export function ZernioAdsDataGrid({ brandId }: ZernioAdsDataGridProps) {
  const [campaigns, setCampaigns] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [configured, setConfigured] = useState(false)
  const [toggling, setToggling] = useState<string | null>(null)

  useEffect(() => {
    async function fetchCampaigns() {
      try {
        const res = await fetch(`/api/zernio/ads?brandId=${brandId}`)
        if (!res.ok) throw new Error('Failed to fetch campaigns')
        const json = await res.json()
        if (json.configured) {
          setConfigured(true)
          setCampaigns(json.campaigns || [])
        }
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    fetchCampaigns()
  }, [brandId])

  const toggleStatus = async (campaignId: string, currentStatus: string) => {
    setToggling(campaignId)
    const newStatus = currentStatus === 'ACTIVE' ? 'PAUSED' : 'ACTIVE'
    try {
      const res = await fetch('/api/zernio/ads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ campaignId, status: newStatus })
      })
      if (res.ok) {
        setCampaigns(prev => prev.map(c => c._id === campaignId || c.id === campaignId ? { ...c, status: newStatus } : c))
      }
    } catch (e) {
      console.error(e)
    } finally {
      setToggling(null)
    }
  }

  if (loading) return null
  if (!configured) return null

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <h2 className="text-sm font-semibold text-foreground tracking-tight">Active Ad Campaigns</h2>
      </div>
      <Card className="shadow-none rounded-xl bg-card border-border overflow-hidden">
        {campaigns.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            No active campaigns found across your ad accounts.
          </div>
        ) : (
          <div className="divide-y divide-border">
            <div className="grid grid-cols-12 gap-4 px-4 py-3 bg-muted/30 text-xs font-medium text-muted-foreground uppercase tracking-wider">
              <div className="col-span-5">Campaign</div>
              <div className="col-span-2">Platform</div>
              <div className="col-span-2 text-right">Spend</div>
              <div className="col-span-3 text-right">Status</div>
            </div>
            {campaigns.map((c, i) => {
              const id = c._id || c.id || String(i)
              const isActive = c.status === 'ACTIVE'
              return (
                <div key={id} className="grid grid-cols-12 gap-4 px-4 py-3 items-center hover:bg-muted/10 transition-colors text-sm">
                  <div className="col-span-5 font-medium text-foreground truncate" title={c.name}>{c.name || 'Unnamed Campaign'}</div>
                  <div className="col-span-2 capitalize text-muted-foreground">{c.platform}</div>
                  <div className="col-span-2 text-right font-mono text-foreground">${(c.spend || 0).toFixed(2)}</div>
                  <div className="col-span-3 flex justify-end">
                    <button
                      onClick={() => toggleStatus(id, c.status)}
                      disabled={!!toggling}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors ${
                        isActive 
                          ? 'bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 dark:text-emerald-400' 
                          : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700'
                      }`}
                    >
                      {toggling === id ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : isActive ? (
                        <Pause className="h-3 w-3" />
                      ) : (
                        <Play className="h-3 w-3" />
                      )}
                      {isActive ? 'Active' : 'Paused'}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </Card>
    </div>
  )
}

'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAgencyStore } from '@/stores/agency-store'
import { Globe, Plus, Pencil, Trash2, Loader2, Blocks } from 'lucide-react'
import type { Output } from '@/types/database'

interface PageOutput extends Output {
  brands?: { name: string; slug: string }
}

export function PagesIndex() {
  const brandId = useAgencyStore(s => s.activeBrandId)
  const [pages, setPages] = useState<PageOutput[]>([])
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState<string | null>(null)
  const router = useRouter()

  const fetchPages = useCallback(async () => {
    if (!brandId) return
    setLoading(true)
    try {
      const res = await fetch(`/api/pages?brandId=${brandId}`)
      if (res.ok) {
        const data = await res.json()
        setPages(data)
      }
    } finally {
      setLoading(false)
    }
  }, [brandId])

  useEffect(() => {
    fetchPages()
  }, [fetchPages])

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this page?')) return
    setDeleting(id)
    try {
      const res = await fetch(`/api/pages?id=${id}`, { method: 'DELETE' })
      if (res.ok) {
        setPages(prev => prev.filter(p => p.id !== id))
      }
    } finally {
      setDeleting(null)
    }
  }

  if (!brandId) {
    return (
      <div className="flex items-center justify-center h-64 text-sm text-muted-foreground">
        Select a brand to manage pages
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-foreground">Pages</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Link-in-bio pages and simple landing pages for your brand
          </p>
        </div>
        <button
          type="button"
          onClick={() => router.push('/agency/studio/pages/new')}
          className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          <Plus className="h-3.5 w-3.5" />
          New Page
        </button>
      </div>

      {/* Director assist */}
      <div className="rounded-lg border border-dashed border-primary/30 bg-primary/5 p-3 flex items-center justify-between">
        <div>
          <p className="text-xs font-medium text-foreground">Need a landing page?</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">
            Ask the Director to build one for you
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            useAgencyStore.getState().setAgent('overall')
            router.push('/agency/chat')
            // Brief delay then the store's pendingReviewMessage could be used,
            // but for simplicity we just navigate to chat
          }}
          className="rounded-md bg-primary/10 px-3 py-1.5 text-[11px] font-medium text-primary hover:bg-primary/20 transition-colors"
        >
          Build me a landing page
        </button>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center h-32">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* Empty state */}
      {!loading && pages.length === 0 && (
        <div className="flex flex-col items-center justify-center h-48 text-center">
          <Globe className="h-8 w-8 text-muted-foreground/30 mb-3" />
          <p className="text-sm font-medium text-muted-foreground">No pages yet</p>
          <p className="text-xs text-muted-foreground/70 mt-1">
            Create a link-in-bio page or landing page for your brand
          </p>
        </div>
      )}

      {/* Pages grid */}
      {!loading && pages.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {pages.map(page => {
            const blocks = (page.metadata?.blocks as unknown[]) ?? []
            const pageSlug = (page.metadata?.slug as string) ?? ''
            return (
              <div
                key={page.id}
                className="rounded-lg border border-border bg-card p-4 hover:border-primary/30 transition-colors group"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <Blocks className="h-4 w-4 text-primary shrink-0" />
                    <h3 className="text-sm font-semibold text-foreground truncate">
                      {page.title}
                    </h3>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      type="button"
                      onClick={() => router.push(`/agency/studio/pages/${page.id}`)}
                      className="rounded p-1 text-muted-foreground hover:text-primary hover:bg-primary/10"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(page.id)}
                      disabled={deleting === page.id}
                      className="rounded p-1 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                    >
                      {deleting === page.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="h-3.5 w-3.5" />
                      )}
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  {pageSlug && (
                    <p className="text-[10px] font-mono text-muted-foreground">/p/{pageSlug}</p>
                  )}
                  <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                    <span>{blocks.length} block{blocks.length !== 1 ? 's' : ''}</span>
                    <span>Edited {new Date(page.updated_at).toLocaleDateString('en-AU')}</span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

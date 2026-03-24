'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Globe, Loader2 } from 'lucide-react'

interface AddBrandDialogProps {
  onClose: () => void
}

export function AddBrandDialog({ onClose }: AddBrandDialogProps) {
  const router = useRouter()
  const [creating, setCreating] = useState(false)
  const [scanning, setScanning] = useState(false)
  const [form, setForm] = useState({
    name: '',
    website_url: '',
    github_url: '',
    niche: '',
    tagline: '',
    description: '',
    business_stage: 'launch',
    ahpra: false,
    tga: false,
  })
  const [scannedData, setScannedData] = useState<Record<string, string> | null>(null)

  const handleScan = async () => {
    if (!form.website_url) return
    setScanning(true)
    try {
      // Fetch page to extract title/description
      const res = await fetch(`/api/scan-website-quick?url=${encodeURIComponent(form.website_url)}`)
      if (res.ok) {
        const data = await res.json()
        setScannedData(data)
        if (data.title && !form.name) setForm(f => ({ ...f, name: data.title }))
        if (data.description && !form.description) setForm(f => ({ ...f, description: data.description }))
      }
    } catch {
      // ignore scan failure
    }
    // Set favicon
    try {
      const domain = new URL(form.website_url).hostname
      const faviconUrl = `https://www.${domain}/favicon.ico`
      setScannedData(prev => ({ ...prev, logo_url: faviconUrl }))
    } catch {
      // ignore
    }
    setScanning(false)
  }

  const handleCreate = async () => {
    if (!form.name.trim()) return
    setCreating(true)

    const slug = form.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '')

    const res = await fetch('/api/brands', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: form.name,
        slug,
        tagline: form.tagline || null,
        description: form.description || null,
        website_url: form.website_url || null,
        github_url: form.github_url || null,
        logo_url: scannedData?.logo_url || null,
        niche: form.niche || 'general',
        business_stage: form.business_stage,
        compliance_flags: {
          ahpra: form.ahpra,
          tga: form.tga,
          tga_categories: [],
        },
        content_pillars: [],
        tone_of_voice: { formality: 'professional', humour: 'light', keywords: [], avoid_words: [] },
        target_audience: { demographics: '', pain_points: [], desires: [] },
        competitors: [],
        brand_colours: {},
        social_urls: {},
        is_active: true,
      }),
    })

    if (res.ok) {
      router.refresh()
      onClose()
    }
    setCreating(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-lg" onClick={e => e.stopPropagation()}>
        <h2 className="text-lg font-semibold text-foreground mb-4">Add Brand</h2>

        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground">Website URL</label>
            <div className="flex gap-2 mt-1">
              <input
                type="url"
                placeholder="https://yourbrand.com.au"
                value={form.website_url}
                onChange={e => setForm({ ...form, website_url: e.target.value })}
                className="flex-1 rounded-md border border-border bg-background px-3 py-1.5 text-sm"
              />
              <button
                onClick={handleScan}
                disabled={scanning || !form.website_url}
                className="shrink-0 rounded-md border border-border px-3 py-1.5 text-xs hover:bg-muted disabled:opacity-50 transition-colors"
              >
                {scanning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Globe className="h-4 w-4" />}
              </button>
            </div>
            <p className="text-[10px] text-muted-foreground mt-0.5">Paste URL and scan to auto-fill brand details</p>
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground">Brand Name</label>
            <input
              type="text"
              value={form.name}
              onChange={e => setForm({ ...form, name: e.target.value })}
              className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm mt-1"
              placeholder="My Brand"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground">Tagline</label>
            <input
              type="text"
              value={form.tagline}
              onChange={e => setForm({ ...form, tagline: e.target.value })}
              className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm mt-1"
              placeholder="Your brand in one line"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground">Niche</label>
            <input
              type="text"
              value={form.niche}
              onChange={e => setForm({ ...form, niche: e.target.value })}
              className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm mt-1"
              placeholder="e.g., telehealth, saas, marketplace"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground">GitHub URL (optional)</label>
            <input
              type="url"
              value={form.github_url}
              onChange={e => setForm({ ...form, github_url: e.target.value })}
              className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm mt-1"
              placeholder="https://github.com/org/repo"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground">Business Stage</label>
            <select
              value={form.business_stage}
              onChange={e => setForm({ ...form, business_stage: e.target.value })}
              className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm mt-1"
            >
              <option value="idea">Idea</option>
              <option value="mvp">MVP</option>
              <option value="launch">Launch</option>
              <option value="growth">Growth</option>
              <option value="scale">Scale</option>
              <option value="mature">Mature</option>
            </select>
          </div>

          <div className="flex gap-4">
            <label className="flex items-center gap-2 text-xs">
              <input type="checkbox" checked={form.ahpra} onChange={e => setForm({ ...form, ahpra: e.target.checked })} />
              AHPRA
            </label>
            <label className="flex items-center gap-2 text-xs">
              <input type="checkbox" checked={form.tga} onChange={e => setForm({ ...form, tga: e.target.checked })} />
              TGA
            </label>
          </div>
        </div>

        <div className="flex gap-2 mt-5">
          <button
            onClick={handleCreate}
            disabled={creating || !form.name.trim()}
            className="flex-1 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            {creating ? 'Creating...' : 'Create Brand'}
          </button>
          <button onClick={onClose} className="rounded-md px-3 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}

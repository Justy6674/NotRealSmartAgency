'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Globe, Github, Loader2, RefreshCw } from 'lucide-react'
import { ProductServiceEditor } from './ProductServiceEditor'
import { VideoPreferencesEditor } from './VideoPreferencesEditor'
import type { Brand, ProductService, VideoPreferences } from '@/types/database'

interface BrandProfileFormProps {
  brand: Brand
}

export function BrandProfileForm({ brand }: BrandProfileFormProps) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [scanning, setScanning] = useState(false)
  const [formData, setFormData] = useState({
    name: brand.name,
    tagline: brand.tagline ?? '',
    description: brand.description ?? '',
    website_url: brand.website_url ?? '',
    github_url: brand.github_url ?? '',
    logo_url: brand.logo_url ?? '',
    business_stage: brand.business_stage ?? 'growth',
    niche: brand.niche,
    content_pillars: brand.content_pillars.join(', '),
    extra_context: brand.extra_context ?? '',
    ahpra: brand.compliance_flags?.ahpra ?? false,
    tga: brand.compliance_flags?.tga ?? false,
    products_services: (brand.products_services ?? []) as ProductService[],
    video_preferences: (brand.video_preferences ?? {}) as VideoPreferences,
    marketing_status: brand.marketing_status ?? 'unknown',
    marketing_notes: brand.marketing_notes ?? '',
    social_linkedin: brand.social_urls?.linkedin ?? '',
    social_twitter: brand.social_urls?.twitter ?? '',
    social_instagram: brand.social_urls?.instagram ?? '',
    social_facebook: brand.social_urls?.facebook ?? '',
    social_tiktok: brand.social_urls?.tiktok ?? '',
    social_youtube: brand.social_urls?.youtube ?? '',
  })
  const [syncing, setSyncing] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    await fetch('/api/brands', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: brand.id,
        name: formData.name,
        tagline: formData.tagline || null,
        description: formData.description || null,
        website_url: formData.website_url || null,
        github_url: formData.github_url || null,
        logo_url: formData.logo_url || null,
        business_stage: formData.business_stage,
        niche: formData.niche,
        content_pillars: formData.content_pillars.split(',').map((s) => s.trim()).filter(Boolean),
        extra_context: formData.extra_context || null,
        products_services: formData.products_services,
        video_preferences: formData.video_preferences,
        marketing_status: formData.marketing_status,
        marketing_notes: formData.marketing_notes || null,
        social_urls: Object.fromEntries(
          Object.entries({
            linkedin: formData.social_linkedin,
            twitter: formData.social_twitter,
            instagram: formData.social_instagram,
            facebook: formData.social_facebook,
            tiktok: formData.social_tiktok,
            youtube: formData.social_youtube,
          }).filter(([, v]) => v)
        ),
        compliance_flags: {
          ahpra: formData.ahpra,
          tga: formData.tga,
          tga_categories: brand.compliance_flags?.tga_categories ?? [],
        },
      }),
    })
    setSaving(false)
    router.refresh()
  }

  // Auto-scan website to extract branding
  const handleScanWebsite = async () => {
    if (!formData.website_url) return
    setScanning(true)
    try {
      // Try to get favicon from the website
      const domain = new URL(formData.website_url).hostname
      const faviconUrl = `https://www.${domain}/favicon.ico`
      setFormData(prev => ({ ...prev, logo_url: faviconUrl }))
    } catch {
      // ignore
    }
    setScanning(false)
  }

  const handleSyncGithub = async () => {
    if (!formData.github_url) return
    setSyncing(true)
    try {
      const res = await fetch('/api/github/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brand_id: brand.id }),
      })
      if (res.ok) {
        router.refresh()
      }
    } catch {
      // ignore
    }
    setSyncing(false)
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="grid gap-4">
        {/* Logo preview + URL */}
        <div>
          <Label htmlFor="logo_url">Logo URL</Label>
          <div className="flex items-center gap-3 mt-1">
            {formData.logo_url && (
              <div className="h-10 w-10 rounded-lg border border-border overflow-hidden bg-muted shrink-0">
                <Image
                  src={formData.logo_url}
                  alt={formData.name}
                  width={40}
                  height={40}
                  className="h-full w-full object-cover"
                  unoptimized
                />
              </div>
            )}
            <Input
              id="logo_url"
              value={formData.logo_url}
              onChange={(e) => setFormData({ ...formData, logo_url: e.target.value })}
              placeholder="https://example.com/logo.png"
            />
          </div>
          <p className="text-[10px] text-muted-foreground mt-1">
            Paste a URL to your logo, or click &quot;Scan Website&quot; to auto-detect the favicon.
          </p>
        </div>

        <div>
          <Label htmlFor="name">Brand Name</Label>
          <Input
            id="name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          />
        </div>

        <div>
          <Label htmlFor="tagline">Tagline</Label>
          <Input
            id="tagline"
            value={formData.tagline}
            onChange={(e) => setFormData({ ...formData, tagline: e.target.value })}
          />
        </div>

        <div>
          <Label htmlFor="description">Description</Label>
          <textarea
            id="description"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            rows={3}
            className="w-full rounded-md border bg-transparent px-3 py-2 text-sm"
          />
        </div>

        <div>
          <Label htmlFor="website_url">Website URL</Label>
          <div className="flex gap-2">
            <Input
              id="website_url"
              value={formData.website_url}
              onChange={(e) => setFormData({ ...formData, website_url: e.target.value })}
              placeholder="https://yourbrand.com.au"
            />
            <Button
              onClick={handleScanWebsite}
              disabled={scanning || !formData.website_url}
              variant="outline"
              className="shrink-0"
            >
              {scanning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Globe className="h-4 w-4" />}
              <span className="ml-1.5 hidden sm:inline">Scan</span>
            </Button>
          </div>
        </div>

        <div>
          <Label htmlFor="github_url">GitHub Repository</Label>
          <div className="flex gap-2">
            <Input
              id="github_url"
              value={formData.github_url}
              onChange={(e) => setFormData({ ...formData, github_url: e.target.value })}
              placeholder="https://github.com/org/repo"
            />
            <Button
              onClick={handleSyncGithub}
              disabled={syncing || !formData.github_url}
              variant="outline"
              className="shrink-0"
            >
              {syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              <span className="ml-1.5 hidden sm:inline">Sync</span>
            </Button>
          </div>
          <p className="text-[10px] text-muted-foreground mt-1">
            Link your repo so agents can read your codebase, README, and tech stack.
          </p>
        </div>

        <div>
          <Label htmlFor="niche">Niche</Label>
          <Input
            id="niche"
            value={formData.niche}
            onChange={(e) => setFormData({ ...formData, niche: e.target.value })}
          />
        </div>

        <div>
          <Label htmlFor="business_stage">Business Stage</Label>
          <select
            id="business_stage"
            value={formData.business_stage}
            onChange={(e) => setFormData({ ...formData, business_stage: e.target.value as Brand['business_stage'] })}
            className="w-full rounded-md border bg-transparent px-3 py-2 text-sm"
          >
            <option value="idea">Idea - not yet built</option>
            <option value="mvp">MVP - built but not launched</option>
            <option value="launch">Launch - just went live</option>
            <option value="growth">Growth - established, scaling</option>
            <option value="scale">Scale - expanding markets</option>
            <option value="mature">Mature - market leader</option>
          </select>
          <p className="text-[10px] text-muted-foreground mt-1">
            Tells agents what marketing strategy fits your current stage.
          </p>
        </div>

        <div>
          <Label htmlFor="marketing_status">Marketing Status</Label>
          <select
            id="marketing_status"
            value={formData.marketing_status}
            onChange={(e) => setFormData({ ...formData, marketing_status: e.target.value as Brand['marketing_status'] })}
            className="w-full rounded-md border bg-transparent px-3 py-2 text-sm"
          >
            <option value="unknown">Not assessed</option>
            <option value="no_marketing">No marketing presence</option>
            <option value="early_stage">Early stage marketing</option>
            <option value="needs_strategy">Has presence, needs strategy</option>
            <option value="active">Active marketing</option>
            <option value="scaling">Scaling marketing efforts</option>
          </select>
        </div>

        <div>
          <Label htmlFor="marketing_notes">Marketing Notes</Label>
          <textarea
            id="marketing_notes"
            value={formData.marketing_notes}
            onChange={(e) => setFormData({ ...formData, marketing_notes: e.target.value })}
            rows={2}
            className="w-full rounded-md border bg-transparent px-3 py-2 text-sm"
            placeholder="e.g. No advertising done yet, needs full strategy from scratch..."
          />
        </div>

        {/* Social Media Profiles */}
        <div className="space-y-2">
          <Label>Social Media Profiles</Label>
          <p className="text-[10px] text-muted-foreground -mt-1">
            Add your social URLs so agents can scan and create platform-specific content.
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            <Input
              placeholder="LinkedIn URL"
              value={formData.social_linkedin}
              onChange={(e) => setFormData({ ...formData, social_linkedin: e.target.value })}
            />
            <Input
              placeholder="Instagram URL"
              value={formData.social_instagram}
              onChange={(e) => setFormData({ ...formData, social_instagram: e.target.value })}
            />
            <Input
              placeholder="Facebook URL"
              value={formData.social_facebook}
              onChange={(e) => setFormData({ ...formData, social_facebook: e.target.value })}
            />
            <Input
              placeholder="X / Twitter URL"
              value={formData.social_twitter}
              onChange={(e) => setFormData({ ...formData, social_twitter: e.target.value })}
            />
            <Input
              placeholder="TikTok URL"
              value={formData.social_tiktok}
              onChange={(e) => setFormData({ ...formData, social_tiktok: e.target.value })}
            />
            <Input
              placeholder="YouTube URL"
              value={formData.social_youtube}
              onChange={(e) => setFormData({ ...formData, social_youtube: e.target.value })}
            />
          </div>
        </div>

        <div>
          <Label htmlFor="content_pillars">Content Pillars (comma separated)</Label>
          <Input
            id="content_pillars"
            value={formData.content_pillars}
            onChange={(e) => setFormData({ ...formData, content_pillars: e.target.value })}
          />
        </div>

        <div>
          <Label htmlFor="extra_context">Additional Context</Label>
          <textarea
            id="extra_context"
            value={formData.extra_context}
            onChange={(e) => setFormData({ ...formData, extra_context: e.target.value })}
            rows={4}
            className="w-full rounded-md border bg-transparent px-3 py-2 text-sm"
            placeholder="Anything else the AI agents should know about this brand..."
          />
        </div>

        <ProductServiceEditor
          products={formData.products_services as ProductService[]}
          onChange={(products) => setFormData({ ...formData, products_services: products as any })}
          complianceMode={formData.ahpra || formData.tga}
        />

        <VideoPreferencesEditor
          preferences={formData.video_preferences as VideoPreferences}
          onChange={(prefs) => setFormData({ ...formData, video_preferences: prefs as any })}
        />

        <div className="flex gap-6">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={formData.ahpra}
              onChange={(e) => setFormData({ ...formData, ahpra: e.target.checked })}
              className="rounded"
            />
            AHPRA Compliance
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={formData.tga}
              onChange={(e) => setFormData({ ...formData, tga: e.target.checked })}
              className="rounded"
            />
            TGA Compliance
          </label>
        </div>
      </div>

      <Button onClick={handleSave} disabled={saving}>
        {saving ? 'Saving...' : 'Save Changes'}
      </Button>
    </div>
  )
}

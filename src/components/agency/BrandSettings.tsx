'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { BrandProfileForm } from './BrandProfileForm'
import { CompetitorEditor } from './CompetitorEditor'
import { VoiceAudienceEditor } from './VoiceAudienceEditor'
import { DigestSettings } from './DigestSettings'
import type { Brand, Competitor, ToneOfVoice, TargetAudience } from '@/types/database'
import { Settings, Swords, Volume2, Bell } from 'lucide-react'

interface BrandSettingsProps {
  brand: Brand
}

const TABS = [
  { id: 'profile', label: 'Profile', icon: Settings },
  { id: 'competitors', label: 'Competitors', icon: Swords },
  { id: 'voice', label: 'Voice & Audience', icon: Volume2 },
  { id: 'digest', label: 'Digest', icon: Bell },
] as const

type TabId = typeof TABS[number]['id']

export function BrandSettings({ brand }: BrandSettingsProps) {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<TabId>('profile')
  const [saving, setSaving] = useState(false)

  // Local state for editable fields
  const [competitors, setCompetitors] = useState<Competitor[]>(brand.competitors ?? [])
  const [toneOfVoice, setToneOfVoice] = useState<ToneOfVoice>(brand.tone_of_voice ?? {
    formality: 'professional', humour: 'light', keywords: [], avoid_words: [],
  })
  const [targetAudience, setTargetAudience] = useState<TargetAudience>(brand.target_audience ?? {
    demographics: '', pain_points: [], desires: [],
  })

  // Digest settings from brand metadata or extra_context
  const brandMeta = (brand as unknown as Record<string, unknown>).metadata as Record<string, unknown> | undefined
  const [digestSettings, setDigestSettings] = useState({
    digest_enabled: (brandMeta?.digest_enabled as boolean) ?? false,
    competitor_watch: (brandMeta?.competitor_watch as boolean) ?? false,
    digest_keywords: (brandMeta?.digest_keywords as string) ?? '',
    digest_recipients: (brandMeta?.digest_recipients as string) ?? '',
  })

  const handleSave = async () => {
    setSaving(true)
    await fetch('/api/brands', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: brand.id,
        competitors,
        tone_of_voice: toneOfVoice,
        target_audience: targetAudience,
        // Store digest settings in extra_context as JSON suffix
        extra_context: [
          brand.extra_context?.replace(/\n---DIGEST_SETTINGS---[\s\S]*$/, '') ?? '',
          '---DIGEST_SETTINGS---',
          JSON.stringify(digestSettings),
        ].join('\n').trim() || null,
      }),
    })
    setSaving(false)
    router.refresh()
  }

  return (
    <div className="space-y-4">
      {/* Tab nav */}
      <div className="flex gap-1 border-b">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={cn(
              'flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 transition-colors -mb-px',
              activeTab === id
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/30'
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="max-w-2xl">
        {activeTab === 'profile' && (
          <BrandProfileForm brand={brand} />
        )}

        {activeTab === 'competitors' && (
          <div className="space-y-4">
            <CompetitorEditor competitors={competitors} onChange={setCompetitors} />
            <button
              onClick={handleSave}
              disabled={saving}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Competitors'}
            </button>
          </div>
        )}

        {activeTab === 'voice' && (
          <div className="space-y-4">
            <VoiceAudienceEditor
              toneOfVoice={toneOfVoice}
              targetAudience={targetAudience}
              onToneChange={setToneOfVoice}
              onAudienceChange={setTargetAudience}
            />
            <button
              onClick={handleSave}
              disabled={saving}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Voice & Audience'}
            </button>
          </div>
        )}

        {activeTab === 'digest' && (
          <div className="space-y-4">
            <DigestSettings settings={digestSettings} onChange={setDigestSettings} />
            <button
              onClick={handleSave}
              disabled={saving}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Digest Settings'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

'use client'

import type { VideoPreferences } from '@/types/database'

interface VideoPreferencesEditorProps {
  preferences: VideoPreferences
  onChange: (preferences: VideoPreferences) => void
  showAvatarId?: boolean
}

export function VideoPreferencesEditor({ preferences, onChange, showAvatarId }: VideoPreferencesEditorProps) {
  return (
    <div className="space-y-3">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Video Preferences
      </p>
      <p className="text-[11px] text-muted-foreground">
        Controls how AI-generated videos look: accent, presenter style, and background.
      </p>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-[10px] font-medium text-muted-foreground">Accent</label>
          <select
            value={preferences.accent ?? 'Australian'}
            onChange={e => onChange({ ...preferences, accent: e.target.value })}
            className="w-full rounded-md border border-border bg-background px-2 py-1 text-xs mt-0.5"
          >
            <option value="Australian">Australian</option>
            <option value="British">British</option>
            <option value="American">American</option>
            <option value="Indian">Indian</option>
            <option value="South African">South African</option>
            <option value="New Zealand">New Zealand</option>
          </select>
        </div>

        <div>
          <label className="text-[10px] font-medium text-muted-foreground">Presenter Style</label>
          <select
            value={preferences.presenter_style ?? 'professional'}
            onChange={e => onChange({ ...preferences, presenter_style: e.target.value })}
            className="w-full rounded-md border border-border bg-background px-2 py-1 text-xs mt-0.5"
          >
            <option value="professional">Professional</option>
            <option value="casual">Casual</option>
            <option value="friendly">Friendly</option>
            <option value="authoritative">Authoritative</option>
          </select>
        </div>
      </div>

      <div>
        <label className="text-[10px] font-medium text-muted-foreground">Background</label>
        <select
          value={preferences.background_preference ?? 'office'}
          onChange={e => onChange({ ...preferences, background_preference: e.target.value })}
          className="w-full rounded-md border border-border bg-background px-2 py-1 text-xs mt-0.5"
        >
          <option value="office">Office</option>
          <option value="studio">Studio</option>
          <option value="casual">Casual</option>
          <option value="outdoor">Outdoor</option>
          <option value="minimal">Minimal</option>
        </select>
      </div>

      {showAvatarId && (
        <div>
          <label className="text-[10px] font-medium text-muted-foreground">HeyGen Avatar ID</label>
          <input
            value={preferences.avatar_id ?? ''}
            onChange={e => onChange({ ...preferences, avatar_id: e.target.value })}
            placeholder="e.g., avatar_abc123"
            className="w-full rounded-md border border-border bg-background px-2 py-1 text-xs mt-0.5"
          />
          <p className="text-[10px] text-muted-foreground mt-0.5">
            Find this in your HeyGen dashboard under Avatars
          </p>
        </div>
      )}
    </div>
  )
}

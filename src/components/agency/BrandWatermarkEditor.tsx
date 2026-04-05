'use client'

import { useState } from 'react'
import type { Brand, BrandWatermark } from '@/types/database'

const POSITION_OPTIONS: { value: BrandWatermark['logo_position']; label: string }[] = [
  { value: 'top-left', label: 'Top Left' },
  { value: 'top-right', label: 'Top Right' },
  { value: 'bottom-left', label: 'Bottom Left' },
  { value: 'bottom-right', label: 'Bottom Right' },
]

interface BrandWatermarkEditorProps {
  brand: Brand
  onSave: (watermark: BrandWatermark) => void
  saving?: boolean
}

export function BrandWatermarkEditor({ brand, onSave, saving }: BrandWatermarkEditorProps) {
  const [watermark, setWatermark] = useState<BrandWatermark>(brand.watermark ?? {
    logo_enabled: false,
    logo_position: 'bottom-right',
    logo_opacity: 0.5,
    nrs_watermark_enabled: false,
    nrs_watermark_text: 'Created with NotRealSmart Digital Agency - Australia',
  })

  const update = (patch: Partial<BrandWatermark>) => {
    setWatermark(prev => ({ ...prev, ...patch }))
  }

  return (
    <div className="space-y-6">
      <div>
        <h3
          className="text-sm font-semibold"
          style={{ color: 'oklch(0.9 0.01 240)' }}
        >
          Branding & Watermark
        </h3>
        <p className="mt-1 text-xs" style={{ color: 'oklch(0.6 0.01 240)' }}>
          Add your brand logo and NotRealSmart signature to generated images and videos.
        </p>
      </div>

      {/* Brand Logo Watermark */}
      <div
        className="rounded-lg border p-4 space-y-4"
        style={{
          borderColor: 'oklch(0.3 0.01 240)',
          background: 'oklch(0.15 0.005 240)',
        }}
      >
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={watermark.logo_enabled ?? false}
            onChange={e => update({ logo_enabled: e.target.checked })}
            className="h-4 w-4 rounded accent-current"
            style={{ accentColor: 'oklch(0.7 0.15 240)' }}
          />
          <span className="text-sm font-medium" style={{ color: 'oklch(0.85 0.01 240)' }}>
            Add brand logo to generated images
          </span>
        </label>

        {watermark.logo_enabled && (
          <div className="ml-7 space-y-4">
            {/* Logo preview */}
            {brand.logo_url ? (
              <div className="flex items-center gap-3">
                <img
                  src={brand.logo_url}
                  alt={`${brand.name} logo`}
                  className="h-10 w-10 rounded object-contain"
                  style={{
                    opacity: watermark.logo_opacity ?? 0.5,
                    background: 'oklch(0.2 0.005 240)',
                  }}
                />
                <span className="text-xs" style={{ color: 'oklch(0.6 0.01 240)' }}>
                  Current logo (preview at {Math.round((watermark.logo_opacity ?? 0.5) * 100)}% opacity)
                </span>
              </div>
            ) : (
              <p className="text-xs" style={{ color: 'oklch(0.5 0.01 240)' }}>
                No logo uploaded yet. Add one in the Profile tab to enable logo watermarking.
              </p>
            )}

            {/* Position */}
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: 'oklch(0.7 0.01 240)' }}>
                Position
              </label>
              <select
                value={watermark.logo_position ?? 'bottom-right'}
                onChange={e => update({ logo_position: e.target.value as BrandWatermark['logo_position'] })}
                className="rounded-md border px-3 py-1.5 text-sm"
                style={{
                  borderColor: 'oklch(0.3 0.01 240)',
                  background: 'oklch(0.12 0.005 240)',
                  color: 'oklch(0.85 0.01 240)',
                }}
              >
                {POSITION_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>

            {/* Opacity */}
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: 'oklch(0.7 0.01 240)' }}>
                Opacity: {Math.round((watermark.logo_opacity ?? 0.5) * 100)}%
              </label>
              <input
                type="range"
                min={30}
                max={100}
                value={Math.round((watermark.logo_opacity ?? 0.5) * 100)}
                onChange={e => update({ logo_opacity: parseInt(e.target.value) / 100 })}
                className="w-full max-w-xs"
                style={{ accentColor: 'oklch(0.7 0.15 240)' }}
              />
              <div className="flex justify-between text-[10px] max-w-xs" style={{ color: 'oklch(0.5 0.01 240)' }}>
                <span>30% (subtle)</span>
                <span>100% (solid)</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* NRS Watermark */}
      <div
        className="rounded-lg border p-4 space-y-4"
        style={{
          borderColor: 'oklch(0.3 0.01 240)',
          background: 'oklch(0.15 0.005 240)',
        }}
      >
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={watermark.nrs_watermark_enabled ?? false}
            onChange={e => update({ nrs_watermark_enabled: e.target.checked })}
            className="h-4 w-4 rounded accent-current"
            style={{ accentColor: 'oklch(0.7 0.15 240)' }}
          />
          <span className="text-sm font-medium" style={{ color: 'oklch(0.85 0.01 240)' }}>
            Add &ldquo;Created with NotRealSmart&rdquo; signature
          </span>
        </label>

        {watermark.nrs_watermark_enabled && (
          <div className="ml-7 space-y-2">
            <label className="block text-xs font-medium" style={{ color: 'oklch(0.7 0.01 240)' }}>
              Signature text
            </label>
            <input
              type="text"
              value={watermark.nrs_watermark_text ?? 'Created with NotRealSmart Digital Agency - Australia'}
              onChange={e => update({ nrs_watermark_text: e.target.value })}
              className="w-full rounded-md border px-3 py-1.5 text-sm"
              style={{
                borderColor: 'oklch(0.3 0.01 240)',
                background: 'oklch(0.12 0.005 240)',
                color: 'oklch(0.85 0.01 240)',
              }}
              placeholder="Created with NotRealSmart Digital Agency - Australia"
            />
            <p className="text-[10px]" style={{ color: 'oklch(0.5 0.01 240)' }}>
              This text will be included as a small watermark on generated images and in video credits.
            </p>
          </div>
        )}
      </div>

      <button
        onClick={() => onSave(watermark)}
        disabled={saving}
        className="rounded-md px-4 py-2 text-sm font-medium transition-opacity disabled:opacity-50"
        style={{
          background: 'oklch(0.55 0.15 240)',
          color: 'oklch(0.95 0.01 240)',
        }}
      >
        {saving ? 'Saving...' : 'Save Watermark Settings'}
      </button>
    </div>
  )
}

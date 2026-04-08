/**
 * Platform-specific crop aspect ratio presets for the image editor.
 */

export interface CropPreset {
  label: string
  ratio: number // width / height
  platform: string
}

export const SOCIAL_CROP_PRESETS: CropPreset[] = [
  // Instagram
  { label: 'IG Post (1:1)', ratio: 1, platform: 'instagram' },
  { label: 'IG Portrait (4:5)', ratio: 4 / 5, platform: 'instagram' },
  { label: 'IG Story/Reel (9:16)', ratio: 9 / 16, platform: 'instagram' },

  // Facebook
  { label: 'FB Post (1:1)', ratio: 1, platform: 'facebook' },
  { label: 'FB Link (1.91:1)', ratio: 1.91, platform: 'facebook' },

  // LinkedIn
  { label: 'LI Post (1:1)', ratio: 1, platform: 'linkedin' },
  { label: 'LI Wide (1.91:1)', ratio: 1.91, platform: 'linkedin' },

  // TikTok
  { label: 'TikTok (9:16)', ratio: 9 / 16, platform: 'tiktok' },

  // YouTube
  { label: 'YT Thumbnail (16:9)', ratio: 16 / 9, platform: 'youtube' },

  // Pinterest
  { label: 'Pinterest (2:3)', ratio: 2 / 3, platform: 'pinterest' },

  // General
  { label: 'Square (1:1)', ratio: 1, platform: 'general' },
  { label: 'Landscape (16:9)', ratio: 16 / 9, platform: 'general' },
  { label: 'Portrait (9:16)', ratio: 9 / 16, platform: 'general' },
]

export function getPresetsForPlatform(platform?: string): CropPreset[] {
  if (!platform) return SOCIAL_CROP_PRESETS
  return [
    ...SOCIAL_CROP_PRESETS.filter(p => p.platform === platform),
    ...SOCIAL_CROP_PRESETS.filter(p => p.platform === 'general'),
  ]
}

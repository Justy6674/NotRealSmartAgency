import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Resolve HeyGen API key: user integration first, then platform env var.
 * Shared by create-video tool, /api/video/generate, and /api/heygen/* routes.
 */
export async function getHeyGenApiKey(
  supabase: SupabaseClient,
  userId: string
): Promise<string | null> {
  const { data: integration } = await supabase
    .from('user_integrations')
    .select('cached_data')
    .eq('user_id', userId)
    .eq('provider', 'heygen')
    .single()

  return (
    (integration?.cached_data?.api_key as string) ??
    process.env.HEYGEN_API_KEY ??
    null
  )
}

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface HeyGenAvatar {
  avatar_id: string
  avatar_name: string
  preview_image_url: string
  gender: string
}

export interface HeyGenVoice {
  voice_id: string
  display_name: string
  language: string
  gender: string
  preview_audio: string | null
}

/* ------------------------------------------------------------------ */
/*  API helpers                                                        */
/* ------------------------------------------------------------------ */

export async function fetchAvatars(apiKey: string): Promise<HeyGenAvatar[]> {
  const res = await fetch('https://api.heygen.com/v2/avatars', {
    headers: { 'X-Api-Key': apiKey },
  })
  if (!res.ok) throw new Error(`HeyGen avatars API error: ${res.status}`)
  const data = await res.json()
  // HeyGen returns { data: { avatars: [...] } }
  const avatars = data.data?.avatars ?? []
  return avatars.map((a: Record<string, unknown>) => ({
    avatar_id: a.avatar_id as string,
    avatar_name: (a.avatar_name as string) ?? (a.avatar_id as string),
    preview_image_url: (a.preview_image_url as string) ?? '',
    gender: (a.gender as string) ?? 'unknown',
  }))
}

export async function fetchVoices(apiKey: string): Promise<HeyGenVoice[]> {
  const res = await fetch('https://api.heygen.com/v2/voices', {
    headers: { 'X-Api-Key': apiKey },
  })
  if (!res.ok) throw new Error(`HeyGen voices API error: ${res.status}`)
  const data = await res.json()
  const voices = data.data?.voices ?? []
  // Filter to English voices only
  return voices
    .filter((v: Record<string, unknown>) =>
      ((v.language as string) ?? '').toLowerCase().includes('english')
    )
    .map((v: Record<string, unknown>) => ({
      voice_id: v.voice_id as string,
      display_name:
        (v.display_name as string) ??
        (v.name as string) ??
        (v.voice_id as string),
      language: (v.language as string) ?? 'English',
      gender: (v.gender as string) ?? 'unknown',
      preview_audio: (v.preview_audio as string) ?? null,
    }))
}

export async function fetchCredits(apiKey: string): Promise<number> {
  const res = await fetch('https://api.heygen.com/v2/user/remaining_quota', {
    headers: { 'X-Api-Key': apiKey },
  })
  if (!res.ok) return -1
  const data = await res.json()
  return (data.data?.remaining_quota as number) ?? -1
}

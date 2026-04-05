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

/* ------------------------------------------------------------------ */
/*  Video Agent                                                        */
/* ------------------------------------------------------------------ */

export interface VideoAgentOptions {
  prompt: string
  avatar_id?: string
  voice_id?: string
  duration_sec?: number
  orientation?: 'portrait' | 'landscape'
  callback_url?: string
}

export async function generateVideoAgent(
  apiKey: string,
  options: VideoAgentOptions
): Promise<{ video_id: string } | null> {
  const res = await fetch('https://api.heygen.com/v1/video_agent/generate', {
    method: 'POST',
    headers: { 'X-Api-Key': apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      prompt: options.prompt,
      config: {
        avatar_id: options.avatar_id,
        duration_sec: options.duration_sec ?? 60,
        orientation: options.orientation ?? 'portrait',
      },
      callback_url: options.callback_url,
    }),
  })
  if (!res.ok) return null
  const data = await res.json()
  return { video_id: data.data?.video_id ?? '' }
}

/* ------------------------------------------------------------------ */
/*  Video Translation                                                  */
/* ------------------------------------------------------------------ */

export async function translateVideo(
  apiKey: string,
  videoUrl: string,
  targetLanguage: string,
  title?: string
): Promise<{ video_translate_id: string } | null> {
  const res = await fetch('https://api.heygen.com/v2/video_translate', {
    method: 'POST',
    headers: { 'X-Api-Key': apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ video_url: videoUrl, output_language: targetLanguage, title }),
  })
  if (!res.ok) return null
  const data = await res.json()
  return { video_translate_id: data.data?.video_translate_id ?? '' }
}

export async function getTranslationStatus(
  apiKey: string,
  id: string
): Promise<{ status: string; url?: string } | null> {
  const res = await fetch(`https://api.heygen.com/v2/video_translate/${id}`, {
    headers: { 'X-Api-Key': apiKey },
  })
  if (!res.ok) return null
  const data = await res.json()
  return { status: data.data?.status ?? 'pending', url: data.data?.url }
}

/* ------------------------------------------------------------------ */
/*  Templates                                                          */
/* ------------------------------------------------------------------ */

export interface HeyGenTemplate {
  template_id: string
  name: string
  thumbnail_image_url?: string
}

export async function fetchTemplates(apiKey: string): Promise<HeyGenTemplate[]> {
  const res = await fetch('https://api.heygen.com/v2/templates', {
    headers: { 'X-Api-Key': apiKey },
  })
  if (!res.ok) return []
  const data = await res.json()
  return (data.data?.templates ?? []).map((t: Record<string, unknown>) => ({
    template_id: t.template_id as string,
    name: (t.name as string) ?? (t.template_id as string),
    thumbnail_image_url: t.thumbnail_image_url as string | undefined,
  }))
}

export async function fetchTemplate(
  apiKey: string,
  id: string
): Promise<Record<string, unknown> | null> {
  const res = await fetch(`https://api.heygen.com/v3/template/${id}`, {
    headers: { 'X-Api-Key': apiKey },
  })
  if (!res.ok) return null
  const data = await res.json()
  return data.data as Record<string, unknown>
}

export async function generateFromTemplate(
  apiKey: string,
  templateId: string,
  variables: Record<string, unknown>,
  title?: string
): Promise<{ video_id: string } | null> {
  const res = await fetch(`https://api.heygen.com/v2/template/${templateId}/generate`, {
    method: 'POST',
    headers: { 'X-Api-Key': apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ test: false, caption: false, title, variables }),
  })
  if (!res.ok) return null
  const data = await res.json()
  return { video_id: data.data?.video_id ?? '' }
}

/* ------------------------------------------------------------------ */
/*  Photo Avatar                                                       */
/* ------------------------------------------------------------------ */

export async function generatePhotoAvatar(
  apiKey: string,
  options: {
    age?: string
    gender?: string
    ethnicity?: string
    pose?: string
    style?: string
    appearance?: string
  }
): Promise<{ photo_avatar_id: string; image_url: string } | null> {
  const res = await fetch('https://api.heygen.com/v2/photo_avatar/photo/generate', {
    method: 'POST',
    headers: { 'X-Api-Key': apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify(options),
  })
  if (!res.ok) return null
  const data = await res.json()
  return {
    photo_avatar_id: data.data?.id ?? '',
    image_url: data.data?.image_url ?? '',
  }
}

/* ------------------------------------------------------------------ */
/*  Text-to-Speech                                                     */
/* ------------------------------------------------------------------ */

export async function textToSpeech(
  apiKey: string,
  text: string,
  voiceId: string,
  speed?: number
): Promise<{ audio_url: string; duration: number } | null> {
  const res = await fetch('https://api.heygen.com/v1/audio/text_to_speech', {
    method: 'POST',
    headers: { 'X-Api-Key': apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, voice_id: voiceId, speed: speed ?? 1.0 }),
  })
  if (!res.ok) return null
  const data = await res.json()
  return { audio_url: data.data?.url ?? '', duration: data.data?.duration ?? 0 }
}

/* ------------------------------------------------------------------ */
/*  Talking Photos                                                     */
/* ------------------------------------------------------------------ */

export async function fetchTalkingPhotos(
  apiKey: string
): Promise<Array<{ id: string; image_url: string }>> {
  const res = await fetch('https://api.heygen.com/v1/talking_photo.list', {
    headers: { 'X-Api-Key': apiKey },
  })
  if (!res.ok) return []
  const data = await res.json()
  return data.data?.talking_photos ?? []
}

export async function uploadTalkingPhoto(
  apiKey: string,
  imageUrl: string
): Promise<{ talking_photo_id: string } | null> {
  const res = await fetch('https://api.heygen.com/v1/talking_photo', {
    method: 'POST',
    headers: { 'X-Api-Key': apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ image_url: imageUrl }),
  })
  if (!res.ok) return null
  const data = await res.json()
  return { talking_photo_id: data.data?.talking_photo_id ?? '' }
}

/* ------------------------------------------------------------------ */
/*  Assets                                                             */
/* ------------------------------------------------------------------ */

export async function fetchAssets(
  apiKey: string
): Promise<Array<{ id: string; name: string; type: string; url: string }>> {
  const res = await fetch('https://api.heygen.com/assets', {
    headers: { 'X-Api-Key': apiKey },
  })
  if (!res.ok) return []
  const data = await res.json()
  return data.data?.assets ?? []
}

/* ------------------------------------------------------------------ */
/*  Videos                                                             */
/* ------------------------------------------------------------------ */

export async function fetchVideos(
  apiKey: string
): Promise<
  Array<{
    video_id: string
    title: string
    status: string
    video_url?: string
    thumbnail_url?: string
  }>
> {
  const res = await fetch('https://api.heygen.com/v2/videos', {
    headers: { 'X-Api-Key': apiKey },
  })
  if (!res.ok) return []
  const data = await res.json()
  return data.data?.videos ?? []
}

export async function getVideoShareUrl(
  apiKey: string,
  videoId: string
): Promise<string | null> {
  const res = await fetch(
    `https://api.heygen.com/v2/videos/${videoId}/shareable-url`,
    { headers: { 'X-Api-Key': apiKey } }
  )
  if (!res.ok) return null
  const data = await res.json()
  return data.data?.url ?? null
}

/* ------------------------------------------------------------------ */
/*  Brand Glossary                                                     */
/* ------------------------------------------------------------------ */

export async function fetchBrandGlossary(
  apiKey: string
): Promise<Array<{ id: string; word: string; pronunciation: string }>> {
  const res = await fetch('https://api.heygen.com/brand-glossary', {
    headers: { 'X-Api-Key': apiKey },
  })
  if (!res.ok) return []
  const data = await res.json()
  return data.data?.entries ?? []
}

/* ------------------------------------------------------------------ */
/*  Voice Locales                                                      */
/* ------------------------------------------------------------------ */

export async function fetchVoiceLocales(
  apiKey: string
): Promise<Array<{ locale: string; language: string }>> {
  const res = await fetch('https://api.heygen.com/v2/voices/locales', {
    headers: { 'X-Api-Key': apiKey },
  })
  if (!res.ok) return []
  const data = await res.json()
  return data.data?.locales ?? []
}

/* ------------------------------------------------------------------ */
/*  Webhooks                                                           */
/* ------------------------------------------------------------------ */

export async function addWebhookEndpoint(
  apiKey: string,
  url: string,
  events: string[]
): Promise<boolean> {
  const res = await fetch('https://api.heygen.com/v1/webhook/endpoint.add', {
    method: 'POST',
    headers: { 'X-Api-Key': apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ url, events }),
  })
  return res.ok
}

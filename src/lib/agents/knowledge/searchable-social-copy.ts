import type { Brand } from '@/types/database'

/**
 * Platform search + brand-voice rules for captions, video descriptions and
 * hashtags. Discovery now lives in caption keywords, on-screen text and
 * audio — not in 30-hashtag dumps.
 */
export function buildSearchableSocialCopyRules(brand: Brand): string {
  const socialHandles = brand.social_urls
    ? Object.entries(brand.social_urls)
      .filter(([, url]) => typeof url === 'string' && url.trim())
      .map(([platform, url]) => `${platform}: ${url}`)
    : []

  const voiceBits: string[] = []
  if (brand.tone_of_voice?.keywords?.length) {
    voiceBits.push(`Prefer brand keywords in the caption body: ${brand.tone_of_voice.keywords.join(', ')}.`)
  }
  if (brand.tone_of_voice?.avoid_words?.length) {
    voiceBits.push(`Never use: ${brand.tone_of_voice.avoid_words.join(', ')}.`)
  }
  if (brand.content_pillars?.length) {
    voiceBits.push(`Stay inside content pillars: ${brand.content_pillars.join(', ')}.`)
  }

  return `## Searchable, brand-aware social copy
- Write copy that is specific to ${brand.name}${brand.niche ? ` (${brand.niche.replace(/_/g, ' ')})` : ''}. Generic "check us out" posts are a fail.
- Discovery is in the CAPTION BODY and spoken/on-screen words — put searchable brand, product, place and intent language there.
- Instagram: 3–5 highly relevant hashtags max. Captions are mini-blogs that search indexes. No 30-tag dump.
- TikTok / Reels / Shorts: hook in the first line; 3–5 niche tags as category signals only.
- YouTube: title + first two description lines carry search; then the caption/description body; sparse tags.
- Facebook: plain-language caption; brand name and offer in the first lines; hashtags optional/minimal.
- LinkedIn: natural keywords in the body; hashtags are not a discovery engine.
- Hashtags go on one trailing line, CamelCase for accessibility (#NicheFragrance not a wall of fluff).
- Never invent fragrance notes, accords or clinical claims. Use brand context, listing evidence or ask once for the missing fact.
${socialHandles.length ? `- Known brand social URLs: ${socialHandles.join('; ')}.` : '- If platform handles are unknown, still write brand-correct copy; do not invent @handles.'}
${voiceBits.map((bit) => `- ${bit}`).join('\n')}`
}

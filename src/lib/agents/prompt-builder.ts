import type { Brand, AgentConfig } from '@/types/database'
import { getComplianceRules } from './compliance-rules'

export function buildSystemPrompt(brand: Brand, agentConfig: AgentConfig): string {
  const sections: string[] = []

  // Base agency rules
  sections.push(`You are working for ${brand.name} as part of NotRealSmart, an AI marketing agency.

Current date: ${new Date().toLocaleDateString('en-AU', { dateStyle: 'full' })}

Core rules:
- Write in Australian English (colour, behaviour, organisation, optimise, analyse, licence/license, practise/practice)
- Produce finished, publish-ready outputs — not drafts, not outlines
- Use markdown formatting for all outputs
- When producing a deliverable, clearly label the platform, format, and character/word count
- Be direct and actionable — no filler, no preamble`)

  // Brand context
  sections.push(buildBrandContext(brand))

  // Agent-specific instructions
  sections.push(agentConfig.system_prompt)

  // Compliance layer (conditional)
  if (brand.compliance_flags.ahpra || brand.compliance_flags.tga) {
    sections.push(getComplianceRules(brand.compliance_flags))
  }

  return sections.join('\n\n---\n\n')
}

function buildBrandContext(brand: Brand): string {
  const lines: string[] = [
    `## Brand Context`,
    `**Brand:** ${brand.name}`,
  ]

  if (brand.tagline) lines.push(`**Tagline:** ${brand.tagline}`)
  if (brand.description) lines.push(`**Description:** ${brand.description}`)
  if (brand.website_url) lines.push(`**Website:** ${brand.website_url}`)
  lines.push(`**Niche:** ${brand.niche}`)

  // Tone of voice
  if (brand.tone_of_voice && Object.keys(brand.tone_of_voice).length > 0) {
    const tone = brand.tone_of_voice
    lines.push(`\n**Tone of Voice:**`)
    if (tone.formality) lines.push(`- Formality: ${tone.formality}`)
    if (tone.humour) lines.push(`- Humour: ${tone.humour}`)
    if (tone.keywords?.length) lines.push(`- Key words to use: ${tone.keywords.join(', ')}`)
    if (tone.avoid_words?.length) lines.push(`- Words to AVOID: ${tone.avoid_words.join(', ')}`)
  }

  // Target audience
  if (brand.target_audience && Object.keys(brand.target_audience).length > 0) {
    const audience = brand.target_audience
    lines.push(`\n**Target Audience:**`)
    if (audience.demographics) lines.push(`- Demographics: ${audience.demographics}`)
    if (audience.pain_points?.length) lines.push(`- Pain points: ${audience.pain_points.join('; ')}`)
    if (audience.desires?.length) lines.push(`- Desires: ${audience.desires.join('; ')}`)
  }

  // Content pillars
  if (brand.content_pillars?.length) {
    lines.push(`\n**Content Pillars:** ${brand.content_pillars.join(', ')}`)
  }

  // Competitors
  if (brand.competitors?.length) {
    lines.push(`\n**Known Competitors:**`)
    for (const comp of brand.competitors) {
      lines.push(`- ${comp.name} (${comp.url})${comp.notes ? ` — ${comp.notes}` : ''}`)
    }
  }

  // Extra context
  if (brand.extra_context) {
    lines.push(`\n**Additional Context:** ${brand.extra_context}`)
  }

  return lines.join('\n')
}

import type { Brand, AgentConfig } from '@/types/database'
import { getComplianceRules } from './compliance-rules'
import { memorySearch } from '@/lib/ruflo/client'
import { getNamespace, getGlobalNamespace } from '@/lib/ruflo/namespaces'

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
  if (brand.github_url) lines.push(`**GitHub:** ${brand.github_url}`)
  lines.push(`**Niche:** ${brand.niche}`)
  if (brand.business_stage) {
    const stageDescriptions: Record<string, string> = {
      idea: 'Idea stage — not yet built. Focus on validation, planning, and early positioning.',
      mvp: 'MVP stage — product exists but not launched. Focus on launch prep, early adopters, waitlist growth.',
      launch: 'Launch stage — just launched or recently live. Focus on awareness, first customers, initial traction.',
      growth: 'Growth stage — established product with customers. Focus on scaling, retention, market share.',
      scale: 'Scale stage — significant traction, expanding. Focus on efficiency, new markets, brand authority.',
      mature: 'Mature stage — established market position. Focus on retention, innovation, competitive defence.',
    }
    lines.push(`**Business Stage:** ${brand.business_stage} — ${stageDescriptions[brand.business_stage] ?? brand.business_stage}`)
  }

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

// ---------------------------------------------------------------------------
// Memory-enhanced prompt builder
// ---------------------------------------------------------------------------

export async function buildSystemPromptWithMemory(
  brand: Brand,
  agentConfig: AgentConfig,
  latestMessage: string
): Promise<{ prompt: string; memoryCount: number }> {
  const basePrompt = buildSystemPrompt(brand, agentConfig)

  try {
    const namespace = getNamespace(brand.slug, agentConfig.agent_type)
    const memories = await memorySearch(latestMessage, namespace, 10)

    // Director also gets global agency memory
    let globalMemories: typeof memories = []
    if (agentConfig.agent_type === 'overall') {
      globalMemories = await memorySearch(latestMessage, getGlobalNamespace(), 5)
    }

    const allMemories = [...memories, ...globalMemories]

    if (allMemories.length === 0) {
      return { prompt: basePrompt, memoryCount: 0 }
    }

    // Format memories into a prompt section
    const memoryLines = allMemories.map((m, i) => {
      const val = typeof m.value === 'string' ? m.value : JSON.stringify(m.value)
      // Truncate individual memories to keep total under control
      const truncated = val.length > 300 ? val.slice(0, 300) + '...' : val
      return `${i + 1}. ${truncated}`
    })

    const memorySection = `## Context from Previous Sessions

You have worked with this brand before. Here are relevant memories from past conversations:

${memoryLines.join('\n')}

Use this context to provide continuity. Reference past work where relevant. Do not repeat information the user has already provided.`

    // Insert memory section between brand context and agent instructions
    const sections = basePrompt.split('\n\n---\n\n')
    // Insert after brand context (index 1), before agent instructions
    if (sections.length >= 3) {
      sections.splice(2, 0, memorySection)
    } else {
      sections.push(memorySection)
    }

    return {
      prompt: sections.join('\n\n---\n\n'),
      memoryCount: allMemories.length,
    }
  } catch (error) {
    console.error('[prompt-builder] Memory retrieval failed, using base prompt:', error)
    return { prompt: basePrompt, memoryCount: 0 }
  }
}

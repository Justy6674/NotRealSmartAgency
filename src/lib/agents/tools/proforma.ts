/**
 * Proforma tools — read_proforma + update_proforma
 *
 * read_proforma: available to ALL agents (everyone checks the proforma before work)
 * update_proforma: available to Director ONLY (single source of truth updates)
 */

import { tool } from 'ai'
import { z } from 'zod/v3'
import type { SupabaseClient } from '@supabase/supabase-js'
import { PROFORMA_SECTION_KEYS, CADENCE_DAYS, type ReviewCadence } from '@/lib/proforma/sections'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isStale(updatedAt: string, cadence: string): boolean {
  const maxDays = CADENCE_DAYS[cadence as ReviewCadence] ?? 30
  const age = (Date.now() - new Date(updatedAt).getTime()) / (1000 * 60 * 60 * 24)
  return age > maxDays
}

function formatDate(iso: string | null): string {
  if (!iso) return 'never'
  return new Date(iso).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })
}

function ragEmoji(status: string): string {
  switch (status) {
    case 'green': return '[GREEN]'
    case 'amber': return '[AMBER]'
    case 'red': return '[RED]'
    default: return '[UNKNOWN]'
  }
}

function formatSectionData(data: Record<string, unknown>): string {
  const lines: string[] = []
  for (const [key, value] of Object.entries(data)) {
    if (value === null || value === undefined) continue
    const label = key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
    if (Array.isArray(value)) {
      if (value.length === 0) continue
      if (typeof value[0] === 'object') {
        lines.push(`**${label}:**`)
        for (const item of value) {
          const desc = Object.entries(item as Record<string, unknown>)
            .filter(([, v]) => v !== null && v !== undefined)
            .map(([k, v]) => `${k}: ${v}`)
            .join(', ')
          lines.push(`  - ${desc}`)
        }
      } else {
        lines.push(`**${label}:** ${value.join(', ')}`)
      }
    } else if (typeof value === 'object') {
      const desc = Object.entries(value as Record<string, unknown>)
        .filter(([, v]) => v !== null && v !== undefined)
        .map(([k, v]) => `${k}: ${v}`)
        .join(', ')
      if (desc) lines.push(`**${label}:** ${desc}`)
    } else {
      lines.push(`**${label}:** ${String(value)}`)
    }
  }
  return lines.length > 0 ? lines.join('\n') : '_No data recorded yet._'
}

// ---------------------------------------------------------------------------
// read_proforma
// ---------------------------------------------------------------------------

export function createReadProformaTool(
  supabase: SupabaseClient,
  brandId: string
) {
  return tool({
    description:
      'Read the Master Marketing Proforma for this brand. Returns the executive snapshot and status overview by default, or a specific section if requested. Always check this before creating content or making recommendations.',
    inputSchema: z.object({
      section: z.enum(PROFORMA_SECTION_KEYS).optional().describe(
        'Specific section to read in full. Omit for the executive snapshot + status overview of all sections.'
      ),
    }),
    execute: async ({ section }) => {
      const { data: sections, error } = await supabase
        .from('brand_proforma_sections')
        .select('section_key, section_title, section_data, rag_status, review_cadence, updated_at, last_reviewed_at')
        .eq('brand_id', brandId)
        .order('created_at', { ascending: true })

      if (error || !sections?.length) {
        return 'No proforma found for this brand. It may need to be initialised — try asking the Director to set one up.'
      }

      // Specific section requested
      if (section) {
        const found = sections.find(s => s.section_key === section)
        if (!found) return `Section "${section}" not found in the proforma.`

        const stale = isStale(found.updated_at, found.review_cadence)
        const header = `## ${found.section_title} ${ragEmoji(found.rag_status)}${stale ? ' **STALE**' : ''}\n`
        const meta = `_Last updated: ${formatDate(found.updated_at)} | Cadence: ${found.review_cadence} | Last reviewed: ${formatDate(found.last_reviewed_at)}_\n\n`
        return header + meta + formatSectionData(found.section_data as Record<string, unknown>)
      }

      // Full overview — executive snapshot + status table
      const snapshot = sections.find(s => s.section_key === 'executive_snapshot')
      const lines: string[] = []

      if (snapshot) {
        lines.push('## Executive Snapshot')
        lines.push(formatSectionData(snapshot.section_data as Record<string, unknown>))
        lines.push('')
      }

      lines.push('## Proforma Status Overview')
      lines.push('')
      lines.push('| Section | Status | Last Updated | Stale? |')
      lines.push('|---------|--------|--------------|--------|')

      for (const s of sections) {
        const stale = isStale(s.updated_at, s.review_cadence)
        lines.push(`| ${s.section_title} | ${ragEmoji(s.rag_status)} | ${formatDate(s.updated_at)} | ${stale ? '**YES**' : 'No'} |`)
      }

      const staleCount = sections.filter(s => isStale(s.updated_at, s.review_cadence)).length
      if (staleCount > 0) {
        lines.push('')
        lines.push(`**${staleCount} section(s) are stale and need review.**`)
      }

      return lines.join('\n')
    },
  })
}

// ---------------------------------------------------------------------------
// update_proforma
// ---------------------------------------------------------------------------

export function createUpdateProformaTool(
  supabase: SupabaseClient,
  brandId: string,
  conversationId: string | null
) {
  return tool({
    description:
      'Update a section of the Master Marketing Proforma. Data is merged (not replaced). Use this after every significant conversation to keep the proforma current. Also logs decisions, wins, and learnings to the conversation log.',
    inputSchema: z.object({
      section: z.enum(PROFORMA_SECTION_KEYS).describe('Section to update'),
      data: z.record(z.unknown()).describe('Data to merge into this section (keys are merged, not replaced wholesale)'),
      rag_status: z.enum(['red', 'amber', 'green']).optional().describe('Updated RAG status for this section'),
      decisions: z.array(z.string()).optional().describe('Key decisions to log'),
      wins: z.array(z.string()).optional().describe('Wins to record'),
      learnings: z.array(z.string()).optional().describe('Learnings to capture'),
    }),
    execute: async ({ section, data, rag_status, decisions, wins, learnings }) => {
      // Fetch current section
      const { data: existing, error: fetchError } = await supabase
        .from('brand_proforma_sections')
        .select('id, section_data')
        .eq('brand_id', brandId)
        .eq('section_key', section)
        .single()

      if (fetchError || !existing) {
        return `Could not find proforma section "${section}". The proforma may need to be initialised first.`
      }

      // JSONB merge — shallow merge of top-level keys
      const currentData = (existing.section_data ?? {}) as Record<string, unknown>
      const mergedData: Record<string, unknown> = { ...currentData }

      for (const [key, value] of Object.entries(data)) {
        // For arrays, append rather than replace (deduplicating)
        if (Array.isArray(value) && Array.isArray(currentData[key])) {
          const existingArr = currentData[key] as unknown[]
          const newItems = (value as unknown[]).filter(item => {
            const itemStr = JSON.stringify(item)
            return !existingArr.some(e => JSON.stringify(e) === itemStr)
          })
          mergedData[key] = [...existingArr, ...newItems]
        } else {
          mergedData[key] = value
        }
      }

      // Update section
      const updatePayload: Record<string, unknown> = {
        section_data: mergedData,
        last_reviewed_at: new Date().toISOString(),
      }
      if (rag_status) {
        updatePayload.rag_status = rag_status
      }

      const { error: updateError } = await supabase
        .from('brand_proforma_sections')
        .update(updatePayload)
        .eq('id', existing.id)

      if (updateError) {
        return `Failed to update proforma section "${section}": ${updateError.message}`
      }

      // Log to conversation log if there are decisions/wins/learnings
      const hasLogEntries = (decisions?.length ?? 0) > 0 || (wins?.length ?? 0) > 0 || (learnings?.length ?? 0) > 0
      if (hasLogEntries) {
        await supabase.from('brand_conversation_log').insert({
          brand_id: brandId,
          conversation_id: conversationId,
          summary: `Updated proforma section: ${section}`,
          decisions: decisions ?? [],
          action_items: [],
          wins: wins ?? [],
          learnings: learnings ?? [],
        })
      }

      const parts = [`Updated "${section}" in the proforma.`]
      if (rag_status) parts.push(`Status set to ${rag_status.toUpperCase()}.`)
      if (decisions?.length) parts.push(`Logged ${decisions.length} decision(s).`)
      if (wins?.length) parts.push(`Recorded ${wins.length} win(s).`)
      if (learnings?.length) parts.push(`Captured ${learnings.length} learning(s).`)

      return parts.join(' ')
    },
  })
}

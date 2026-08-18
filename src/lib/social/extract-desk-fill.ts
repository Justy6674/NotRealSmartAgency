import type { UIMessage } from 'ai'
import type { SocialDeskAction } from './actions'
import { SocialDeskActionSchema } from './schemas'

export interface ExtractedDeskFill {
  fillId: string
  toolCallId: string
  actions: SocialDeskAction[]
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

function parseActions(raw: unknown): SocialDeskAction[] {
  if (!Array.isArray(raw)) return []
  const actions: SocialDeskAction[] = []
  for (const item of raw) {
    const parsed = SocialDeskActionSchema.safeParse(item)
    if (parsed.success) actions.push(parsed.data)
  }
  return actions
}

/**
 * Pull a completed fill_compose_desk result off a streamed assistant message.
 */
export function extractDeskFillFromMessage(message: UIMessage): ExtractedDeskFill | null {
  if (message.role !== 'assistant') return null
  const parts = message.parts ?? []
  for (const part of parts) {
    if (!part || typeof part !== 'object') continue
    const typed = part as {
      type?: string
      toolCallId?: string
      state?: string
      output?: unknown
    }
    const type = typed.type ?? ''
    if (type !== 'tool-fill_compose_desk' && type !== 'tool-fill-compose-desk') continue
    if (typed.state && typed.state !== 'result' && typed.state !== 'output-available') continue
    const output = asRecord(typed.output)
    if (!output || output.success !== true) continue
    const actions = parseActions(output.desk_actions)
    if (actions.length === 0) continue
    const fillId = typeof output.fill_id === 'string' ? output.fill_id : typed.toolCallId ?? message.id
    return {
      fillId,
      toolCallId: typed.toolCallId ?? fillId,
      actions,
    }
  }
  return null
}

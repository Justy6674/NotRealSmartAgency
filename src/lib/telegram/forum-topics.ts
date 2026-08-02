/**
 * One Telegram forum topic per project.
 *
 * Selecting a project before every message is friction the owner should not
 * have: he already runs a forum group where each project has its own topic and
 * the thread itself says which project he means. This does the same for NRS —
 * post in the ScentSell topic and the Director works on ScentSell, with no
 * picker and no ambiguity.
 *
 * Telegram delivers a forum message with `message_thread_id`. The mapping from
 * that thread to a project grant is stored in telegram_project_sessions, which
 * already carries the account, the grant and the brand.
 */

import type { SupabaseClient } from '@supabase/supabase-js'

export interface TopicRoute {
  grantId: string
  projectId: string
}

/** Read the forum thread id off an incoming message, if it is in one. */
export function readThreadId(message: Record<string, unknown>): number | null {
  const id = message.message_thread_id
  return typeof id === 'number' ? id : null
}

/**
 * Which project this thread belongs to.
 *
 * Returns null when the thread is unmapped, so the caller falls back to the
 * selected-project behaviour rather than guessing a brand — posting a ScentSell
 * caption to Underground Parfums is worse than asking.
 */
export async function routeByTopic(
  supabase: SupabaseClient,
  chatId: string,
  threadId: number | null,
): Promise<TopicRoute | null> {
  if (threadId === null) return null

  // Keyed on the CHAT, not the person. A topic means the same project to
  // everyone in the group — otherwise only whoever ran setup could use them,
  // and a second member posting in the ScentSell topic would be asked to pick
  // a project in a room where the picker's buttons do not work.
  //
  // This grants nothing. The caller still has to hold a grant for whatever
  // project comes back.
  const { data, error } = await supabase
    .from('telegram_project_sessions')
    .select('project_access_grant_id, brand_id')
    .eq('telegram_chat_id', chatId)
    .eq('message_thread_id', threadId)
    .eq('status', 'topic')
    .maybeSingle()

  if (error || !data) return null
  return {
    grantId: data.project_access_grant_id as string,
    projectId: data.brand_id as string,
  }
}

/**
 * Create a forum topic per project and remember which is which.
 *
 * Idempotent: a project that already has a topic in this chat keeps it, so
 * running setup twice does not litter the group with duplicates.
 */
export async function createTopicsForProjects({
  supabase,
  botToken,
  chatId,
  telegramAccountId,
  projects,
}: {
  supabase: SupabaseClient
  botToken: string
  chatId: string
  telegramAccountId: string
  projects: Array<{ grantId: string; projectId: string; projectName: string }>
}): Promise<{ created: string[]; existing: string[]; failed: Array<{ name: string; reason: string }> }> {
  const created: string[] = []
  const existing: string[] = []
  const failed: Array<{ name: string; reason: string }> = []

  const { data: alreadyMapped } = await supabase
    .from('telegram_project_sessions')
    .select('brand_id')
    .eq('telegram_chat_id', chatId)
    .eq('status', 'topic')

  const mapped = new Set((alreadyMapped ?? []).map((row) => row.brand_id as string))

  for (const project of projects) {
    if (mapped.has(project.projectId)) {
      existing.push(project.projectName)
      continue
    }

    const response = await fetch(`https://api.telegram.org/bot${botToken}/createForumTopic`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, name: project.projectName }),
    })
    const body = (await response.json()) as {
      ok?: boolean
      description?: string
      result?: { message_thread_id?: number }
    }

    if (!body.ok || !body.result?.message_thread_id) {
      failed.push({
        name: project.projectName,
        reason: body.description ?? 'Telegram refused to create the topic',
      })
      continue
    }

    const { error } = await supabase.from('telegram_project_sessions').insert({
      telegram_account_id: telegramAccountId,
      telegram_chat_id: chatId,
      project_access_grant_id: project.grantId,
      brand_id: project.projectId,
      status: 'topic',
      message_thread_id: body.result.message_thread_id,
    })

    if (error) {
      failed.push({ name: project.projectName, reason: `Topic made but not linked: ${error.message}` })
      continue
    }
    created.push(project.projectName)
  }

  return { created, existing, failed }
}

/** What to say back once setup has run. */
export function describeTopicSetup(result: {
  created: string[]
  existing: string[]
  failed: Array<{ name: string; reason: string }>
}): string {
  const lines: string[] = []
  if (result.created.length > 0) {
    lines.push(`Made a topic for: ${result.created.join(', ')}.`)
  }
  if (result.existing.length > 0) {
    lines.push(`Already had one: ${result.existing.join(', ')}.`)
  }
  // Telegram will not create a topic in a group that has not had Topics turned
  // on, and only a human admin can turn it on. Saying "the chat is not a
  // forum" is true and useless; say where the switch is.
  const notAForum = result.failed.some((f) => /not a forum|topics? (?:are|is) disabled/i.test(f.reason))
  if (notAForum) {
    lines.push(
      'This group does not have Topics turned on yet, and only a group admin can turn them on.',
      'Open the group → Edit → Topics → switch it on, then send "set up topics" here again.',
    )
    return lines.join('\n')
  }

  if (result.failed.length > 0) {
    lines.push(
      `Could not set up: ${result.failed.map((f) => `${f.name} (${f.reason})`).join('; ')}.`,
    )
  }
  if (result.created.length > 0 || result.existing.length > 0) {
    lines.push('Post in a topic and I work on that project — no need to pick one first.')
  }
  return lines.join('\n') || 'Nothing to set up — no projects are connected to Telegram yet.'
}

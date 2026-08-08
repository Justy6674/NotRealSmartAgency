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

/**
 * What a topic means.
 *
 * `director` is a deliberate answer, not an absence: the front door works
 * across every project the person holds, and only narrows when they name one.
 */
export type TopicRoute =
  | { kind: 'brand'; grantId: string; projectId: string }
  | { kind: 'director' }

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

  // A topic with no brand is the DIRECTOR topic — the front door. It is a real
  // mapping, not a missing one, and it means "work across everything unless I
  // name a project". Returning null here would send it down the guessing path
  // and land it on whichever brand was last selected, which is exactly the
  // behaviour that made the Director look like it only knew one business.
  if (data.brand_id === null) return { kind: 'director' }

  return {
    kind: 'brand',
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
  directorTopicName,
}: {
  supabase: SupabaseClient
  botToken: string
  chatId: string
  telegramAccountId: string
  projects: Array<{ grantId: string; projectId: string; projectName: string }>
  /**
   * A topic that belongs to no single brand — the front door for anything
   * cross-brand, or for deciding which brand to work on next. Posting there
   * falls through to the selected project rather than being pinned to one.
   */
  directorTopicName?: string | null
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

  // The Director topic first, so it sits at the top of the group's topic list
  // where a front door belongs. It is deliberately NOT recorded against a
  // brand: a message there must fall through to the selected project rather
  // than be pinned to one.
  if (directorTopicName) {
    const { data: existingDirector } = await supabase
      .from('telegram_project_sessions')
      .select('id')
      .eq('telegram_chat_id', chatId)
      .eq('status', 'topic')
      .is('brand_id', null)
      .maybeSingle()

    if (existingDirector) {
      existing.push(directorTopicName)
    } else {
      const response = await fetch(`https://api.telegram.org/bot${botToken}/createForumTopic`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, name: directorTopicName }),
      })
      const body = (await response.json()) as {
        ok?: boolean
        description?: string
        result?: { message_thread_id?: number }
      }
      if (body.ok && body.result?.message_thread_id) {
        const { error } = await supabase.from('telegram_project_sessions').insert({
          telegram_account_id: telegramAccountId,
          telegram_chat_id: chatId,
          status: 'topic',
          message_thread_id: body.result.message_thread_id,
        })
        if (error) {
          await deleteForumTopic(botToken, chatId, body.result.message_thread_id)
          console.error('[topics] could not link the Director topic:', error.message)
          failed.push({ name: directorTopicName, reason: 'could not be linked' })
        } else {
          created.push(directorTopicName)
        }
      } else {
        failed.push({
          name: directorTopicName,
          reason: safeTelegramReason(body.description),
        })
      }
    }
  }

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
      failed.push({ name: project.projectName, reason: safeTelegramReason(body.description) })
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
      // The topic exists in Telegram but points at nothing. Leaving it there
      // is worse than not creating it: every message in it falls through to
      // whatever project was last selected, so the group looks like it ignores
      // which topic you are in. Take it back out so a retry starts clean.
      await deleteForumTopic(botToken, chatId, body.result.message_thread_id)

      // The database's own words never reach a person. Bec's first sight of
      // this product was a Postgres check-constraint violation.
      console.error(`[topics] could not link ${project.projectName}:`, error.message)
      failed.push({ name: project.projectName, reason: 'could not be linked to the project' })
      continue
    }
    created.push(project.projectName)
  }

  return { created, existing, failed }
}

/**
 * Undo a topic that could not be linked.
 *
 * Never throws: this is cleanup after something already went wrong, and a
 * failure here must not replace the real reason with a second one.
 */
async function deleteForumTopic(botToken: string, chatId: string, threadId: number): Promise<void> {
  try {
    await fetch(`https://api.telegram.org/bot${botToken}/deleteForumTopic`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, message_thread_id: threadId }),
    })
  } catch (err) {
    console.error('[topics] could not remove an unlinked topic:', err instanceof Error ? err.message : err)
  }
}

/**
 * Telegram's own refusals are safe to repeat — they are short and about
 * permissions. Anything else is replaced, because the alternative is a
 * database error arriving in a group chat.
 */
export function safeTelegramReason(description: string | undefined): string {
  if (!description) return 'Telegram refused to create it'
  if (/not a forum|topics? (?:are|is) disabled/i.test(description)) return 'Topics are not turned on here'
  if (/not enough rights|CHAT_ADMIN_REQUIRED|need administrator/i.test(description)) {
    return 'I do not have the "Manage Topics" right'
  }
  if (/too many|TOPICS_TOO_MUCH/i.test(description)) return 'this group has hit Telegram\'s topic limit'
  return 'Telegram refused to create it'
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

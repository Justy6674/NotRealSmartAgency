/**
 * Why topics cannot be created yet, said precisely.
 *
 * Telegram's own requirements, quoted from the Bot API:
 *
 *   createForumTopic — "In the case of a supergroup chat the bot must be an
 *   administrator in the chat for this to work and must have the
 *   can_manage_topics administrator right."
 *
 *   is_forum — "True, if the supergroup chat is a forum (has topics enabled)."
 *
 * Three separate things must all be true, and the failure looks identical from
 * the outside: "Bad Request". Telling someone non-technical that their topic
 * setup returned a 400 is useless. This checks each condition and names the
 * ONE thing to go and do.
 */

export type TopicBlocker =
  | 'not_a_group'
  | 'topics_not_enabled'
  | 'bot_not_in_chat'
  | 'bot_not_admin'
  | 'bot_cannot_manage_topics'
  | 'unknown'

export interface TopicReadiness {
  ready: boolean
  blocker?: TopicBlocker
  /** What to actually do about it, in plain words. */
  instruction?: string
}

interface TelegramChat {
  type?: string
  is_forum?: boolean
  title?: string
}

interface TelegramChatMember {
  status?: string
  can_manage_topics?: boolean
}

const INSTRUCTIONS: Record<TopicBlocker, string> = {
  not_a_group:
    'Topics only exist in a group. Start one, add me to it, then say "set up topics" there.',
  topics_not_enabled:
    'This group does not have Topics turned on yet, and only a group admin can turn them on.\nOpen the group → Edit → Topics → switch it on, then say "set up topics" here again.',
  bot_not_in_chat:
    'I am not in this group yet. Add me to it first, then say "set up topics" again.',
  bot_not_admin:
    'I need to be an admin of this group to create topics.\nOpen the group → Edit → Administrators → add me, and tick "Manage Topics". Then say "set up topics" again.',
  bot_cannot_manage_topics:
    'I am an admin here but without the one right I need.\nOpen the group → Edit → Administrators → me → switch ON "Manage Topics". Then say "set up topics" again.',
  unknown:
    'I could not check whether I am allowed to create topics here. Try again in a moment.',
}

/**
 * Ask Telegram what is actually true, rather than attempting the call and
 * interpreting the error.
 *
 * Checked in the order a person would fix them: is this even a group, are
 * topics on, am I in it, am I an admin, do I hold the right.
 */
export async function checkTopicReadiness({
  botToken,
  chatId,
  botId,
  fetchImpl = fetch,
}: {
  botToken: string
  chatId: string
  /** The bot's own Telegram id, from getMe. */
  botId: number
  fetchImpl?: typeof fetch
}): Promise<TopicReadiness> {
  const blocked = (blocker: TopicBlocker): TopicReadiness => ({
    ready: false,
    blocker,
    instruction: INSTRUCTIONS[blocker],
  })

  try {
    const chatResponse = await fetchImpl(
      `https://api.telegram.org/bot${botToken}/getChat?chat_id=${encodeURIComponent(chatId)}`,
    )
    const chatBody = (await chatResponse.json()) as { ok?: boolean; result?: TelegramChat }
    if (!chatBody.ok || !chatBody.result) return blocked('bot_not_in_chat')

    const chat = chatBody.result
    if (chat.type !== 'group' && chat.type !== 'supergroup') return blocked('not_a_group')
    // A plain group has to be upgraded to a supergroup before Topics exist at
    // all; Telegram does that itself the moment the setting is switched on.
    if (chat.is_forum !== true) return blocked('topics_not_enabled')

    const memberResponse = await fetchImpl(
      `https://api.telegram.org/bot${botToken}/getChatMember?chat_id=${encodeURIComponent(chatId)}&user_id=${botId}`,
    )
    const memberBody = (await memberResponse.json()) as { ok?: boolean; result?: TelegramChatMember }
    if (!memberBody.ok || !memberBody.result) return blocked('bot_not_in_chat')

    const member = memberBody.result
    if (member.status === 'left' || member.status === 'kicked') return blocked('bot_not_in_chat')
    if (member.status !== 'administrator' && member.status !== 'creator') return blocked('bot_not_admin')

    // The creator holds every right implicitly; an administrator holds only
    // what was granted, and can_manage_topics is the one that matters here.
    if (member.status === 'administrator' && member.can_manage_topics !== true) {
      return blocked('bot_cannot_manage_topics')
    }

    return { ready: true }
  } catch {
    return blocked('unknown')
  }
}

/** The bot's own id, needed to ask Telegram about itself. */
export async function getBotId(
  botToken: string,
  fetchImpl: typeof fetch = fetch,
): Promise<number | null> {
  try {
    const response = await fetchImpl(`https://api.telegram.org/bot${botToken}/getMe`)
    const body = (await response.json()) as { ok?: boolean; result?: { id?: number } }
    return body.ok && typeof body.result?.id === 'number' ? body.result.id : null
  } catch {
    return null
  }
}

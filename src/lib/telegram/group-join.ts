/**
 * Say something the moment the bot is added to a group, or promoted in one.
 *
 * Telegram sends `my_chat_member` when "the bot's chat member status was
 * updated in a chat". Without listening for it the bot arrives in silence, and
 * the person who just added it has no idea whether it worked or what to do
 * next — they are left guessing between "make it an admin", "turn on Topics"
 * and "say set up topics", in an app, on a phone.
 *
 * So it reports where it has got to and names the ONE next step. No project
 * data is ever included: this fires before anyone has been checked against a
 * pairing, so it must be safe to say to whoever added it.
 */

export interface ChatMemberUpdate {
  chatId: string
  chatType: string
  isForum: boolean
  /** The bot's status after the change. */
  status: string
  canManageTopics: boolean
}

/** Read a my_chat_member update, or null if it is not one we act on. */
export function parseMyChatMember(update: unknown): ChatMemberUpdate | null {
  if (!update || typeof update !== 'object') return null
  const candidate = (update as Record<string, unknown>).my_chat_member
  if (!candidate || typeof candidate !== 'object') return null

  const event = candidate as Record<string, unknown>
  const chat = event.chat as Record<string, unknown> | undefined
  const member = event.new_chat_member as Record<string, unknown> | undefined
  if (!chat || !member || chat.id === undefined) return null

  const chatType = typeof chat.type === 'string' ? chat.type : ''
  // A private chat sends this only on block/unblock, which needs no reply.
  if (chatType !== 'group' && chatType !== 'supergroup') return null

  return {
    chatId: String(chat.id),
    chatType,
    isForum: chat.is_forum === true,
    status: typeof member.status === 'string' ? member.status : '',
    canManageTopics: member.can_manage_topics === true,
  }
}

/**
 * What to say, given where things now stand.
 *
 * Returns null when nothing useful can be said — being removed, or a status
 * change that does not move the setup along. A bot that comments on every
 * event becomes noise, and noise gets muted.
 */
export function describeGroupStatus(event: ChatMemberUpdate): string | null {
  if (event.status === 'left' || event.status === 'kicked') return null

  if (event.status === 'member') {
    return [
      "I'm in. Two things left before I can give each brand its own topic:",
      '',
      '1. Make me an admin with "Manage Topics" — Edit → Administrators → me.',
      !event.isForum ? '2. Turn Topics on — Edit → Topics.' : '2. Topics are already on. ✓',
      '',
      'Then say "set up topics" here and I will make one per brand.',
    ].join('\n')
  }

  if (event.status === 'administrator' || event.status === 'creator') {
    const isCreator = event.status === 'creator'
    if (!isCreator && !event.canManageTopics) {
      return [
        "Thanks — I'm an admin now, but without the one right I need.",
        '',
        'Edit → Administrators → me → switch ON "Manage Topics".',
        'Then say "set up topics" here.',
      ].join('\n')
    }

    if (!event.isForum) {
      return [
        "I'm an admin and I can manage topics. One thing left:",
        '',
        'Edit → Topics → turn it on.',
        'Then say "set up topics" here.',
      ].join('\n')
    }

    return 'All set — I can create topics here. Say "set up topics" and I will make one per brand.'
  }

  return null
}

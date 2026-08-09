import { MEDIA_DIRECTIVE_CLOSE, MEDIA_DIRECTIVE_OPEN } from './telegram-album'

/**
 * Keeps the media selected in the Telegram Mini App attached to the single
 * Director turn the owner sends with it.
 *
 * The file IDs are an instruction for this turn only. `stripMediaDirective()`
 * removes this block when a later follow-up reconstructs the thread, so an old
 * image can never become a standing order for subsequent work.
 */
export function buildMiniAppAttachmentDirective(mediaItemIds: readonly string[]): string {
  const count = mediaItemIds.length
  const plural = count === 1 ? 'file' : 'files'

  return [
    `\n\n${MEDIA_DIRECTIVE_OPEN}`,
    `The owner attached ${count} ${plural} to this exact request. They are the media for this turn, not a previous request.`,
    `Use exactly these media item IDs: ${mediaItemIds.join(', ')}.`,
    'Before describing, planning or creating from them, use query_media in analysis mode with these exact IDs in media_ids. Do not use an older library file instead.',
    'Respond to the owner\'s words above together with what the files actually show. Do not substitute older media.',
    'Do not claim a Canva design, generated slide, Mixpost draft or publication exists unless this turn has a real tool receipt for it.',
    MEDIA_DIRECTIVE_CLOSE,
  ].join('\n')
}

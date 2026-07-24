const HELP_TEXT =
  'I’m NRS, your marketing Director. Tell me what you want to grow and name the brand — for example: “For DoToday, make a week of launch posts.”'

function isCommand(text: string, command: string): boolean {
  return new RegExp(`^/${command}(?:@\\w+)?\\s*$`, 'i').test(text)
}

export function createTelegramCommandReply(text: string, brandNames: string[]): string | null {
  const trimmed = text.trim()

  if (isCommand(trimmed, 'start') || isCommand(trimmed, 'help')) return HELP_TEXT

  if (isCommand(trimmed, 'brands')) {
    return brandNames.length > 0 ? `Your brands: ${brandNames.join(', ')}.` : 'No brands are set up yet.'
  }

  return null
}

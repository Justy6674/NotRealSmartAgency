/**
 * Telegram is a plain-text control surface, not a Markdown document viewer.
 * Keep the Director's human response readable even when an upstream model
 * emits common Markdown conventions.
 */
export function formatTelegramMarketingCopy(value: string): string {
  return value
    .replace(/\r\n/g, '\n')
    .replace(/```[^\n]*\n?([\s\S]*?)```/g, '$1')
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '$1 ($2)')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1 ($2)')
    .replace(/^(?:\s{0,3}#{1,6})\s+/gm, '')
    .replace(/^>\s?/gm, '')
    .replace(/(\*\*|__)([\s\S]+?)\1/g, '$2')
    .replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/gm, '$1$2')
    .replace(/(^|[^_])_([^_\n]+)_(?!_)/gm, '$1$2')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/^[ \t]*[-*+][ \t]+/gm, '• ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

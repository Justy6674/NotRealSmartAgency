/**
 * Product documentation is more useful to a marketing agent than a package
 * manifest alone. These common paths are optional, so every repository keeps
 * working even when it only has a README.
 */
export const PRODUCT_CONTEXT_PATHS = [
  'docs/CAPABILITY-MAP.md',
  'docs/PRODUCT.md',
  'PRODUCT.md',
  'BRAND.md',
] as const

const MAX_DOCUMENT_CHARS = 3_500

export function appendRepositoryContext(summary: string, path: string, content: string): string {
  const trimmed = content.trim()
  if (!trimmed) return summary

  const excerpt = trimmed.length > MAX_DOCUMENT_CHARS
    ? `${trimmed.slice(0, MAX_DOCUMENT_CHARS)}\n... (truncated)`
    : trimmed

  return `${summary}\n\nProduct context (${path}):\n${excerpt}`
}

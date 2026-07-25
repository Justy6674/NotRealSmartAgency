export interface WebsiteScanEvidence {
  url: string
  title: string | null
  description: string | null
  headings: Array<{ level: string; text: string }>
  bodyText: string
  evidence_source?: 'rendered_browser'
  status?: 'completed' | 'partial'
  pages?: Array<{ finalUrl: string }>
  ctas?: string[]
  forms?: Array<{ label: string }>
  structured_data_types?: string[]
  warnings?: string[]
  unknowns?: string[]
}

const WEBSITE_SCAN_VERB = /\b(scan|review|audit|analyse|analyze|check|look\s+at)\b/i
const WEBSITE_WORD = /\b(site|website|homepage|landing\s+page|web\s+page)\b/i
const URL_PATTERN = /https?:\/\/[^\s<>"{}|\\^`\[\]]+/i

export function isWebsiteScanRequest(message: string): boolean {
  return WEBSITE_SCAN_VERB.test(message) && (WEBSITE_WORD.test(message) || URL_PATTERN.test(message))
}

export function resolveWebsiteScanUrl(message: string, configuredWebsiteUrl: string | null): string | null {
  const explicitUrl = message.match(URL_PATTERN)?.[0]
  return explicitUrl ?? configuredWebsiteUrl
}

/** Fresh scan evidence wins over older stored marketing context. */
export function buildWebsiteScanGroundingDirective(scan: WebsiteScanEvidence): string {
  const headings = scan.headings
    .slice(0, 12)
    .map((heading) => `- ${heading.level}: ${heading.text}`)
    .join('\n') || '- No headings were extracted.'
  const partialEvidenceRule = scan.status === 'partial'
    ? `\nLIMITED RENDERED EVIDENCE:\nThe browser could not complete every requested observation. State only what rendered successfully and name the limitation below. Do not turn unavailable evidence into an SEO, indexing, JavaScript, traffic, conversion, or visitor-behaviour claim.\n- Limitation: ${scan.warnings?.join(' ') || 'The rendered page was incomplete.'}\n`
    : ''
  const ctas = scan.ctas?.slice(0, 10).map((cta) => `- ${cta}`).join('\n') || '- No qualifying call-to-action was observed.'
  const forms = scan.forms?.slice(0, 8).map((form) => `- ${form.label}`).join('\n') || '- No form was observed.'
  const pages = scan.pages?.slice(0, 5).map((page) => `- ${page.finalUrl}`).join('\n') || `- ${scan.url}`
  const unknowns = scan.unknowns?.map((unknown) => `- ${unknown}`).join('\n') || '- No additional unknowns were recorded.'

  return `RENDERED WEBSITE AUDIT — SOURCE OF TRUTH
The user asked you to scan the site. A live scan has already completed for ${scan.url}.
This fresh evidence overrides any conflicting stored brand context, proforma detail, or memory. Do not repeat an older claim merely because it appears in memory.

Evidence from the rendered page:
- Page title: ${scan.title ?? 'not available'}
- Meta description: ${scan.description ?? 'not available'}
- Headings:
${headings}
- Extracted page copy: ${scan.bodyText.slice(0, 3000)}
- Observed calls to action:
${ctas}
- Observed forms:
${forms}
- Pages actually rendered:
${pages}
- What this audit cannot establish:
${unknowns}
${partialEvidenceRule}

Response rules for this scan:
- State only factual observations that are supported by the evidence above. Quote the exact heading or copy that supports each observation.
- Treat anything absent from this evidence as unverified, not as a missing feature or problem.
- Do not claim that you scanned a page other than the rendered pages listed above.
- Give no generic praise. Make each recommendation specific to an observed message, offer, or conversion path.
- Do not ask a follow-up question at the end. Finish with the one next marketing action you recommend.
- This response is going to Telegram. Do not use Markdown: no # headings, **bold**, backticks, Markdown links, or Markdown tables. Use short plain-text headings and • bullets only.
- The rendered audit is already complete. Do not call scan_website again or delegate this exact audit.`
}

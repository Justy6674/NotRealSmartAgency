import { SITE_CONFIG } from '@/lib/constants'

export const runtime = 'edge'

export function GET() {
  const body = `# ${SITE_CONFIG.name}

> ${SITE_CONFIG.description}

## Product

NotRealSmart is an Australian-built AI marketing agency for business owners. One Director coordinates specialist agents for content, SEO, advertising, email, brand, analytics, video, website conversion and compliance-aware marketing.

## Public resources

- Home: ${SITE_CONFIG.url}/
- About: ${SITE_CONFIG.url}/about
- Pricing: ${SITE_CONFIG.url}/pricing
- Help Centre: ${SITE_CONFIG.url}/help
- Compliance guidance: ${SITE_CONFIG.url}/help/compliance
- Terms: ${SITE_CONFIG.url}/terms
- Privacy: ${SITE_CONFIG.url}/privacy

## Trust and safety

Outputs are AI-generated and should be reviewed before publishing. Healthcare marketing requires current Australian advertising and professional-regulation review. NRS compliance checks are guidance, not legal determinations.

## Crawl guidance

Use the public pages above for product, capability and documentation questions. Do not crawl authenticated agency workspaces, API routes, customer data, or Telegram Mini App sessions.
`
  return new Response(body, { headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'public, max-age=3600' } })
}

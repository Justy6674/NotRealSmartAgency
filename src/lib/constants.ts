export const SITE_CONFIG = {
  name: 'NotRealSmart Agency',
  domain: 'notrealsmart.com.au',
  url: 'https://notrealsmart.com.au',
  description: 'AI marketing agency — 10 specialist agents, brand-aware, compliance-smart, Australian-first.',
  abn: '23 693 026 112',
  company: 'Black Health Intelligence Pty Ltd',
  tagline: 'Your AI Marketing Agency',
  contactEmail: 'office@blackhealthintelligence.com',
} as const

export const DISCLAIMER = {
  footer: `NotRealSmart Agency produces marketing outputs using AI. All content should be reviewed before publishing. For regulated industries (health, finance), ensure compliance with relevant advertising guidelines. ${SITE_CONFIG.company} | ABN ${SITE_CONFIG.abn}`,
  ai: 'AI-generated content — review before publishing.',
  compliance: 'This compliance check is guidance only — not a legal determination. Consult a qualified advisor for specific advice.',
} as const

export const SITE_CONFIG = {
  name: 'NotRealSmart',
  domain: 'notrealsmart.com.au',
  url: 'https://notrealsmart.com.au',
  description: 'The 24-Phase Map to Building a Compliant Australian Health Business',
  abn: '23 693 026 112',
  company: 'Black Health Intelligence Pty Ltd',
  tagline: 'Australian Healthcare Business Intelligence',
} as const

export const PHASE_CATEGORIES = [
  'Foundation',
  'Operations',
  'Compliance',
  'Clinical',
  'Growth',
  'Finance',
] as const

export const TIER_CONFIG = {
  free: {
    label: 'Free',
    colour: 'text-muted-foreground',
    bgColour: 'bg-muted',
    maxPhase: 3,
    aiQueries: 0,
    complianceScans: 1,
    integrations: 0,
  },
  starter: {
    label: 'Starter',
    colour: 'text-blue-600',
    bgColour: 'bg-blue-50',
    maxPhase: 24,
    aiQueries: 50,
    complianceScans: 5,
    integrations: 0,
  },
  professional: {
    label: 'Professional',
    colour: 'text-purple-600',
    bgColour: 'bg-purple-50',
    maxPhase: 24,
    aiQueries: -1,
    complianceScans: -1,
    integrations: 4,
  },
  practice: {
    label: 'Practice',
    colour: 'text-amber-600',
    bgColour: 'bg-amber-50',
    maxPhase: 24,
    aiQueries: -1,
    complianceScans: -1,
    integrations: -1,
  },
} as const

export const DISCLAIMER = {
  footer: `NotRealSmart provides general business information and education for Australian healthcare practitioners. This is not legal, financial, clinical, or regulatory advice. Always consult qualified professional advisors for decisions specific to your practice. ${SITE_CONFIG.company} | ABN ${SITE_CONFIG.abn}`,
  ai: 'This is general information only — verify with your regulatory advisor.',
  document: 'TEMPLATE — NOT LEGAL ADVICE. Have this document reviewed by a qualified legal professional before use.',
  scanner: 'Potential issues flagged for review. Each finding may warrant review — this is not a definitive legal determination.',
} as const

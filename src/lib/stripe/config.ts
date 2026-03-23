export const PLANS = {
  starter: {
    name: 'Starter',
    description: 'Essential tools for solo practitioners',
    price: 29,
    priceId: process.env.STRIPE_STARTER_PRICE_ID!,
    features: [
      'All 24 phases unlocked',
      '50 AI questions/month',
      'Basic compliance scanner',
      'Tool recommendations',
      'Email support',
    ],
    limits: {
      aiQueries: 50,
      complianceScans: 5,
      integrations: 0,
    },
  },
  professional: {
    name: 'Professional',
    description: 'Full intelligence for growing practices',
    price: 79,
    priceId: process.env.STRIPE_PROFESSIONAL_PRICE_ID!,
    popular: true,
    features: [
      'Everything in Starter',
      'Unlimited AI assistant',
      'Unlimited compliance scans',
      'Halaxy & Xero integrations',
      'Real-time dashboard analytics',
      'Document generator',
      'Priority support',
    ],
    limits: {
      aiQueries: -1, // unlimited
      complianceScans: -1,
      integrations: 4,
    },
  },
  practice: {
    name: 'Practice',
    description: 'Enterprise intelligence for multi-practitioner practices',
    price: 149,
    priceId: process.env.STRIPE_PRACTICE_PRICE_ID!,
    features: [
      'Everything in Professional',
      'Multi-practitioner support',
      'Custom compliance rules',
      'Regulation change alerts',
      'Dedicated account manager',
      'API access',
      'White-label reports',
    ],
    limits: {
      aiQueries: -1,
      complianceScans: -1,
      integrations: -1,
    },
  },
} as const

export type PlanKey = keyof typeof PLANS

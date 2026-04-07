import type { HelpArticle } from '../types'

export const accountAndBillingArticles: HelpArticle[] = [
  {
    slug: 'plans-and-pricing',
    categorySlug: 'account-and-billing',
    title: 'Plans & Pricing',
    subtitle: 'What is included and how much it costs',
    body: [
      {
        body: 'NotRealSmart is designed to replace an entire marketing agency — at a fraction of the cost. Instead of paying thousands per month for a human agency, you get 14 AI specialists working around the clock for your brand.',
      },
      {
        heading: 'What is included',
        body: 'Every plan includes the full agency experience:',
        steps: [
          'Your own AI Director and 13 specialist departments.',
          'Unlimited conversations and content creation.',
          'Compliance checking (AHPRA, TGA, and consumer law).',
          'Social media scheduling and publishing.',
          'Competitor analysis, SEO audits, and performance reports.',
          'Brand memory — your agents remember everything about your business.',
          'Access from the web, Claude Desktop, Claude Mobile, and other connected apps.',
        ],
      },
      {
        heading: 'Free trial',
        body: 'New users get a free trial to explore the platform. During the trial you have access to all features so you can see exactly what you are getting. No credit card is required to start.',
        tip: 'Make the most of your trial by running a /audit on your brand. It gives you a comprehensive marketing health check and shows you what the agency can do.',
      },
      {
        heading: 'Current pricing',
        body: 'Pricing is available on the NotRealSmart website at notrealsmart.com.au/pricing. We offer plans for solo businesses, growing teams, and agencies managing multiple brands. If you have questions about which plan is right for you, just ask your Director.',
      },
    ],
    tags: ['pricing', 'plans', 'cost', 'subscription', 'free trial', 'included', 'features', 'how much'],
    relatedSlugs: ['account-and-billing/your-subscription', 'account-and-billing/multiple-brands'],
    lastUpdated: '2026-04-07',
  },
  {
    slug: 'your-subscription',
    categorySlug: 'account-and-billing',
    title: 'Managing Your Subscription',
    subtitle: 'How to upgrade, downgrade, or cancel your plan',
    body: [
      {
        heading: 'Viewing your current plan',
        body: 'To see what plan you are on and when your next billing date is, go to Settings (click your profile picture, then Settings). Your subscription details are shown at the top of the page.',
      },
      {
        heading: 'Upgrading or downgrading',
        body: 'If you need more capacity or want to switch plans:',
        steps: [
          'Go to Settings.',
          'Click "Manage Subscription" — this opens the billing portal.',
          'Choose a new plan from the available options.',
          'Confirm the change. Upgrades take effect immediately. Downgrades take effect at the end of your current billing period.',
        ],
        tip: 'If you are unsure which plan you need, ask your Director "What plan should I be on?" It knows how much you use the platform and can make a recommendation.',
      },
      {
        heading: 'Updating payment details',
        body: 'To update your credit card or payment method, go to Settings and click "Manage Subscription." The billing portal lets you update your card, view past invoices, and download receipts for your accountant.',
      },
      {
        heading: 'Cancelling',
        body: 'You can cancel at any time from the billing portal. Your access continues until the end of your current billing period. Your brand data and content are kept for 90 days after cancellation in case you change your mind.',
        warning: 'After 90 days, your data is permanently deleted. If you think you might come back, download your outputs before cancelling.',
      },
    ],
    tags: ['subscription', 'billing', 'upgrade', 'downgrade', 'cancel', 'payment', 'plan', 'manage', 'invoice'],
    relatedSlugs: ['account-and-billing/plans-and-pricing', 'account-and-billing/multiple-brands'],
    lastUpdated: '2026-04-07',
  },
  {
    slug: 'multiple-brands',
    categorySlug: 'account-and-billing',
    title: 'Managing Multiple Brands',
    subtitle: 'Run marketing for several businesses from one account',
    body: [
      {
        body: 'If you own or manage more than one business, NotRealSmart lets you run them all from a single account. Each brand gets its own identity, memory, content library, and compliance settings — but you switch between them with one click.',
      },
      {
        heading: 'How multi-brand works',
        body: 'Each brand you add is completely separate:',
        steps: [
          'Its own brand voice, colours, and personality.',
          'Its own content library and output history.',
          'Its own social media connections.',
          'Its own compliance profile (e.g. AHPRA rules for your clinic, standard rules for your candle shop).',
          'Its own agent memory — what your Director learns about Brand A does not leak into Brand B.',
        ],
      },
      {
        heading: 'Switching between brands',
        body: 'Your brands appear in the left sidebar. Click a brand to switch to it. When you switch, your Director and all agents instantly load that brand\'s context. Your conversation history is per-brand, so you can pick up where you left off.',
        tip: 'You can also tell your Director to work across brands: "Promote TeleScribe to my Downscale patients" — it knows both brands and can create cross-promotional content.',
      },
      {
        heading: 'Cross-brand promotion',
        body: 'If your brands are related (like a weight loss clinic and a skincare line), your Director can spot opportunities to cross-promote. It sees all your brands and can suggest partnerships, referral flows, and content that benefits multiple businesses at once.',
      },
      {
        heading: 'Adding a new brand',
        body: 'Click "Add Brand" in the sidebar. Give it a name and a website (if you have one). Your Director will scan the website, learn about the business, and start building the brand profile automatically. You can also fill in details by chatting — just tell the Director about your business.',
      },
    ],
    tags: ['multiple brands', 'multi-brand', 'several businesses', 'switch', 'cross-promotion', 'add brand', 'sidebar'],
    relatedSlugs: ['account-and-billing/plans-and-pricing', 'getting-started/setting-up-your-brand'],
    lastUpdated: '2026-04-07',
  },
]

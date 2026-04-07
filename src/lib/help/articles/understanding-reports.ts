import type { HelpArticle } from '../types'

export const understandingReportsArticles: HelpArticle[] = [
  {
    slug: 'marketing-audit',
    categorySlug: 'understanding-reports',
    title: 'The Marketing Audit',
    subtitle: 'A full health check on your marketing — what it covers and how to read it',
    body: [
      {
        body: 'A marketing audit is like a check-up for your business\'s marketing. Type /audit in the chat and your Director will assemble a team of six specialist agents to review your brand from every angle. It takes a few minutes, but you get a thorough, honest assessment.',
      },
      {
        heading: 'What the six departments check',
        body: 'Each department focuses on a different area:',
        steps: [
          'Competitor Intelligence — who your competitors are, what they are doing well, and where you can beat them.',
          'SEO & Search — how easy it is to find you on Google and AI search engines, and what keywords to target.',
          'Content & Copy — the quality and consistency of your existing content across all channels.',
          'Analytics & Reporting — what your numbers say about traffic, engagement, and conversions.',
          'Compliance — whether your marketing meets AHPRA, TGA, and consumer law requirements.',
          'Web & Conversion — how well your website turns visitors into customers.',
        ],
      },
      {
        heading: 'How to read your audit',
        body: 'Each department gives you a RAG rating — Red (needs urgent attention), Amber (room for improvement), or Green (looking good). Start with the reds. The Director will also give you a summary at the top with the three most important things to fix first.',
        tip: 'You do not need to fix everything at once. Ask your Director "What should I tackle first?" and it will prioritise based on what will have the biggest impact.',
      },
      {
        heading: 'Running regular audits',
        body: 'We recommend running an audit once a month, or after any major change to your business (new website, new product, rebranding). Your Director will remember your previous audits and tell you what has improved or gotten worse.',
      },
    ],
    tags: ['audit', 'marketing audit', 'health check', 'review', 'rag', 'departments', 'slash command'],
    relatedSlugs: ['understanding-reports/performance-reports', 'understanding-reports/competitor-intel', 'talking-to-director/slash-commands'],
    lastUpdated: '2026-04-07',
  },
  {
    slug: 'performance-reports',
    categorySlug: 'understanding-reports',
    title: 'Performance Reports',
    subtitle: 'See how your marketing is actually performing — in plain language',
    body: [
      {
        body: 'Performance reports show you how your marketing is going. Instead of drowning you in spreadsheets and graphs, your Director explains the numbers in plain language and tells you what they mean for your business.',
      },
      {
        heading: 'How to get a report',
        body: 'You have several options. Just type one of these in chat:',
        steps: [
          '/report — a general performance overview covering all channels.',
          '/howamidoing — a friendly, conversational summary of your progress.',
          '/whatsworking — focuses specifically on what is performing well and what is not.',
        ],
        tip: 'You can also just ask in plain English: "How did my Instagram do this week?" or "Are my blog posts getting traffic?"',
      },
      {
        heading: 'What the numbers mean',
        body: 'Your Director will explain metrics without jargon. For example, instead of "CTR is 2.3%", it might say "About 2 out of every 100 people who saw your ad clicked on it — that is above average for your industry." Every number comes with context so you know whether it is good, bad, or normal.',
      },
      {
        heading: 'Saving and comparing reports',
        body: 'Every report can be saved using the action bar below the message. Click "Save" to add it to your output library. Click "Baseline" to mark it as a reference point — next time you run a report, your Director will compare the new numbers against your baseline and highlight what changed.',
      },
      {
        heading: 'Getting reports emailed',
        body: 'Click "Email Me" on any report to receive a formatted copy in your inbox. Handy for sharing with a business partner or keeping records.',
      },
    ],
    tags: ['report', 'performance', 'analytics', 'metrics', 'howamidoing', 'whatsworking', 'numbers', 'results'],
    relatedSlugs: ['understanding-reports/marketing-audit', 'understanding-reports/roi-tracking'],
    lastUpdated: '2026-04-07',
  },
  {
    slug: 'competitor-intel',
    categorySlug: 'understanding-reports',
    title: 'Competitor Intelligence',
    subtitle: 'Find out what your competitors are doing — and how to do it better',
    body: [
      {
        body: 'Your Director has a specialist Competitor Intelligence agent that can research your competitors\' websites, social media, SEO, and marketing strategies. You get actionable insights, not just data.',
      },
      {
        heading: 'How to run competitor research',
        body: 'Use these commands in chat:',
        steps: [
          '/scan [website URL] — a quick overview of a competitor\'s website, tech stack, and content.',
          '/deepscan [website URL] — a thorough analysis including SEO, social media, content strategy, and advertising.',
          '/swot — runs a full strengths, weaknesses, opportunities, and threats analysis comparing you to your competitors.',
        ],
        tip: 'You can also just say "What is my competitor doing better than me?" and provide their website. The Director handles the rest.',
      },
      {
        heading: 'What you learn',
        body: 'Competitor reports typically cover: what keywords they rank for that you do not, how often they post on social media and what gets engagement, what their website does well (and badly), what advertising they appear to be running, and gaps in their strategy that you could exploit.',
      },
      {
        heading: 'Using the intelligence',
        body: 'The best part is what comes after the report. Ask your Director "How can I beat them?" or "Write me a content plan that targets their weak spots." The competitor intelligence feeds directly into your content, SEO, and advertising strategies.',
      },
      {
        heading: 'Ongoing monitoring',
        body: 'You do not need to remember to check on competitors. Your Director can set up regular scans and alert you when a competitor makes a significant change — like launching a new product, changing their pricing, or ramping up their social media.',
      },
    ],
    tags: ['competitor', 'intelligence', 'scan', 'deepscan', 'swot', 'research', 'analysis', 'competition'],
    relatedSlugs: ['understanding-reports/marketing-audit', 'understanding-reports/performance-reports'],
    lastUpdated: '2026-04-07',
  },
  {
    slug: 'roi-tracking',
    categorySlug: 'understanding-reports',
    title: 'Tracking Your Return',
    subtitle: 'Understand whether your marketing spend is actually making you money',
    body: [
      {
        heading: 'What is ROI?',
        body: 'ROI stands for Return on Investment. In plain terms, it answers the question: "For every dollar I spend on marketing, how much do I get back?" If you spend $100 on ads and make $500 in sales from those ads, your ROI is 5x — you got five dollars back for every one you spent.',
      },
      {
        heading: 'How to check your ROI',
        body: 'Type /roi in chat and your Director will pull together what it knows about your marketing spend and results. It combines data from your analytics, ad platforms, and any sales figures you have shared.',
        tip: 'The more information you give your Director about your sales and revenue, the more accurate your ROI tracking becomes. Even rough numbers help — "We made about $10,000 last month" is better than nothing.',
      },
      {
        heading: 'Understanding the numbers',
        body: 'Your Director explains ROI without financial jargon. It will tell you things like: "Your Instagram ads cost $200 this month and brought in roughly 15 new enquiries. Based on your average booking value, that is about $1,500 in potential revenue — a strong return." It focuses on what matters to your business, not abstract percentages.',
      },
      {
        heading: 'What affects your ROI',
        body: 'Several things influence your marketing return:',
        steps: [
          'How well your content resonates with your audience.',
          'Whether your website converts visitors into customers.',
          'How targeted your advertising is.',
          'Your pricing and the value of each customer.',
          'Consistency — marketing compounds over time.',
        ],
      },
      {
        heading: 'Improving your return',
        body: 'After reviewing your ROI, ask your Director "How can I improve my return?" It will suggest specific actions — like shifting budget from underperforming channels, improving your website conversion rate, or doubling down on content that is already working.',
      },
    ],
    tags: ['roi', 'return', 'investment', 'spend', 'money', 'cost', 'revenue', 'tracking', 'results'],
    relatedSlugs: ['understanding-reports/performance-reports', 'understanding-reports/marketing-audit'],
    lastUpdated: '2026-04-07',
  },
]

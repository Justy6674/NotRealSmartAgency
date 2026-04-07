import type { HelpArticle } from '../types'

export const talkingToDirectorArticles: HelpArticle[] = [
  {
    slug: 'how-conversations-work',
    categorySlug: 'talking-to-director',
    title: 'How Conversations Work',
    subtitle: 'Chat naturally — your Director remembers everything',
    body: [
      {
        body: 'Talking to your Director is like talking to a real marketing agency lead. You speak naturally, explain what you need, and they handle the rest.',
      },
      {
        heading: 'One conversation at a time',
        body: 'Each conversation is saved and you can come back to it later. Your Director remembers what you discussed, what was created, and what decisions were made — not just in this conversation, but across all your conversations.',
      },
      {
        heading: 'Behind the scenes',
        body: 'When you ask for something, the Director figures out who should handle it. A blog post goes to the content specialist. An SEO question goes to the search scientist. A compliance check goes to the regulatory expert. You never need to pick a department — the Director does it automatically.',
        tip: 'For complex requests, the Director may call a "meeting" — bringing together multiple specialists to work on your request in parallel. You will see their individual contributions in the response.',
      },
      {
        heading: 'Images and screenshots',
        body: 'You can paste images directly into the chat (Cmd+V on Mac, Ctrl+V on Windows) or drag and drop them. The Director can see and analyse images — useful for reviewing designs, competitor screenshots, or ad mockups.',
      },
    ],
    tags: ['conversation', 'chat', 'message', 'memory', 'remember', 'image', 'paste', 'screenshot', 'drag', 'drop'],
    relatedSlugs: ['talking-to-director/what-you-can-ask-for', 'talking-to-director/the-meeting-room'],
    lastUpdated: '2026-04-07',
  },
  {
    slug: 'using-shortcuts',
    categorySlug: 'talking-to-director',
    title: 'Using Shortcuts (Slash Commands)',
    subtitle: 'Type / to see 65+ instant actions',
    body: [
      {
        body: 'Slash commands are shortcuts that make it faster to ask for common things. Type / in the chat box and a list of available commands appears.',
      },
      {
        heading: 'How to use them',
        steps: [
          'Click in the chat input box.',
          'Type / (forward slash).',
          'A dropdown appears with all available commands.',
          'Keep typing to filter — e.g. /blog narrows the list.',
          'Click a command or press Enter to select it.',
          'The command turns into a natural language message and sends automatically.',
        ],
      },
      {
        heading: 'Most popular shortcuts',
        body: 'Here are the ones people use most:',
        steps: [
          '/post — Write a social media post',
          '/blog — Write an SEO-optimised blog article',
          '/fill — Auto-generate 2 weeks of content',
          '/audit — Run a full marketing audit',
          '/design — Create a graphic in Canva',
          '/video — Create an AI avatar video',
          '/calendar — See your scheduled posts',
          '/help — Show what the Director can do',
        ],
      },
      {
        heading: 'You do not need shortcuts',
        body: 'Shortcuts are optional. You can always just type naturally — "write me a LinkedIn post about our new service" works just as well as /post. Shortcuts just save time once you know what you want.',
        tip: 'There are 65+ shortcuts across content, SEO, ads, email, strategy, brand, competitors, analytics, video, design, compliance, and more. Type / and scroll to explore.',
      },
    ],
    tags: ['slash', 'command', 'shortcut', '/', 'quick', 'action', 'post', 'blog', 'fill', 'audit'],
    relatedSlugs: ['talking-to-director/what-you-can-ask-for', 'getting-started/quick-wins'],
    lastUpdated: '2026-04-07',
  },
  {
    slug: 'what-you-can-ask-for',
    categorySlug: 'talking-to-director',
    title: 'What You Can Ask For',
    subtitle: 'Everything a marketing agency does — and more',
    body: [
      {
        body: 'Your Director can handle anything a full-service marketing agency would do. Here is a taste:',
      },
      {
        heading: 'Content',
        steps: [
          'Write social media posts for any platform',
          'Write blog articles optimised for search engines',
          'Create email campaigns and newsletters',
          'Write landing page copy',
          'Generate marketing images',
          'Repurpose one piece of content into 20+',
        ],
      },
      {
        heading: 'Strategy',
        steps: [
          'Run a full marketing audit',
          'Create a 90-day growth roadmap',
          'Plan a product launch campaign',
          'Define content pillars and messaging',
          'Build a referral programme',
        ],
      },
      {
        heading: 'Video',
        steps: [
          'Write video scripts for TikTok, Reels, YouTube',
          'Create AI avatar videos',
          'Upload videos and get platform-specific captions',
          'Repurpose videos into posts, blogs, and emails',
        ],
      },
      {
        heading: 'Analysis',
        steps: [
          'Scan competitor websites',
          'Run SEO audits',
          'Check compliance with AHPRA/TGA rules',
          'Track what content is working best',
          'Calculate return on investment',
        ],
      },
      {
        heading: 'Design',
        steps: [
          'Create social media graphics in Canva',
          'Generate brand imagery and visuals',
          'Export designs in any format',
        ],
      },
      {
        tip: 'If you are not sure whether the Director can help with something, just ask. The worst that happens is it tells you it cannot — but you might be surprised how much it can do.',
      },
    ],
    tags: ['features', 'capabilities', 'what can', 'help', 'do', 'content', 'strategy', 'video', 'design', 'analysis', 'seo', 'email', 'ads'],
    relatedSlugs: ['talking-to-director/using-shortcuts', 'talking-to-director/the-meeting-room'],
    lastUpdated: '2026-04-07',
  },
  {
    slug: 'the-meeting-room',
    categorySlug: 'talking-to-director',
    title: 'The Meeting Room',
    subtitle: 'When multiple specialists collaborate on your request',
    body: [
      {
        body: 'Some requests are too big for one specialist. When that happens, the Director calls a meeting — bringing together multiple departments to work on your request simultaneously.',
      },
      {
        heading: 'When does a meeting happen?',
        body: 'Meetings are triggered automatically when the Director detects that your request spans multiple areas of expertise. Common triggers include:',
        steps: [
          '"Run a comprehensive marketing audit" — brings together SEO, content, analytics, compliance, competitor, and website specialists',
          '"Plan a product launch" — strategy, content, ads, email, and social',
          '"Rebrand my business" — brand, content, website, and design',
          '"Create a full campaign" — strategy, content, ads, email, analytics',
        ],
      },
      {
        heading: 'What you see',
        body: 'During a meeting, you will see each specialist\'s contribution labelled with their name and role. The Director then writes a synthesis — combining all the expert input into a single prioritised action plan.',
        tip: 'Meetings produce some of the most valuable outputs. Try asking for a "comprehensive marketing audit" to see it in action.',
      },
      {
        heading: 'Can I request a meeting?',
        body: 'Yes. Type /meeting or just say "I want input from multiple departments on this." The Director will convene the relevant specialists.',
      },
    ],
    tags: ['meeting', 'meeting room', 'collaborate', 'departments', 'multiple', 'agents', 'specialists', 'audit', 'campaign', 'parallel'],
    relatedSlugs: ['talking-to-director/how-conversations-work', 'getting-started/quick-wins'],
    lastUpdated: '2026-04-07',
  },
  {
    slug: 'quick-actions',
    categorySlug: 'talking-to-director',
    title: 'Quick Actions',
    subtitle: 'One-click buttons that appear below the chat box',
    body: [
      {
        body: 'Below your chat input, you will see coloured action buttons. These are quick actions — one-click shortcuts that send a pre-written message to your Director.',
      },
      {
        heading: 'They change based on context',
        body: 'The quick actions shown depend on what is happening. When you first start, you might see "Run a marketing audit", "Fill my calendar", or "Review my brand". After a conversation about content, you might see actions related to scheduling or publishing.',
      },
      {
        heading: 'The action bar on messages',
        body: 'Every substantial response from your Director includes an action bar with 10 buttons:',
        steps: [
          'Save — store the output in your content library',
          'Email Me — send the content to your email',
          'Send to... — share with a team member',
          'Baseline — mark this as a benchmark to compare against later',
          'Re-analyse — ask the Director to review and improve',
          'Todo — extract action items and create tasks',
          'Copy — copy the text to your clipboard',
          'Remember — tell the Director to remember specific details',
          'Full View — see the full output in a larger view',
          'PDF — download as a PDF document',
        ],
      },
      {
        tip: 'The "Save" button is especially useful. Everything you save goes to your content library in the Creative Studio, where you can find it later.',
      },
    ],
    tags: ['quick', 'action', 'button', 'save', 'email', 'copy', 'pdf', 'todo', 'baseline', 'bar', 'message'],
    relatedSlugs: ['talking-to-director/using-shortcuts', 'creating-content/write-a-social-post'],
    lastUpdated: '2026-04-07',
  },
]

import type { HelpArticle } from '../types'

export const gettingStartedArticles: HelpArticle[] = [
  {
    slug: 'what-is-notrealsmart',
    categorySlug: 'getting-started',
    title: 'What is NotRealSmart Agency?',
    subtitle: 'Your own AI marketing team — 14 specialists, 1 conversation',
    body: [
      {
        body: 'NotRealSmart is your own AI marketing agency. The name says it all — Not Real (Artificial) Smart (Intelligence). It is AI, said differently.',
      },
      {
        body: 'Instead of hiring a marketing agency or doing everything yourself, you talk to one person — the Director. Behind the scenes, 13 specialist agents handle the work: content writing, SEO, paid ads, email campaigns, video scripts, brand identity, competitor analysis, compliance checking, and more.',
      },
      {
        heading: 'Who built it?',
        body: 'Black Health Intelligence Pty Ltd — an Australian company running 10 businesses across health clinics, telehealth, skincare, and fragrance. We built NotRealSmart because we needed it ourselves. It specialises in healthcare marketing (with built-in AHPRA and TGA compliance), but works for any business.',
      },
      {
        heading: 'How is it different from ChatGPT?',
        body: 'Five key differences:',
        steps: [
          'Brand memory — every agent knows your brand voice, audience, and past work across sessions.',
          'Compliance — every output is checked against Australian health advertising rules.',
          'Departments — 14 independent specialist agents, not a generalist.',
          'Meeting room — complex requests get input from multiple specialists working in parallel.',
          'Action bar — save, email, create to-dos, export, and compare reports with one click.',
        ],
      },
    ],
    tags: ['what is', 'about', 'introduction', 'overview', 'ai', 'agency', 'marketing', 'chatgpt', 'difference'],
    relatedSlugs: ['getting-started/your-first-conversation', 'getting-started/setting-up-your-brand'],
    lastUpdated: '2026-04-07',
  },
  {
    slug: 'your-first-conversation',
    categorySlug: 'getting-started',
    title: 'Your First Conversation',
    subtitle: 'Start chatting with your Director in under a minute',
    body: [
      {
        body: 'When you first log in, your Director is ready to talk. You do not need to configure anything — just start typing.',
      },
      {
        heading: 'What to say first',
        body: 'The Director will introduce itself and ask about your business. You can say something like:',
        steps: [
          '"I run a physiotherapy clinic in Melbourne"',
          '"I sell handmade candles online"',
          '"I\'m launching a new app for pet owners"',
        ],
        tip: 'The more you share, the better your Director understands your brand. It remembers everything across sessions.',
      },
      {
        heading: 'What happens next',
        body: 'Your Director will scan your website (if you provide one), check your social media presence, and start building your marketing profile. It will suggest what to work on first — usually getting your brand voice set up and creating your first piece of content.',
      },
      {
        heading: 'You can ask for anything',
        body: 'Write me a blog post. Create a social media calendar. Run a marketing audit. Design an Instagram post. Check my website for compliance issues. The Director handles it all — or delegates to the right specialist behind the scenes.',
      },
    ],
    tags: ['first', 'start', 'begin', 'chat', 'conversation', 'onboarding', 'new user', 'login'],
    relatedSlugs: ['getting-started/what-is-notrealsmart', 'talking-to-director/how-conversations-work'],
    lastUpdated: '2026-04-07',
  },
  {
    slug: 'setting-up-your-brand',
    categorySlug: 'getting-started',
    title: 'Setting Up Your Brand',
    subtitle: 'Tell your agency about your business so it can do great work',
    body: [
      {
        body: 'Your brand profile is the foundation of everything your agency creates. The more it knows about you, the better the content, strategy, and advice.',
      },
      {
        heading: 'The easy way — just talk',
        body: 'You do not need to fill in forms. Just tell your Director about your business in conversation. It will automatically save the details — your name, niche, audience, tone of voice, and more.',
        tip: 'Say something like "My brand is called Bloom Skincare, we sell natural skincare products for sensitive skin, mostly women aged 25-45 who care about clean ingredients."',
      },
      {
        heading: 'Automatic scanning',
        body: 'If you provide your website URL, the Director will scan it and fill in details automatically — your business name, what you do, your existing messaging, and more. It can also scan your GitHub repo and social media profiles.',
      },
      {
        heading: 'What your agency learns about you',
        body: 'Over time, your brand profile grows to include:',
        steps: [
          'Business name, niche, and description',
          'Target audience and buyer personas',
          'Brand voice and tone (formal, casual, witty, etc.)',
          'Content pillars — the main topics you talk about',
          'Compliance flags (AHPRA/TGA for health businesses)',
          'Competitor list',
          'Social media profiles and connections',
          'Post signature (your branding on every post)',
        ],
      },
    ],
    tags: ['brand', 'setup', 'profile', 'configure', 'business', 'niche', 'audience', 'website', 'scan'],
    relatedSlugs: ['your-brand/brand-dna', 'getting-started/connecting-your-socials'],
    lastUpdated: '2026-04-07',
  },
  {
    slug: 'connecting-your-socials',
    categorySlug: 'getting-started',
    title: 'Connecting Your Social Media',
    subtitle: 'Link Facebook, Instagram, LinkedIn, TikTok, and YouTube',
    body: [
      {
        body: 'To publish posts directly to your social media accounts, your agency uses a self-hosted publishing tool called Mixpost. It connects to your platforms securely so the Director can schedule and publish on your behalf.',
      },
      {
        heading: 'Currently supported platforms',
        steps: [
          'Facebook Pages',
          'Instagram Business',
          'LinkedIn (personal and company)',
          'YouTube',
          'TikTok (coming soon)',
        ],
      },
      {
        heading: 'How it works',
        body: 'When you create a brand, your agency checks which social platforms are already connected. You will see a status like "Socials: Instagram, Facebook, LinkedIn (connected)" in your chat. If platforms are missing, the Director will let you know and guide you through connecting them.',
        tip: 'Social media connections are managed through the publishing tool. If you need to reconnect a platform (for example, after changing your Instagram password), ask your Director for help.',
      },
      {
        heading: 'What if I do not have social media yet?',
        body: 'That is perfectly fine. Your agency can still create content, write blog posts, design graphics, run audits, and plan strategy. When you are ready to start posting, connect your platforms and the agency will handle publishing.',
      },
    ],
    tags: ['social', 'facebook', 'instagram', 'linkedin', 'tiktok', 'youtube', 'connect', 'mixpost', 'publish', 'platform'],
    relatedSlugs: ['publishing/auto-publishing', 'getting-started/setting-up-your-brand'],
    lastUpdated: '2026-04-07',
  },
  {
    slug: 'quick-wins',
    categorySlug: 'getting-started',
    title: '5 Quick Wins in Your First Hour',
    subtitle: 'Get real results fast with these five things',
    body: [
      {
        body: 'Here are five things you can do right now that will make an immediate difference to your marketing:',
      },
      {
        heading: '1. Run a marketing audit',
        body: 'Type /audit in the chat. Your Director will pull in six specialist departments to analyse your website, content, SEO, social media, competitors, and compliance. You will get a comprehensive report with priorities.',
      },
      {
        heading: '2. Fill your content calendar',
        body: 'Type /fill in the chat. Your Director will generate two weeks of social media posts, tailored to your brand voice and audience. Review them, approve the ones you like, and they will be scheduled automatically.',
      },
      {
        heading: '3. Write your first blog post',
        body: 'Type /blog and describe the topic. Your content specialist will write a full SEO-optimised article with headings, meta description, and a call to action.',
      },
      {
        heading: '4. Check your compliance',
        body: 'If you are in healthcare, type /check to have the compliance specialist review your website for AHPRA and TGA advertising violations. This alone could save you from fines up to $120,000.',
      },
      {
        heading: '5. Scan your competitors',
        body: 'Type /deepscan followed by a competitor\'s website URL. Your intelligence analyst will produce a detailed comparison of their messaging, SEO strategy, content approach, and pricing.',
      },
    ],
    tags: ['quick', 'first', 'start', 'beginner', 'tutorial', 'easy', 'tips', 'audit', 'calendar', 'blog'],
    relatedSlugs: ['talking-to-director/using-shortcuts', 'creating-content/write-a-blog'],
    lastUpdated: '2026-04-07',
  },
]

import type { HelpArticle } from '../types'

export const yourBrandArticles: HelpArticle[] = [
  {
    slug: 'brand-dna',
    categorySlug: 'your-brand',
    title: 'Brand DNA',
    subtitle: 'The personality rules that guide everything your agency creates',
    body: [
      {
        body: 'Your Brand DNA is a set of personality rules that tell your agency who you are, how you sound, and what you stand for. Think of it as your brand\'s fingerprint — it shapes every piece of content, every social post, and every email your Director creates.',
      },
      {
        heading: 'What is in your Brand DNA',
        body: 'Your Brand DNA captures:',
        steps: [
          'Your brand voice — are you formal, casual, witty, authoritative, or warm?',
          'Your core values — what matters most to your business (quality, innovation, care, etc.)',
          'Your audience — who you are talking to and what they care about',
          'Your tone boundaries — things you would never say or styles you avoid',
          'Your differentiators — what makes you different from competitors',
        ],
      },
      {
        heading: 'How it guides content',
        body: 'Every agent in your marketing team reads your Brand DNA before creating anything. A social media post for a playful streetwear brand will sound completely different from one for a professional medical clinic — even if the topic is the same. Your Brand DNA ensures that consistency happens automatically.',
        tip: 'The more detailed your Brand DNA, the more consistent your content will be. A simple "professional and friendly" is a good start, but "professional yet approachable, uses plain language instead of medical jargon, always empathetic and never condescending" gives much better results.',
      },
      {
        heading: 'How to set it up',
        body: 'Your Brand DNA builds up naturally through conversations with your Director. When you describe your business, share preferences, or give feedback on content ("this sounds too formal" or "I love this tone"), the Director updates your DNA. You can also set it up directly:',
        steps: [
          'Say "Set my brand voice to warm, professional, and approachable"',
          'Say "Update my brand DNA" and describe your personality in detail',
          'Visit your brand profile page where DNA attributes are displayed visually',
        ],
      },
      {
        heading: 'The Marketing DNA Bar',
        body: 'In your chat interface, you will see a visual DNA bar that summarises your brand\'s personality at a glance. This shows the key attributes your Director is currently working with. If anything looks wrong, just tell your Director to update it.',
      },
    ],
    tags: ['brand', 'dna', 'voice', 'personality', 'identity', 'values', 'tone', 'style', 'consistency'],
    relatedSlugs: ['your-brand/voice-and-tone', 'your-brand/inspiration-library', 'your-brand/content-pillars'],
    lastUpdated: '2026-04-07',
  },
  {
    slug: 'inspiration-library',
    categorySlug: 'your-brand',
    title: 'Your Inspiration Library',
    subtitle: 'Save marketing examples from brands you admire',
    body: [
      {
        body: 'Your Inspiration Library is a collection of marketing examples from other brands that you find inspiring. It helps your Director understand not just who you are, but what kind of marketing you aspire to create.',
      },
      {
        heading: 'What to save',
        body: 'Add anything that catches your eye:',
        steps: [
          'A social media post from a brand that nailed the tone you want',
          'An email subject line that made you click',
          'A landing page design that felt perfect',
          'A competitor\'s campaign that you wish you had thought of',
          'A tagline or slogan that resonated with you',
        ],
        tip: 'You do not need to only save examples from your own industry. A physiotherapy clinic can be inspired by how Apple launches products or how a local cafe builds community on Instagram.',
      },
      {
        heading: 'How to add inspiration',
        body: 'Share examples with your Director in conversation. Say things like:',
        steps: [
          '"Save this as inspiration: [paste the text or link]"',
          '"I love how this brand talks to their audience — add this to my inspiration library"',
          '"Add Nike\'s \'Just Do It\' campaign to my inspiration"',
        ],
      },
      {
        heading: 'Your Emulation Wishlist',
        body: 'As a special part of your Inspiration Library, you can create an Emulation Wishlist — brands and campaigns you specifically want to emulate. This is different from general inspiration because it tells your Director "make my marketing feel like this". It directly influences the creative direction of your content.',
      },
      {
        heading: 'How it is used',
        body: 'When your agents create content, they reference your Inspiration Library for creative direction. If you have saved a social post you loved, your content specialist will study its structure, tone, and hook when writing your own posts. The more examples you save, the better your agency understands your taste.',
      },
    ],
    tags: ['inspiration', 'library', 'examples', 'emulation', 'wishlist', 'creative', 'reference', 'save'],
    relatedSlugs: ['your-brand/brand-dna', 'your-brand/voice-and-tone', 'your-brand/content-pillars'],
    lastUpdated: '2026-04-07',
  },
  {
    slug: 'voice-and-tone',
    categorySlug: 'your-brand',
    title: 'Voice & Tone',
    subtitle: 'Make sure your brand sounds like you — every time',
    body: [
      {
        body: 'Your brand voice is how you sound to your audience. It is the difference between "Hey! Check this out!" and "We are pleased to announce..." Both might share the same information, but they feel completely different. Getting your voice right means every piece of content feels authentically you.',
      },
      {
        heading: 'Voice vs tone',
        body: 'Your voice stays the same — it is your brand\'s personality. Your tone shifts depending on the context. A fun brand might be excited when announcing a sale but more serious when addressing a complaint. Your Director understands this difference and adjusts automatically.',
      },
      {
        heading: 'Setting your voice',
        body: 'You can set or update your voice at any time:',
        steps: [
          'Use the /voice command — your Director will ask you a few questions and build a voice profile',
          'Or just describe it: "My brand voice is warm, knowledgeable, and slightly cheeky"',
          'Give examples: "I want to sound like a trusted friend who happens to be an expert"',
        ],
        tip: 'Describe what you do NOT want as well. "Never use corporate buzzwords" or "Avoid being preachy" helps the Director understand your boundaries.',
      },
      {
        heading: 'Checking voice consistency',
        body: 'Use the /voicecheck command to have your Director review a piece of content against your brand voice. Paste in any text — a blog draft, a social caption, or website copy — and the voice specialist will tell you if it sounds like your brand, and suggest adjustments if it does not.',
      },
      {
        heading: 'Voice evolves over time',
        body: 'As you give feedback on content ("this is perfect", "too formal", "I would never say it like that"), your Director refines its understanding of your voice. The more you interact, the more natural the content sounds. You do not need to define everything upfront — it improves with every conversation.',
      },
    ],
    tags: ['voice', 'tone', 'style', 'brand', 'personality', 'consistency', 'writing', 'check'],
    relatedSlugs: ['your-brand/brand-dna', 'your-brand/content-pillars', 'creating-content/write-a-social-post'],
    lastUpdated: '2026-04-07',
  },
  {
    slug: 'content-pillars',
    categorySlug: 'your-brand',
    title: 'Content Pillars',
    subtitle: 'The core topics your brand talks about — and why they matter',
    body: [
      {
        body: 'Content pillars are the three to five main topics your brand consistently talks about. They keep your marketing focused and stop you from posting random content that does not connect to your business goals.',
      },
      {
        heading: 'Why pillars matter',
        body: 'Without content pillars, most businesses end up posting whatever comes to mind — a mix of promotions, random tips, and news that does not build towards anything. Pillars give your content a structure. Your audience learns what to expect from you, search engines understand what you are about, and your Director knows what kind of content to create.',
      },
      {
        heading: 'Examples',
        body: 'Here is what pillars might look like for different businesses:',
        steps: [
          'Weight loss clinic: weight management tips, healthy recipes, success stories, telehealth convenience, seasonal wellness',
          'Skincare brand: ingredient education, skin routines, product spotlights, behind the scenes, customer transformations',
          'SaaS startup: product updates, industry insights, customer stories, how-to guides, company culture',
        ],
      },
      {
        heading: 'Setting your pillars',
        body: 'Use the /pillars command to define or update your content pillars. Your Director will suggest pillars based on what it knows about your business, or you can define them yourself:',
        steps: [
          'Type /pillars to see your current pillars or start setting them up',
          'Or just say "My content pillars should be: education, behind the scenes, product launches, and community stories"',
          'Your Director will confirm and start using them when creating content',
        ],
        tip: 'Start with 3-5 pillars. Too few and your content gets repetitive. Too many and it loses focus. You can always adjust them later.',
      },
      {
        heading: 'How pillars are used',
        body: 'When your Director fills your content calendar with the /fill command, it balances posts across your pillars. When it writes a blog or social post, it aligns with one of your pillars. Over time, you will see a consistent, strategic mix of content rather than a random collection of posts.',
      },
    ],
    tags: ['pillars', 'content', 'topics', 'strategy', 'focus', 'themes', 'categories', 'planning'],
    relatedSlugs: ['your-brand/brand-dna', 'your-brand/voice-and-tone', 'publishing/auto-fill-calendar'],
    lastUpdated: '2026-04-07',
  },
]

import type { HelpArticle } from '../types'

export const creatingContentArticles: HelpArticle[] = [
  {
    slug: 'write-a-social-post',
    categorySlug: 'creating-content',
    title: 'Write a Social Media Post',
    subtitle: 'Ask your Director for posts tailored to each platform',
    body: [
      {
        body: 'Creating social media posts is one of the most common things you will ask your Director to do. Just describe what you want to post about, and it will write platform-ready content for you.',
      },
      {
        heading: 'How to ask',
        body: 'You can type naturally or use the /post shortcut. Both work the same way:',
        steps: [
          'Type /post in the chat, followed by your topic — for example, /post about our new spring collection',
          'Or just say "Write me an Instagram post about our weekend special"',
          'If you want posts for multiple platforms at once, say "Write posts for Instagram, Facebook, and LinkedIn about our new service"',
        ],
        tip: 'The more context you give, the better the result. Mention who the post is for, what you want people to do (visit your website, book an appointment, etc.), and any special offers.',
      },
      {
        heading: 'Platform-specific content',
        body: 'Your Director knows the differences between platforms and writes accordingly. Instagram posts are visual and hashtag-friendly. LinkedIn posts are more professional and thought-leadership focused. TikTok captions are short and punchy. Facebook posts can be longer and more conversational. You do not need to specify these rules — the agency handles it.',
      },
      {
        heading: 'What you get back',
        body: 'For each post, you will receive:',
        steps: [
          'The post caption, written in your brand voice',
          'Relevant hashtags (for platforms that use them)',
          'A suggestion for what image or video to pair with it',
          'Your brand signature automatically included',
        ],
      },
      {
        heading: 'Saving and scheduling',
        body: 'Once you have a post you like, you can save it to your content library, schedule it for a specific date and time, or ask the Director to publish it right away. Use the action buttons below the message, or just say "schedule this for next Tuesday at 10am".',
      },
    ],
    tags: ['social', 'post', 'instagram', 'facebook', 'linkedin', 'tiktok', 'write', 'create', 'caption', 'hashtag'],
    relatedSlugs: ['publishing/schedule-a-post', 'publishing/auto-fill-calendar', 'video-and-design/create-an-ai-video'],
    lastUpdated: '2026-04-07',
  },
  {
    slug: 'write-a-blog',
    categorySlug: 'creating-content',
    title: 'Write a Blog Article',
    subtitle: 'Get SEO-optimised articles that help people find your business online',
    body: [
      {
        body: 'Blog articles are one of the best ways to get found on Google. Your Director writes full-length articles optimised for search engines (SEO means "search engine optimisation" — basically, making sure Google shows your article to the right people).',
      },
      {
        heading: 'How to ask',
        body: 'Use the /blog shortcut or just describe what you want:',
        steps: [
          'Type /blog followed by your topic — for example, /blog 5 benefits of telehealth for busy parents',
          'For extra search optimisation, use /seoblog — this tells the SEO specialist to get involved',
          'Or just say "Write a blog post about how to choose the right moisturiser for dry skin"',
        ],
        tip: 'If you have a specific keyword you want to rank for on Google, mention it. For example: "Write a blog targeting the keyword \'best weight loss clinic Melbourne\'".',
      },
      {
        heading: 'What you get back',
        body: 'A complete, ready-to-publish article including:',
        steps: [
          'A compelling headline designed to get clicks',
          'A meta description (the short summary that appears in Google search results)',
          'Well-structured headings and subheadings',
          'Engaging body content written in your brand voice',
          'A call to action at the end (such as "Book a consultation" or "Shop now")',
        ],
      },
      {
        heading: 'Compliance checking',
        body: 'If your business is in healthcare, every blog article is automatically checked against AHPRA and TGA advertising rules before it is saved. The compliance specialist flags anything that could be problematic — such as testimonials, before-and-after claims, or unsupported health claims.',
        warning: 'Australian health businesses face fines of up to $120,000 per advertising offence. The compliance check helps protect you, but always review the final content yourself.',
      },
      {
        heading: 'After it is written',
        body: 'Use the action buttons below the article to save it to your content library, email it to yourself, or export it as a PDF. If you want changes, just tell your Director — "Make the introduction shorter" or "Add a section about pricing".',
      },
    ],
    tags: ['blog', 'article', 'seo', 'search', 'google', 'write', 'content', 'keyword', 'meta', 'compliance'],
    relatedSlugs: ['creating-content/write-a-social-post', 'creating-content/landing-pages', 'your-brand/content-pillars'],
    lastUpdated: '2026-04-07',
  },
  {
    slug: 'email-campaigns',
    categorySlug: 'creating-content',
    title: 'Email Campaigns',
    subtitle: 'Welcome sequences, newsletters, and win-back emails',
    body: [
      {
        body: 'Email is still one of the most effective marketing channels. Your Director can write complete email sequences — from welcoming new subscribers to bringing back customers who have not purchased in a while.',
      },
      {
        heading: 'Types of email campaigns',
        body: 'You can ask for any kind of email campaign. The most common ones are:',
        steps: [
          'Welcome sequence — a series of emails sent to new subscribers or customers over their first week or two',
          'Newsletter — a regular update (weekly, fortnightly, or monthly) sharing news, tips, and offers',
          'Win-back campaign — emails targeting people who have not engaged with your business recently',
          'Promotional campaign — a time-limited offer or seasonal promotion',
          'Launch sequence — building excitement before a new product or service goes live',
        ],
      },
      {
        heading: 'How to ask',
        body: 'Use shortcuts or natural language:',
        steps: [
          '/emailcampaign — write a full email marketing campaign',
          '/newsletter — write a newsletter',
          '/winback — write a win-back email sequence',
          'Or just say "Write a 5-email welcome sequence for new subscribers"',
        ],
        tip: 'Tell your Director how many emails you want in the sequence and what the goal is (build trust, promote a product, educate, etc.).',
      },
      {
        heading: 'What you get back',
        body: 'Each email in the sequence includes a subject line, preview text, body content, and a call to action. The email specialist also suggests optimal send timing — for example, email 1 on day 0 (immediately), email 2 on day 2, email 3 on day 5.',
      },
      {
        heading: 'Australian compliance',
        body: 'All email campaigns follow the Australian Spam Act 2003. This means every email includes an unsubscribe mechanism, identifies who is sending it, and does not use misleading subject lines. For healthcare businesses, AHPRA and TGA rules are also applied.',
      },
    ],
    tags: ['email', 'campaign', 'newsletter', 'welcome', 'sequence', 'winback', 'subscribers', 'mailchimp', 'marketing'],
    relatedSlugs: ['creating-content/write-a-social-post', 'creating-content/write-a-blog', 'team-and-sharing/email-reports'],
    lastUpdated: '2026-04-07',
  },
  {
    slug: 'landing-pages',
    categorySlug: 'creating-content',
    title: 'Landing Page Copy',
    subtitle: 'Write page copy that turns visitors into customers',
    body: [
      {
        body: 'A landing page is any page on your website designed to get visitors to take a specific action — book a consultation, buy a product, sign up for a free trial. Your Director writes persuasive landing page copy that is designed to convert (that means turning visitors into customers).',
      },
      {
        heading: 'How to ask',
        body: 'Use shortcuts or describe what you need:',
        steps: [
          '/pagecopy — write copy for a full landing page',
          '/hero — write just the hero section (the big headline and opening text visitors see first)',
          'Or just say "Write landing page copy for our new weight loss program"',
        ],
        tip: 'Mention the specific action you want visitors to take. "Book a free consultation", "Download the guide", or "Start a free trial" all lead to very different page structures.',
      },
      {
        heading: 'What you get back',
        body: 'A complete landing page structure including:',
        steps: [
          'Hero section — a headline, subheadline, and call-to-action button text',
          'Problem section — describing the challenge your audience faces',
          'Solution section — how your product or service solves it',
          'Benefits and features — what makes you different',
          'Social proof — where to place testimonials or trust signals',
          'Final call to action — the closing push',
        ],
      },
      {
        heading: 'Conversion best practices',
        body: 'The website specialist applies proven strategies to maximise conversions. This includes clear headlines, benefit-focused language, strong calls to action, and removing anything that might distract visitors from taking action. You do not need to know the technical details — the agency handles it.',
      },
      {
        heading: 'Healthcare landing pages',
        body: 'If your business is in healthcare, landing page copy is automatically reviewed for compliance. Testimonials, before-and-after claims, and certain promotional language may be flagged and adjusted to meet AHPRA and TGA requirements.',
      },
    ],
    tags: ['landing page', 'copy', 'website', 'conversion', 'hero', 'cro', 'sales page', 'headline'],
    relatedSlugs: ['creating-content/write-a-blog', 'creating-content/email-campaigns', 'your-brand/voice-and-tone'],
    lastUpdated: '2026-04-07',
  },
  {
    slug: 'presentations',
    categorySlug: 'creating-content',
    title: 'Create Presentations',
    subtitle: 'Generate slide decks for pitches, meetings, and proposals',
    body: [
      {
        body: 'Need a slide deck for a pitch, a team meeting, or a client presentation? Your Director can create structured presentations with content for each slide.',
      },
      {
        heading: 'How to ask',
        body: 'Use the /slides shortcut or describe what you need:',
        steps: [
          '/slides followed by the topic — for example, /slides quarterly marketing review',
          'Or just say "Create a 10-slide presentation about our new product launch"',
          'You can specify the number of slides, the audience, and the purpose',
        ],
        tip: 'Tell your Director who the presentation is for. A pitch deck for investors looks very different from a team update or a client proposal.',
      },
      {
        heading: 'What you get back',
        body: 'Each slide includes a title, bullet points or key messages, and speaker notes explaining what to say when presenting. The structure follows proven presentation frameworks — starting with the problem, presenting your solution, showing evidence, and ending with a clear ask or next step.',
      },
      {
        heading: 'Customising your deck',
        body: 'After the first draft, you can ask for changes:',
        steps: [
          '"Add a slide about our pricing"',
          '"Make slide 3 more visual — suggest a chart"',
          '"Shorten the introduction"',
          '"Add competitor comparison data"',
        ],
      },
    ],
    tags: ['presentation', 'slides', 'deck', 'pitch', 'meeting', 'proposal', 'keynote', 'powerpoint'],
    relatedSlugs: ['creating-content/write-a-blog', 'creating-content/landing-pages', 'team-and-sharing/sharing-outputs'],
    lastUpdated: '2026-04-07',
  },
  {
    slug: 'ai-images',
    categorySlug: 'creating-content',
    title: 'Generate Marketing Images',
    subtitle: 'Create custom images for social media, blogs, and ads',
    body: [
      {
        body: 'Your Director can generate images using AI. This is useful when you need a quick visual for a social media post, blog article, or ad — without hiring a designer or searching through stock photos.',
      },
      {
        heading: 'How to ask',
        body: 'Use the /visuals shortcut or describe what you want:',
        steps: [
          '/visuals followed by a description — for example, /visuals a modern clinic reception area with natural lighting',
          'Or just say "Create an image for my Instagram post about summer skincare"',
          'Be as descriptive as you like — mention colours, mood, style, and what should be in the image',
        ],
        tip: 'The more specific your description, the better the result. "A flat-lay photo of skincare products on a marble surface with eucalyptus leaves" will give a much better image than just "skincare image".',
      },
      {
        heading: 'What you can create',
        body: 'AI image generation works best for:',
        steps: [
          'Social media graphics and post images',
          'Blog header images and featured images',
          'Concept art and mood boards',
          'Product lifestyle images (not product photos)',
          'Abstract and decorative backgrounds',
        ],
        warning: 'AI-generated images should not be used for medical before-and-after photos or to represent real patients. For healthcare businesses, always use real photography for clinical results.',
      },
      {
        heading: 'Using images with your content',
        body: 'When your Director creates a social media post or blog, it may automatically generate a matching image. You can also ask for images separately and pair them with your own content. Generated images are saved to your media library for reuse.',
      },
      {
        heading: 'Design vs image generation',
        body: 'Image generation creates pictures from scratch using AI. For branded graphics with your logo, specific layouts, and text overlays, use the /design command instead — that uses Canva, which gives you more control over the final result.',
      },
    ],
    tags: ['image', 'generate', 'ai', 'visual', 'photo', 'graphic', 'picture', 'create', 'social media'],
    relatedSlugs: ['video-and-design/design-with-canva', 'creating-content/write-a-social-post', 'video-and-design/create-an-ai-video'],
    lastUpdated: '2026-04-07',
  },
]

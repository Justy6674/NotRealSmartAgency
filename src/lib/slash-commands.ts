export interface SlashCommand {
  command: string
  label: string
  description: string
  message: string
  category: string
}

export const SLASH_COMMANDS: SlashCommand[] = [
  // Director
  { command: '/proforma', label: 'Show proforma', description: 'View your marketing proforma', message: 'Show me my marketing proforma.', category: 'Director' },
  { command: '/status', label: 'Quick status', description: 'Status update across everything', message: 'Give me a quick status update on my marketing.', category: 'Director' },
  { command: '/audit', label: 'Marketing audit', description: 'Full marketing audit', message: 'Run a full marketing audit on my brand.', category: 'Director' },
  { command: '/fill', label: 'Fill calendar', description: 'Auto-generate 2 weeks of content', message: 'Fill my content calendar for the next 2 weeks.', category: 'Director' },
  { command: '/meeting', label: 'Team meeting', description: 'Get all departments to weigh in', message: 'Convene a team meeting on my current priorities.', category: 'Director' },
  { command: '/plan', label: 'Plan campaign', description: 'Plan a multi-channel campaign', message: 'Help me plan a marketing campaign.', category: 'Director' },
  { command: '/review', label: 'Review brand', description: 'End-to-end brand review', message: 'Review my brand and tell me what to focus on.', category: 'Director' },
  { command: '/research', label: 'Research', description: 'Search the web for market intelligence', message: 'Research the latest trends and news relevant to my brand.', category: 'Director' },

  // Content
  { command: '/schedule', label: 'Schedule post', description: 'Schedule a draft post', message: 'Schedule my draft posts. Show me what needs scheduling.', category: 'Content' },
  { command: '/approve', label: 'Approve posts', description: 'Approve all draft posts', message: 'Approve all my draft posts and schedule them.', category: 'Content' },
  { command: '/publish', label: 'Publish now', description: 'Publish a post immediately', message: 'Publish my next scheduled post right now.', category: 'Content' },
  { command: '/post', label: 'Write a post', description: 'Social media post', message: 'Write me a social media post for my brand.', category: 'Content' },
  { command: '/blog', label: 'Blog article', description: 'Write an SEO-optimised blog post', message: 'Write an SEO-optimised blog article for my brand. Ask me what topic and keyword to target.', category: 'Content' },
  { command: '/seoblog', label: 'SEO blog', description: 'Write an SEO-optimised blog targeting a keyword', message: 'Write an SEO blog post for my brand. Ask me what keyword to target.', category: 'Content' },
  { command: '/blogideas', label: 'Blog ideas', description: 'Generate blog topic ideas for SEO', message: 'Suggest 10 blog topics that would drive organic traffic to my brand.', category: 'SEO' },
  { command: '/email', label: 'Write email', description: 'Marketing email', message: 'Write a marketing email for my brand.', category: 'Content' },
  { command: '/landing', label: 'Landing page', description: 'Landing page copy', message: 'Write landing page copy for my main offer.', category: 'Content' },
  { command: '/repurpose', label: 'Repurpose video', description: 'Turn a video into 20+ pieces', message: 'Repurpose my latest video into clips, posts, blog, and newsletter.', category: 'Content' },

  // SEO
  { command: '/keywords', label: 'Keyword research', description: 'Find best keywords', message: 'Research the best keywords for my brand.', category: 'SEO' },
  { command: '/seoaudit', label: 'SEO audit', description: 'Audit website SEO', message: 'Audit my website for SEO issues.', category: 'SEO' },
  { command: '/rankings', label: 'Check rankings', description: 'Where do I rank', message: 'Check where my brand ranks for our target keywords.', category: 'SEO' },
  { command: '/clusters', label: 'Topic clusters', description: 'Build content clusters', message: 'Build topic clusters for my content strategy.', category: 'SEO' },
  { command: '/trendsearch', label: 'Trend search', description: 'Find trending topics in my niche', message: 'What are the trending topics in my industry right now?', category: 'SEO' },

  // Paid Ads
  { command: '/googleads', label: 'Google Ads', description: 'Write Google Ads copy', message: 'Write Google Ads copy for my brand.', category: 'Ads' },
  { command: '/metaads', label: 'Meta ads', description: 'Facebook/Instagram ads', message: 'Create a Facebook and Instagram ad set for my brand.', category: 'Ads' },
  { command: '/budget', label: 'Ad budget', description: 'Budget allocation advice', message: 'How should I split my ad budget across platforms?', category: 'Ads' },
  { command: '/tiktokads', label: 'TikTok ads', description: 'TikTok ad scripts', message: 'Write TikTok ad scripts for my brand.', category: 'Ads' },
  { command: '/adcopy', label: 'Write ads', description: 'Generate multi-variant ad copy', message: 'Write ad copy for my brand. Ask me which platform and what I am promoting.', category: 'Ads' },

  // Strategy
  { command: '/campaign', label: 'Full campaign', description: '14-day agency campaign with content, videos, design & scheduling', message: 'Run a full 14-day marketing campaign for my brand like a real agency would. Here is what I need:\n\n1. **Strategy first**: Build a 14-day phased content strategy (awareness → interest → conversion → retention). Mix educational posts, product showcases, behind-the-scenes, testimonials/social proof, and engagement posts.\n\n2. **Create the content**: Write all the social media posts for each day. Design graphics in Canva for the visual posts. Write two complete video production briefs with scripts, shot lists, captions and asset checklists.\n\n3. **Schedule everything**: Fill my content calendar with all 14 days of posts. Schedule them to publish automatically via Mixpost.\n\n4. **Use all our tools**: Canva for graphics, the NRS video toolkit where configured, and Mixpost for publishing. Use what you know about my brand — voice, audience, competitors, products.\n\nMake it look professional. This should be indistinguishable from what a $5,000/month agency would produce.', category: 'Strategy' },
  { command: '/gtm', label: 'Go-to-market', description: 'GTM plan', message: 'Build a go-to-market plan for my product launch.', category: 'Strategy' },
  { command: '/roadmap', label: 'Growth roadmap', description: '90-day growth plan', message: 'Create a 90-day growth roadmap for my brand.', category: 'Strategy' },
  { command: '/pricing', label: 'Pricing strategy', description: 'Pricing advice', message: 'Help me define my pricing strategy.', category: 'Strategy' },

  // Email
  { command: '/emailcampaign', label: 'Email campaign', description: 'Design a multi-email campaign', message: 'Design an email campaign for my brand.', category: 'Email' },
  { command: '/welcomeemails', label: 'Welcome emails', description: 'Welcome sequence for new subscribers', message: 'Create a welcome email sequence for new subscribers.', category: 'Email' },
  { command: '/welcome', label: 'Welcome sequence', description: 'New subscriber emails', message: 'Build a welcome email sequence for new subscribers.', category: 'Email' },
  { command: '/newsletter', label: 'Newsletter', description: 'Weekly newsletter', message: "Write this week's newsletter for my audience.", category: 'Email' },
  { command: '/winback', label: 'Win-back email', description: 'Re-engage customers', message: 'Write a re-engagement email for inactive customers.', category: 'Email' },
  { command: '/inbox', label: 'Check inbox', description: 'Review customer emails', message: 'Check my inbox for important customer emails.', category: 'Email' },

  // Growth
  { command: '/partners', label: 'Find partners', description: 'Partnership opportunities', message: 'Help me find potential partners for my brand.', category: 'Growth' },
  { command: '/referral', label: 'Referral program', description: 'Design referral system', message: 'Design a referral program for my customers.', category: 'Growth' },
  { command: '/outreach', label: 'Outreach emails', description: 'Partnership outreach', message: 'Draft partnership outreach emails.', category: 'Growth' },
  { command: '/pr', label: 'PR campaign', description: 'Media coverage plan', message: 'Plan a PR campaign to get media coverage.', category: 'Growth' },

  // Brand
  { command: '/voicecheck', label: 'Voice check', description: 'Check content matches brand voice', message: 'Check my latest content for brand voice consistency.', category: 'Brand' },
  { command: '/voice', label: 'Brand voice', description: 'Define voice and tone', message: 'Help me define my brand voice and tone.', category: 'Brand' },
  { command: '/guidelines', label: 'Brand guidelines', description: 'Shareable guidelines', message: 'Create brand guidelines I can share with others.', category: 'Brand' },
  { command: '/pillars', label: 'Content pillars', description: 'Messaging framework', message: 'Define my content pillars and messaging framework.', category: 'Brand' },
  { command: '/visuals', label: 'Brand visuals', description: 'Generate imagery', message: 'Generate brand visuals and imagery for my brand.', category: 'Brand' },

  // Competitors
  { command: '/swot', label: 'SWOT analysis', description: 'Strengths/weaknesses analysis', message: 'Run a SWOT analysis against my competitors.', category: 'Competitors' },
  { command: '/scan', label: 'Scan competitors', description: 'Check competitor websites', message: "Scan my competitors' websites and tell me what they're doing.", category: 'Competitors' },
  { command: '/gaps', label: 'Market gaps', description: 'Find opportunities', message: 'Find gaps in the market I can exploit.', category: 'Competitors' },
  { command: '/battlecards', label: 'Battle cards', description: 'Competitor comparisons', message: 'Create battle cards comparing me to my top competitors.', category: 'Competitors' },
  { command: '/deepscan', label: 'Deep scan competitor', description: 'Full competitive analysis of a website', message: 'Deep scan a competitor website and compare them to my brand.', category: 'Competitors' },

  // Website
  { command: '/cro', label: 'CRO audit', description: 'Conversion rate audit', message: 'Audit my website for conversion rate improvements.', category: 'Website' },
  { command: '/pagecopy', label: 'Page copy', description: 'Rewrite page copy', message: 'Rewrite a page on my website to convert better.', category: 'Website' },
  { command: '/ux', label: 'UX review', description: 'Website UX review', message: 'Review my website UX and suggest improvements.', category: 'Website' },
  { command: '/hero', label: 'Hero section', description: 'Better homepage hero', message: 'Write a better hero section for my homepage.', category: 'Website' },

  // Compliance
  { command: '/check', label: 'Compliance check', description: 'Check AHPRA/TGA compliance', message: 'Check my latest content for AHPRA and TGA compliance.', category: 'Compliance' },
  { command: '/claims', label: 'Audit claims', description: 'Audit health claims', message: 'Audit my website for non-compliant health claims.', category: 'Compliance' },
  { command: '/safelanguage', label: 'Safe language', description: 'Compliant rewrites', message: 'Help me rewrite content using compliant language.', category: 'Compliance' },

  // Analytics
  { command: '/howamidoing', label: 'Performance', description: 'Marketing performance summary', message: 'Show me my marketing performance summary.', category: 'Analytics' },
  { command: '/whatsworking', label: "What's working", description: 'Best performing content', message: 'Analyse what content is working best and why.', category: 'Analytics' },
  { command: '/report', label: 'Monthly report', description: 'Generate monthly report', message: 'Generate a monthly marketing report.', category: 'Analytics' },
  { command: '/roi', label: 'Campaign ROI', description: 'Calculate return on investment', message: 'Calculate the ROI on my recent campaigns.', category: 'Analytics' },

  // Video
  { command: '/script', label: 'Video script', description: 'Write a video script', message: 'Write a video script for my brand.', category: 'Video' },
  { command: '/video', label: 'Create video', description: 'Generate an AI avatar video', message: 'Create a video for my brand using the script I give you.', category: 'Video' },
  { command: '/process', label: 'Process video', description: 'Transcribe and caption', message: 'I have a video to process into content.', category: 'Video' },
  { command: '/storyboard', label: 'Storyboard', description: 'Video storyboard', message: 'Create a storyboard for a product demo video.', category: 'Video' },

  // Design
  { command: '/design', label: 'Design graphic', description: 'Create a design in Canva', message: 'Design me a social media graphic for my brand.', category: 'Content' },
  { command: '/export', label: 'Export design', description: 'Download a Canva design', message: 'Export my latest Canva design as a PNG.', category: 'Content' },

  // Automation
  { command: '/workflow', label: 'Lead workflow', description: 'Automated lead nurture', message: 'Design an automated lead nurture workflow.', category: 'Automation' },
  { command: '/zapier', label: 'Zapier flows', description: 'Marketing automations', message: 'Suggest Zapier automations for my marketing stack.', category: 'Automation' },
  { command: '/chatbot', label: 'Chatbot flow', description: 'Website chatbot', message: 'Design a chatbot flow for my website.', category: 'Automation' },

  // Universal
  { command: '/calendar', label: 'Show calendar', description: 'View scheduled posts', message: "Show me what's scheduled this week.", category: 'View' },
  { command: '/outputs', label: 'Show outputs', description: 'Recent content created', message: 'Show me my recent content outputs.', category: 'View' },
  { command: '/media', label: 'Show media', description: 'Media library', message: 'Show me my media library.', category: 'View' },
  { command: '/competitors', label: 'Show competitors', description: 'Competitor analysis', message: 'Show me my competitor analysis.', category: 'View' },
  { command: '/help', label: 'Help', description: 'What can you do?', message: 'What can you help me with? Show me the main things you can do.', category: 'View' },
]

export function filterCommands(query: string): SlashCommand[] {
  const q = query.toLowerCase().replace('/', '')
  if (!q) return SLASH_COMMANDS
  return SLASH_COMMANDS.filter(cmd =>
    cmd.command.includes(q) || cmd.label.toLowerCase().includes(q) || cmd.category.toLowerCase().includes(q)
  )
}

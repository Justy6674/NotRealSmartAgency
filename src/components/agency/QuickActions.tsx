'use client'

import type { AgentType, Brand } from '@/types/database'

interface QuickActionsProps {
  brand?: Brand | null
  agentType: AgentType
  onAction: (message: string) => void
}

interface ActionChip {
  label: string
  message: string
}

// ─── Department-specific quick actions ──────────────────────────────────────

const BASE_ACTIONS: Record<string, ActionChip[]> = {
  overall: [
    { label: 'Run marketing audit', message: 'Run a comprehensive marketing audit for my brand. Scan our website, review social presence, analyse competitors, and produce a prioritised action plan.' },
    { label: 'Convene team meeting', message: 'Convene an agency meeting to align all departments on our current priorities. Summarise open tasks, blockers, and next steps for each team.' },
    { label: 'Delegate a brief', message: 'I have a new project. Help me write a brief and delegate it to the right department with clear deliverables and deadlines.' },
    { label: 'Monthly status report', message: 'Generate a monthly marketing status report covering all active campaigns, content output, SEO progress, and budget spend across departments.' },
    { label: 'Plan a campaign', message: 'Help me plan a full multi-channel marketing campaign. Include objectives, target audience, channels, content needs, timeline, and budget allocation.' },
  ],
  content: [
    { label: 'Write social posts', message: 'Write a week of social media posts for my brand, covering at least 5 posts across our key platforms. Match our brand voice and include hooks, CTAs, and hashtag suggestions.' },
    { label: 'Draft a blog article', message: 'Write a full SEO-optimised blog article for my brand. Include a compelling headline, meta description, subheadings, and a clear CTA.' },
    { label: 'Create landing page copy', message: 'Write high-converting landing page copy for my brand\'s main offer. Include hero headline, subheadline, benefit bullets, social proof section, and CTA.' },
    { label: 'Write email copy', message: 'Write a promotional email for my brand including subject line, preview text, body copy, and CTA. Keep it on-brand and conversion-focused.' },
    { label: 'Generate content ideas', message: 'Generate 20 content ideas for my brand organised by content pillar. Include format suggestions (blog, video, carousel, reel) and search intent for each.' },
  ],
  seo: [
    { label: 'Research keywords', message: 'Research and cluster target keywords for my brand. Group them by topic, search intent, and difficulty. Prioritise quick wins and high-value terms.' },
    { label: 'Build topic clusters', message: 'Create a topic cluster strategy for my brand. Define pillar pages and supporting content with internal linking architecture.' },
    { label: 'Audit on-page SEO', message: 'Analyse our top 5 landing pages for on-page SEO issues. Check title tags, meta descriptions, headings, content depth, and internal links.' },
    { label: 'Optimise for AI search', message: 'Develop a GEO (Generative Engine Optimisation) strategy for my brand. Identify how to appear in AI-generated answers and citation panels.' },
    { label: 'Track our rankings', message: 'Search for our primary keywords and report where we currently rank. Identify positions we can improve quickly and pages that need updating.' },
  ],
  paid_ads: [
    { label: 'Write Google Ads', message: 'Write a full Google Ads campaign for my brand. Include 3 responsive search ads with 15 headlines and 4 descriptions each, plus sitelink extensions.' },
    { label: 'Create Meta ad set', message: 'Create a Meta (Facebook/Instagram) ad set for my brand. Write 3 ad variants with primary text, headline, description, and CTA button recommendation.' },
    { label: 'Draft LinkedIn ads', message: 'Write LinkedIn Sponsored Content ads for my brand. Include 3 variants optimised for B2B with professional tone and clear value propositions.' },
    { label: 'Build TikTok ad scripts', message: 'Write 3 TikTok ad scripts for my brand. Use hook-story-offer structure, keep each under 30 seconds, and match platform-native style.' },
    { label: 'Plan ad budget split', message: 'Recommend a paid advertising budget allocation across Google, Meta, LinkedIn, and TikTok for my brand based on our goals and audience.' },
  ],
  strategy: [
    { label: 'Build GTM plan', message: 'Create a go-to-market plan for my brand. Cover positioning, target segments, channel strategy, launch timeline, and success metrics.' },
    { label: 'Plan campaign strategy', message: 'Design a quarterly campaign strategy for my brand. Define themes, channels, content needs, budget allocation, and KPIs for each campaign.' },
    { label: 'Define pricing strategy', message: 'Analyse our market position and recommend a pricing strategy. Include competitive benchmarking, value-based pricing options, and tiering recommendations.' },
    { label: 'Create launch roadmap', message: 'Build a detailed product/service launch roadmap for my brand with phases, milestones, dependencies, and responsible teams.' },
    { label: 'Build strategy deck', message: 'Create a marketing strategy presentation for my brand. Include market analysis, positioning, channel strategy, and 90-day action plan as slides.' },
  ],
  email: [
    { label: 'Build welcome sequence', message: 'Write a 5-email welcome sequence for new subscribers. Include subject lines, preview text, and full body copy for each email with clear CTAs.' },
    { label: 'Design nurture sequence', message: 'Create a lead nurturing email sequence with 4 emails that move prospects from awareness to consideration to decision. Include subject lines and body copy.' },
    { label: 'Write newsletter', message: 'Write this month\'s email newsletter for my brand. Include an engaging intro, 3 content sections, and a primary CTA.' },
    { label: 'Draft re-engagement', message: 'Write a 3-email re-engagement sequence for inactive subscribers. Include compelling subject lines and win-back offers.' },
    { label: 'Review inbox', message: 'Check our email inbox and summarise recent conversations, common enquiry patterns, and anything requiring attention.' },
  ],
  growth: [
    { label: 'Design referral program', message: 'Design a referral program for my brand. Include incentive structure, referral mechanics, promotional messaging, and tracking approach.' },
    { label: 'Find partners', message: 'Research and identify 10 potential strategic partners for my brand. Scan their websites, assess alignment, and draft a partnership pitch for the top 3.' },
    { label: 'Plan PR campaign', message: 'Create a PR campaign plan for my brand. Include story angles, target media outlets, press release draft, and outreach timeline.' },
    { label: 'Build influencer brief', message: 'Identify relevant influencers for my brand and create a collaboration brief with deliverables, compensation framework, and content guidelines.' },
    { label: 'Draft outreach emails', message: 'Write 3 cold outreach email templates for partnership development. Include subject line, personalisation, value proposition, and CTA for each.' },
  ],
  brand: [
    { label: 'Define brand voice', message: 'Define our brand voice and tone guidelines. Include voice attributes, tone spectrum for different contexts, do/don\'t examples, and sample copy in our voice.' },
    { label: 'Create positioning', message: 'Develop a brand positioning statement and messaging framework. Include our unique value proposition, key differentiators, and elevator pitch.' },
    { label: 'Build brand guidelines', message: 'Create comprehensive brand guidelines for my brand. Cover logo usage, colour palette, typography, imagery style, and voice and tone rules.' },
    { label: 'Define content pillars', message: 'Define 4-6 content pillars for my brand with descriptions, key themes, example topics, and how each pillar serves our business objectives.' },
    { label: 'Generate brand visuals', message: 'Generate brand imagery for my brand that reflects our visual identity. Create social media templates, a hero image concept, and brand pattern ideas.' },
  ],
  competitor: [
    { label: 'Run SWOT analysis', message: 'Run a detailed SWOT analysis for my brand versus our top 3 competitors. Include specific evidence for each point and strategic implications.' },
    { label: 'Scan competitor sites', message: 'Scan our competitors\' websites and analyse their positioning, messaging, content strategy, SEO approach, and conversion tactics.' },
    { label: 'Find market gaps', message: 'Analyse our competitive landscape and identify underserved market gaps we can exploit. Research competitor offerings and customer pain points.' },
    { label: 'Track competitor moves', message: 'Research our competitors\' latest marketing activities, content, campaigns, and product updates. Summarise changes and recommend our response.' },
    { label: 'Build battle cards', message: 'Create sales battle cards for my brand versus each of our top competitors. Include their strengths, weaknesses, objection handling, and our winning differentiators.' },
  ],
  website: [
    { label: 'Audit conversion rate', message: 'Analyse our website\'s conversion funnel. Identify drop-off points, friction elements, and provide specific CRO recommendations with expected impact.' },
    { label: 'Write page copy', message: 'Write high-converting copy for our key website pages: homepage, about, services, and contact. Match our brand voice and optimise for both users and SEO.' },
    { label: 'Review UX flow', message: 'Review our website\'s user experience. Assess navigation, information architecture, mobile responsiveness, and user journey from landing to conversion.' },
    { label: 'Check accessibility', message: 'Audit our website for accessibility compliance. Check WCAG guidelines, screen reader compatibility, colour contrast, and provide a remediation checklist.' },
    { label: 'Design hero section', message: 'Design a hero section concept for our website with a compelling headline, supporting visual description, benefit highlights, and CTA placement.' },
  ],
  compliance: [
    { label: 'Review content', message: 'Review our latest marketing content for regulatory compliance issues. Flag problematic claims, missing disclaimers, and suggest compliant rewrites.' },
    { label: 'Audit testimonials', message: 'Audit our website testimonials and reviews for compliance with advertising standards. Flag any that make prohibited claims or lack required context.' },
    { label: 'Write compliant claims', message: 'Help me write marketing claims for my brand\'s products/services that are fully compliant with Australian advertising regulations. Provide evidence requirements for each claim.' },
    { label: 'Check social copy', message: 'Review our recent social media posts for compliance issues. Flag any claims, before/after imagery rules, or testimonial violations.' },
  ],
  analytics: [
    { label: 'Build KPI dashboard', message: 'Design a marketing KPI dashboard for my brand. Define the metrics to track, data sources, benchmarks, and recommended reporting cadence.' },
    { label: 'Run attribution analysis', message: 'Analyse our marketing attribution model. Map customer touchpoints, recommend an attribution approach, and identify which channels deserve more investment.' },
    { label: 'Create monthly report', message: 'Generate a monthly marketing performance report template for my brand. Include traffic, leads, conversions, revenue attribution, and trend analysis sections.' },
    { label: 'Calculate campaign ROI', message: 'Build a campaign ROI framework for my brand. Define cost tracking, revenue attribution methodology, and provide a calculator template for each channel.' },
    { label: 'Analyse traffic patterns', message: 'Scan our website and analyse traffic patterns. Identify top-performing pages, traffic sources, user behaviour flows, and areas losing visitors.' },
  ],
  automation: [
    { label: 'Design lead workflow', message: 'Design an automated lead capture and nurture workflow for my brand. Map triggers, actions, conditions, and integrations needed.' },
    { label: 'Map API integrations', message: 'Map out the API integrations needed for our marketing stack. Identify data flows, webhook requirements, and automation opportunities.' },
    { label: 'Build chatbot flow', message: 'Design a website chatbot conversation flow for my brand. Include greeting, qualification questions, FAQ responses, and handoff to human triggers.' },
    { label: 'Plan automation stack', message: 'Audit our current marketing processes and recommend an automation strategy. Prioritise by time saved, complexity, and business impact.' },
    { label: 'Create Zapier workflows', message: 'Design 5 Zapier/Make automation workflows for my brand\'s marketing operations. Include trigger, action steps, and data mapping for each.' },
  ],
  video: [
    { label: 'Write video script', message: 'Write a 60-second video script for my brand. Include hook, problem, solution, proof, and CTA sections with speaker notes and visual directions.' },
    { label: 'Build storyboard', message: 'Create a detailed storyboard for a brand video. Include scene descriptions, camera angles, on-screen text, voiceover script, and timing for each frame.' },
    { label: 'Create Reels scripts', message: 'Write 5 short-form video scripts (15-30 seconds each) for TikTok/Reels. Use hook-first structure with pattern interrupts and strong CTAs.' },
    { label: 'Plan video series', message: 'Plan a 4-part video content series for my brand. Define the theme, individual episode topics, key messages, and production requirements.' },
    { label: 'Write explainer script', message: 'Write an explainer video script that walks viewers through our main product/service. Include problem setup, solution walkthrough, benefits, and CTA.' },
  ],
  martech: [],
}

function getQuickActions(agentType: AgentType, brand?: Brand | null): ActionChip[] {
  const base = [...(BASE_ACTIONS[agentType] ?? BASE_ACTIONS.overall)]

  const isRegulated = brand?.compliance_flags?.ahpra || brand?.compliance_flags?.tga
  const hasWebsite = !!brand?.website_url

  // Conditional: compliance-specific for regulated brands
  if (isRegulated) {
    if (agentType === 'content') {
      base.push({ label: 'Write compliant copy', message: 'Write marketing copy for my brand that fully complies with AHPRA and TGA advertising guidelines. Flag any claims that need evidence or disclaimers.' })
    }
    if (agentType === 'paid_ads') {
      base.push({ label: 'Compliant ad copy', message: 'Write paid advertising copy for my brand that fully complies with AHPRA and TGA advertising regulations. Include required disclaimers and avoid prohibited claims.' })
    }
    if (agentType === 'video') {
      base.push({ label: 'Compliant video script', message: 'Write a video script for my brand that complies with AHPRA and TGA advertising guidelines. Avoid prohibited therapeutic claims and include required disclaimers.' })
    }
    if (agentType === 'compliance') {
      base.push({ label: 'AHPRA/TGA deep check', message: 'Perform a deep AHPRA and TGA compliance audit of all our marketing materials. Check for prohibited therapeutic claims, before/after restrictions, testimonial rules, and required disclaimers.' })
    }
  }

  // Conditional: scan website for relevant departments
  if (hasWebsite && ['seo', 'website', 'compliance'].includes(agentType)) {
    base.push({ label: 'Scan our website', message: `Scan our website at ${brand!.website_url} for issues and provide a detailed report with specific recommendations.` })
  }

  // Conditional: scan repo for automation
  if (brand?.github_url && agentType === 'automation') {
    base.push({ label: 'Scan our repo', message: `Scan our GitHub repository at ${brand.github_url} and analyse the codebase for automation opportunities, CI/CD improvements, and integration points.` })
  }

  return base.slice(0, 6)
}

export function QuickActions({ brand, agentType, onAction }: QuickActionsProps) {
  const chips = getQuickActions(agentType, brand)

  if (chips.length === 0) return null

  return (
    <div className="flex flex-wrap justify-center gap-2" role="list">
      {chips.map((chip) => (
        <button
          key={chip.label}
          role="listitem"
          onClick={() => onAction(chip.message)}
          className="rounded-full border border-border bg-card px-4 py-1.5 text-sm text-foreground transition-colors hover:border-primary/50 hover:bg-primary/5 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {chip.label}
        </button>
      ))}
    </div>
  )
}

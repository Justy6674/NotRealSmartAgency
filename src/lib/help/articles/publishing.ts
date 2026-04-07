import type { HelpArticle } from '../types'

export const publishingArticles: HelpArticle[] = [
  {
    slug: 'schedule-a-post',
    categorySlug: 'publishing',
    title: 'Schedule a Post',
    subtitle: 'Set your content to go live at the perfect time',
    body: [
      {
        body: 'Once your Director has written a social media post, you can schedule it to publish at a specific date and time. This means you can plan your content in advance and let the system handle the rest.',
      },
      {
        heading: 'How to schedule',
        body: 'There are a few ways to schedule a post:',
        steps: [
          'After your Director writes a post, say "Schedule this for next Tuesday at 9am"',
          'Use the /schedule command — for example, /schedule this post for Friday at 2pm',
          'In the Creative Studio, open the Calendar tab and drag posts to your preferred time slots',
        ],
        tip: 'Your Director knows the best times to post on each platform. If you are not sure when to schedule, just say "Schedule this at the best time" and it will choose for you.',
      },
      {
        heading: 'Editing a scheduled post',
        body: 'Changed your mind? You can update or cancel any scheduled post before it goes live. Just say "Show me my scheduled posts" or visit the Calendar tab in the Creative Studio. From there you can edit the caption, change the date, or remove it entirely.',
      },
      {
        heading: 'What happens after scheduling',
        body: 'Scheduled posts sit in a queue. Every five minutes, the system checks for posts that are due and publishes them to your connected social media accounts. You will see the status change from "scheduled" to "published" once it goes live.',
      },
      {
        heading: 'Scheduling for multiple platforms',
        body: 'If you have posts for different platforms (Instagram, Facebook, LinkedIn), each one is scheduled separately. This lets you post at the optimal time for each platform. Your Director handles the timing differences automatically when you use the /fill command.',
      },
    ],
    tags: ['schedule', 'post', 'time', 'queue', 'publish', 'calendar', 'social media', 'plan'],
    relatedSlugs: ['publishing/content-calendar', 'publishing/auto-fill-calendar', 'publishing/auto-publishing'],
    lastUpdated: '2026-04-07',
  },
  {
    slug: 'content-calendar',
    categorySlug: 'publishing',
    title: 'Your Content Calendar',
    subtitle: 'See everything that is scheduled at a glance',
    body: [
      {
        body: 'Your content calendar shows all your upcoming scheduled posts in one place. It is the easiest way to see what is going out this week, spot gaps in your schedule, and make sure your content mix is balanced.',
      },
      {
        heading: 'Where to find it',
        body: 'You can access your calendar in two ways:',
        steps: [
          'Type /calendar in the chat — your Director will show you a summary of the current week',
          'Go to the Creative Studio (the second tab in your header) and click the Calendar sub-tab for a full visual view',
        ],
      },
      {
        heading: 'Week-at-a-glance',
        body: 'The Creative Studio dashboard includes a "Week at a Glance" section that shows your next seven days of content at the top of the page. This gives you a quick overview without needing to open the full calendar.',
      },
      {
        heading: 'What you see',
        body: 'Each calendar entry shows the platform (Instagram, Facebook, etc.), a preview of the caption, the scheduled date and time, and the current status — draft, scheduled, or published.',
      },
      {
        heading: 'Managing your calendar',
        body: 'From the calendar you can:',
        steps: [
          'Click on any post to view the full content',
          'Edit the caption or timing before it publishes',
          'Delete posts you no longer want',
          'Spot empty days and ask your Director to fill them',
        ],
        tip: 'If you see gaps in your calendar, just type /fill and your Director will generate content to fill the next two weeks.',
      },
    ],
    tags: ['calendar', 'schedule', 'week', 'plan', 'overview', 'studio', 'upcoming', 'content'],
    relatedSlugs: ['publishing/schedule-a-post', 'publishing/auto-fill-calendar', 'publishing/calendar-sync'],
    lastUpdated: '2026-04-07',
  },
  {
    slug: 'auto-fill-calendar',
    categorySlug: 'publishing',
    title: 'Auto-Fill Your Calendar',
    subtitle: 'Generate two weeks of social media posts in one go',
    body: [
      {
        body: 'The /fill command is one of the most powerful shortcuts in NotRealSmart. It tells your Director to create a full two weeks of social media posts, tailored to your brand, audience, and connected platforms.',
      },
      {
        heading: 'How it works',
        body: 'When you type /fill, your Director:',
        steps: [
          'Looks at your brand profile — your voice, audience, and content pillars (the main topics your brand talks about)',
          'Checks which social platforms you have connected',
          'Reviews what you have already scheduled to avoid repeating topics',
          'Creates a balanced mix of content across your platforms',
          'Schedules each post at the optimal time for that platform',
        ],
      },
      {
        heading: 'What you get',
        body: 'You will receive a batch of posts spread across the next 14 days. The mix typically includes educational content, promotional posts, engagement questions, behind-the-scenes ideas, and seasonal or timely topics. Each post is written in your brand voice.',
        tip: 'If you want to guide the content, add context. For example: "/fill — focus on our new summer collection and the upcoming sale" or "/fill — mostly educational content about skin health".',
      },
      {
        heading: 'Reviewing and editing',
        body: 'Auto-filled posts start as drafts. You can review them in your content calendar, approve the ones you like, edit the ones that need tweaking, and remove any that do not feel right. Nothing publishes until it reaches its scheduled time and you have not removed it.',
      },
      {
        heading: 'Running it again',
        body: 'You can use /fill as often as you like. Each time, it takes into account what is already on your calendar so you do not end up with duplicate topics. Many business owners run it every two weeks to keep their calendar full.',
      },
    ],
    tags: ['fill', 'auto', 'calendar', 'generate', 'bulk', 'batch', 'two weeks', 'schedule', 'content'],
    relatedSlugs: ['publishing/content-calendar', 'publishing/schedule-a-post', 'creating-content/write-a-social-post'],
    lastUpdated: '2026-04-07',
  },
  {
    slug: 'auto-publishing',
    categorySlug: 'publishing',
    title: 'How Auto-Publishing Works',
    subtitle: 'Your posts go live automatically — here is what happens behind the scenes',
    body: [
      {
        body: 'Once a post is scheduled and its time arrives, NotRealSmart publishes it to your connected social media accounts automatically. You do not need to be online or do anything — the system handles it for you.',
      },
      {
        heading: 'The publishing cycle',
        body: 'Every five minutes, the system checks your schedule for posts that are due. If a post is ready, it is sent to the connected platform (Facebook, Instagram, LinkedIn, YouTube, or TikTok). The status updates from "scheduled" to "published" so you can see it went through.',
      },
      {
        heading: 'What gets published where',
        body: 'Each scheduled post is linked to a specific platform. If you scheduled an Instagram post, it goes to Instagram. If you have posts for multiple platforms, each one publishes to its own account independently.',
        tip: 'Make sure your social media accounts are connected before scheduling. If a platform is not connected, the post will stay in the queue until you connect it.',
      },
      {
        heading: 'Your brand signature',
        body: 'Every published post includes your brand signature — a small attribution line, mention, or hashtag that you can set up in your brand settings. This ensures consistent branding across all your social media.',
      },
      {
        heading: 'If something goes wrong',
        body: 'Occasionally, a post might fail to publish — for example, if a platform connection has expired or the content does not meet a platform\'s requirements. When this happens, the post stays in your queue and you will see an error status. Ask your Director "Show me any failed posts" to check.',
        warning: 'If you change your social media password or revoke access, the connection may break. Ask your Director for help reconnecting your platforms.',
      },
    ],
    tags: ['publish', 'auto', 'automatic', 'cron', 'mixpost', 'social media', 'live', 'post'],
    relatedSlugs: ['publishing/schedule-a-post', 'getting-started/connecting-your-socials', 'publishing/content-calendar'],
    lastUpdated: '2026-04-07',
  },
  {
    slug: 'calendar-sync',
    categorySlug: 'publishing',
    title: 'Sync to Google or Apple Calendar',
    subtitle: 'See your content schedule alongside your regular calendar',
    body: [
      {
        body: 'You can subscribe to your NotRealSmart content calendar from Google Calendar, Apple Calendar, or any app that supports iCal feeds. This lets you see your upcoming posts alongside your meetings and personal events.',
      },
      {
        heading: 'What you need',
        body: 'To sync your calendar, you need an API key. This is a special code that lets the calendar app access your schedule securely.',
        steps: [
          'Go to your Settings page in NotRealSmart',
          'Find the API Keys section and create a new key',
          'Copy the calendar subscription link that appears — it includes your key automatically',
        ],
      },
      {
        heading: 'Adding to Google Calendar',
        body: 'In Google Calendar:',
        steps: [
          'Click the "+" next to "Other calendars" in the left sidebar',
          'Choose "From URL"',
          'Paste your NotRealSmart calendar link',
          'Click "Add calendar"',
        ],
        tip: 'Google Calendar refreshes external calendars every few hours, so newly scheduled posts may take a little while to appear.',
      },
      {
        heading: 'Adding to Apple Calendar',
        body: 'On your Mac or iPhone:',
        steps: [
          'Open the Calendar app',
          'Go to File > New Calendar Subscription (on Mac) or Settings > Calendar > Accounts > Add Account > Other > Add Subscribed Calendar (on iPhone)',
          'Paste your NotRealSmart calendar link',
          'Choose how often it should refresh',
        ],
      },
      {
        heading: 'What you see',
        body: 'Each scheduled post appears as a calendar event with the platform name and a preview of the caption. Published posts are also shown so you have a complete history of your social media activity.',
      },
    ],
    tags: ['calendar', 'sync', 'google', 'apple', 'ical', 'subscribe', 'feed', 'external', 'integration'],
    relatedSlugs: ['publishing/content-calendar', 'publishing/schedule-a-post', 'publishing/auto-fill-calendar'],
    lastUpdated: '2026-04-07',
  },
]

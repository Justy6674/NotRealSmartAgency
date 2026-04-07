import type { HelpArticle } from '../types'

export const troubleshootingArticles: HelpArticle[] = [
  {
    slug: 'common-issues',
    categorySlug: 'troubleshooting',
    title: 'Common Issues',
    subtitle: 'Quick fixes for the most frequently encountered problems',
    body: [
      {
        heading: 'I got logged out unexpectedly',
        body: 'Sessions expire after a period of inactivity for security. Simply log in again — your conversations, brands, and all data are exactly where you left them. Nothing is lost when you are logged out.',
      },
      {
        heading: 'The page is not loading or looks broken',
        body: 'Try these steps in order:',
        steps: [
          'Refresh the page (Cmd+R on Mac, Ctrl+R on Windows).',
          'Clear your browser cache (Settings > Privacy > Clear browsing data).',
          'Try a different browser (Chrome, Safari, Firefox, or Edge all work).',
          'Check if your internet connection is working by visiting another website.',
        ],
        tip: 'NotRealSmart works best on the latest version of Chrome, Safari, Firefox, or Edge. If you are using an older browser, updating it often fixes display issues.',
      },
      {
        heading: 'My content disappeared',
        body: 'Content is saved per brand. If you switched brands, your content from the other brand is still there — just switch back. All saved outputs are in the Creative Studio under "All Content." If you created content in a conversation but did not save it, it is still in your chat history.',
      },
      {
        heading: 'The Director is not responding',
        body: 'If your Director seems to have stopped mid-response, wait 30 seconds. Complex requests (like audits or meetings) can take a minute or two because multiple agents are working in parallel. If it still has not responded, refresh the page and send your message again.',
      },
      {
        heading: 'Something else is wrong',
        body: 'If none of the above helps, check the other troubleshooting articles for your specific issue. You can also contact support — see the "Getting Help" article for how.',
      },
    ],
    tags: ['common', 'issues', 'problems', 'fix', 'broken', 'logged out', 'not loading', 'disappeared', 'error'],
    relatedSlugs: ['troubleshooting/slow-responses', 'troubleshooting/reconnecting-socials', 'troubleshooting/contact-support'],
    lastUpdated: '2026-04-07',
  },
  {
    slug: 'reconnecting-socials',
    categorySlug: 'troubleshooting',
    title: 'Reconnecting Social Media',
    subtitle: 'What to do when Instagram, Facebook, or LinkedIn disconnects',
    body: [
      {
        heading: 'Why do social accounts disconnect?',
        body: 'Social media platforms (especially Meta, which runs Instagram and Facebook) periodically revoke access tokens for security. This means your connection to NotRealSmart can break even though you did nothing wrong. It is normal and happens to every social media tool, not just ours.',
      },
      {
        heading: 'How to tell if your account is disconnected',
        body: 'You will notice in a few ways:',
        steps: [
          'Scheduled posts fail to publish (you will see a "failed" status in your calendar).',
          'The Creative Studio dashboard shows a social account as "disconnected."',
          'Your Director mentions it cannot reach a platform when trying to publish.',
        ],
      },
      {
        heading: 'How to reconnect',
        body: 'Social media connections are managed through Mixpost, our self-hosted publishing system. To reconnect:',
        steps: [
          'Go to the Creative Studio and check which account is disconnected.',
          'Click the reconnect link or ask your Director "Reconnect my Instagram."',
          'You will be taken to the social platform\'s login page to re-authorise access.',
          'Once logged in and authorised, you will be redirected back — the connection is restored.',
        ],
        tip: 'After reconnecting, try publishing a test post to make sure everything is working. You can delete it straight away.',
      },
      {
        heading: 'Preventing disconnections',
        body: 'Unfortunately, you cannot completely prevent this — it is a security feature of the social platforms. However, you can reduce how often it happens by not changing your social media passwords frequently and keeping your social media apps up to date.',
      },
    ],
    tags: ['reconnect', 'social media', 'instagram', 'facebook', 'linkedin', 'disconnected', 'token', 'mixpost', 'publishing'],
    relatedSlugs: ['troubleshooting/common-issues', 'troubleshooting/contact-support'],
    lastUpdated: '2026-04-07',
  },
  {
    slug: 'slow-responses',
    categorySlug: 'troubleshooting',
    title: 'Slow or Missing Responses',
    subtitle: 'Why the Director sometimes takes longer — and what to do about it',
    body: [
      {
        heading: 'Why some responses take longer',
        body: 'Most messages get a reply within a few seconds. But some requests involve real work behind the scenes. When you ask for a marketing audit, your Director assembles up to six specialist agents who each run their own analysis in parallel. When you ask for a competitor deep scan, the agent visits and analyses an entire website. These things genuinely take time.',
      },
      {
        heading: 'What is normal',
        body: 'Here is a rough guide to expected wait times:',
        steps: [
          'Simple questions and chat — 2 to 5 seconds.',
          'Writing a blog post or social caption — 5 to 15 seconds.',
          'Running a website scan — 10 to 30 seconds.',
          'A full marketing audit (6 departments) — 1 to 3 minutes.',
          'A competitor deep scan — 30 seconds to 2 minutes.',
        ],
      },
      {
        heading: 'If nothing appears at all',
        body: 'If you have been waiting more than 3 minutes with no response:',
        steps: [
          'Check your internet connection.',
          'Refresh the page — your conversation is saved, so you will not lose anything.',
          'Try sending the message again. Sometimes a request can time out if it is especially complex.',
        ],
        tip: 'If a complex request keeps timing out, try breaking it into smaller parts. Instead of "Do a full audit and write me a content plan," try the audit first, then ask for the content plan in a follow-up message.',
      },
      {
        heading: 'Peak times',
        body: 'Like any online service, response times can be slightly slower during peak usage periods. If you notice consistent slowness, it is worth trying again in a few minutes.',
      },
    ],
    tags: ['slow', 'response', 'waiting', 'timeout', 'missing', 'not responding', 'loading', 'speed', 'delay'],
    relatedSlugs: ['troubleshooting/common-issues', 'troubleshooting/contact-support'],
    lastUpdated: '2026-04-07',
  },
  {
    slug: 'contact-support',
    categorySlug: 'troubleshooting',
    title: 'Getting Help',
    subtitle: 'How to reach the team when you need a human',
    body: [
      {
        body: 'While your Director can handle most things, sometimes you need a real person. We are a small Australian team and we genuinely want to help.',
      },
      {
        heading: 'Before contacting support',
        body: 'Try these first — they solve most problems:',
        steps: [
          'Check the help centre articles (you are here!) for your specific issue.',
          'Ask your Director — say "I\'m having a problem with..." and describe the issue. It can often fix things or guide you through a solution.',
          'Refresh the page and try again. Many issues are temporary.',
        ],
      },
      {
        heading: 'How to reach us',
        body: 'You can contact support by emailing support@notrealsmart.com.au. Include as much detail as possible so we can help you quickly.',
      },
      {
        heading: 'What to include in your message',
        body: 'The more context you give us, the faster we can help:',
        steps: [
          'What you were trying to do.',
          'What happened instead (screenshots are very helpful).',
          'Which brand you were working with.',
          'Which browser and device you are using (e.g. "Chrome on MacBook" or "Safari on iPhone").',
          'Any error messages you saw — even if they do not make sense to you.',
        ],
      },
      {
        heading: 'Response times',
        body: 'We aim to respond to all support requests within one business day. For urgent issues (like publishing errors or account access problems), we try to respond within a few hours during Australian business hours (AEST/AEDT).',
        tip: 'For billing questions, include the email address you signed up with so we can find your account quickly.',
      },
    ],
    tags: ['support', 'help', 'contact', 'email', 'human', 'team', 'problem', 'bug', 'report'],
    relatedSlugs: ['troubleshooting/common-issues', 'troubleshooting/slow-responses'],
    lastUpdated: '2026-04-07',
  },
]

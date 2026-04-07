import type { HelpArticle } from '../types'

export const teamAndSharingArticles: HelpArticle[] = [
  {
    slug: 'invite-team-members',
    categorySlug: 'team-and-sharing',
    title: 'Invite Team Members',
    subtitle: 'Give your team access to your marketing agency',
    body: [
      {
        body: 'You can invite other people to access your NotRealSmart agency — colleagues, virtual assistants, business partners, or anyone who helps with your marketing. Each person gets their own login and can chat with the Director on your behalf.',
      },
      {
        heading: 'How to invite someone',
        body: 'Inviting a team member takes just a few steps:',
        steps: [
          'Go to the Team page (under your account menu)',
          'Click "Invite Team Member"',
          'Enter their email address and choose their role (Admin or Viewer)',
          'Optionally, restrict their access to specific brands (if you manage multiple brands)',
          'Click send — they will receive an email with setup instructions',
        ],
        tip: 'The invitation email includes step-by-step instructions for getting started, including how to connect from different devices and AI tools like Claude Desktop and VS Code.',
      },
      {
        heading: 'Per-brand access',
        body: 'If you manage multiple brands, you can restrict a team member to only see and work with specific brands. For example, you might give your social media manager access to your retail brand but not your medical clinic. If you do not restrict access, they can see all your brands.',
      },
      {
        heading: 'What happens when they accept',
        body: 'When your team member clicks the invitation link, they are taken to a signup page. Once they create their account (or log in if they already have one), they automatically join your team with the role you assigned. No extra configuration needed.',
      },
      {
        heading: 'Managing your team',
        body: 'From the Team page, you can see everyone on your team, change their roles, update their brand access, or remove them entirely. Changes take effect immediately.',
      },
    ],
    tags: ['invite', 'team', 'member', 'colleague', 'access', 'share', 'email', 'onboard', 'collaborate', 'add', 'people'],
    relatedSlugs: ['team-and-sharing/roles-and-permissions', 'team-and-sharing/sharing-outputs', 'getting-started/setting-up-your-brand'],
    lastUpdated: '2026-04-07',
  },
  {
    slug: 'roles-and-permissions',
    categorySlug: 'team-and-sharing',
    title: 'Roles & Permissions',
    subtitle: 'Understand what Admins and Viewers can do',
    body: [
      {
        body: 'NotRealSmart has three roles: Owner, Admin, and Viewer. Each one has different levels of access to your agency.',
      },
      {
        heading: 'Owner',
        body: 'That is you — the person who created the account. You have full control over everything: brands, team members, billing, settings, and all content. There is only one owner per account.',
      },
      {
        heading: 'Admin',
        body: 'Admins can do almost everything the owner can:',
        steps: [
          'Chat with the Director and create content',
          'Schedule and publish posts',
          'View and manage the content calendar',
          'Access the Creative Studio and Command Centre',
          'Save and edit outputs in the content library',
          'Upload media and manage brand profiles',
        ],
        tip: 'Admins are ideal for trusted team members who actively manage your marketing — social media managers, marketing coordinators, or business partners. They cannot access billing or payment settings.',
      },
      {
        heading: 'Viewer',
        body: 'Viewers have read-only access:',
        steps: [
          'View existing content, posts, and outputs',
          'See the content calendar and scheduled posts',
          'Read conversation history',
          'They cannot create new content, schedule posts, or change settings',
        ],
      },
      {
        heading: 'Changing someone\'s role',
        body: 'The owner can change any team member\'s role at any time from the Team page. Click on the team member, select the new role, and save. The change takes effect immediately — no need for them to log out and back in.',
      },
    ],
    tags: ['role', 'permission', 'admin', 'viewer', 'owner', 'access', 'security', 'team', 'read only'],
    relatedSlugs: ['team-and-sharing/invite-team-members', 'team-and-sharing/sharing-outputs', 'team-and-sharing/email-reports'],
    lastUpdated: '2026-04-07',
  },
  {
    slug: 'sharing-outputs',
    categorySlug: 'team-and-sharing',
    title: 'Sharing Your Work',
    subtitle: 'Save to your library, send to your team, or export',
    body: [
      {
        body: 'Every substantial piece of content your Director creates — blog posts, social media posts, email campaigns, reports, and more — can be saved, shared, and exported using the action buttons that appear below each message.',
      },
      {
        heading: 'Saving to your library',
        body: 'Click the "Save" button below any message to store it in your content library. Saved outputs appear in the Creative Studio where you can browse, search, and filter them. This is your archive of everything your agency has created.',
        tip: 'Give your saved items descriptive names. Instead of "Blog Post", use "Blog — 5 Tips for Winter Skincare — January 2026". It makes searching much easier later.',
      },
      {
        heading: 'Sending to team members',
        body: 'Use the "Send to..." button to share a piece of content with specific team members. They will receive a notification and can view the content in their own dashboard. This is useful for getting approval on content before publishing.',
      },
      {
        heading: 'Exporting your work',
        body: 'You have several export options:',
        steps: [
          'Copy — copies the content to your clipboard so you can paste it anywhere',
          'Email Me — sends the content to your email address (see "Email Reports to Yourself")',
          'PDF — exports the content as a formatted PDF document',
          'Full View — opens the content in a full-screen view for easier reading',
        ],
      },
      {
        heading: 'The action bar',
        body: 'The action bar appears below every message from your Director that is longer than a few sentences. It includes ten quick actions: Save, Email Me, Send to, Baseline (save as a comparison point), Re-analyse, Todo (create a task), Copy, Remember (tell the agency to remember this), Full View, and PDF.',
      },
    ],
    tags: ['share', 'save', 'export', 'library', 'output', 'copy', 'pdf', 'team', 'send', 'content', 'studio', 'find'],
    relatedSlugs: ['team-and-sharing/email-reports', 'team-and-sharing/invite-team-members', 'team-and-sharing/roles-and-permissions'],
    lastUpdated: '2026-04-07',
  },
  {
    slug: 'email-reports',
    categorySlug: 'team-and-sharing',
    title: 'Email Reports to Yourself',
    subtitle: 'Send any content or report straight to your inbox',
    body: [
      {
        body: 'Sometimes you want a copy of something in your email — a blog post to review on your phone, a report to forward to a colleague, or a content plan to reference later. The "Email Me" button sends any message from your Director directly to your registered email address.',
      },
      {
        heading: 'How to use it',
        body: 'It is a one-click action:',
        steps: [
          'Find the message you want to email',
          'Click the "Email Me" button in the action bar below the message',
          'Check your inbox — the email arrives within a few seconds',
        ],
      },
      {
        heading: 'What you receive',
        body: 'The email includes the full content of the message, formatted for easy reading. It also includes the brand name and the date, so you can quickly find it in your inbox later.',
        tip: 'This is a great way to build a paper trail of your marketing work. Email yourself weekly reports, content calendars, and audit results so you always have a record outside of the platform.',
      },
      {
        heading: 'Sending to others',
        body: 'The "Email Me" button sends to your own email address. If you want to send content to someone else, use the "Send to..." button instead (for team members), or email the report to yourself and forward it.',
      },
      {
        heading: 'Common uses',
        body: 'Business owners most commonly email themselves:',
        steps: [
          'Weekly content calendars to review over coffee',
          'Marketing audit reports to discuss with their team',
          'Blog articles to proofread before publishing',
          'Competitor analysis reports to reference during planning sessions',
          'Monthly analytics summaries for their records',
        ],
      },
    ],
    tags: ['email', 'report', 'send', 'inbox', 'export', 'forward', 'copy', 'self', 'pdf', 'download', 'print'],
    relatedSlugs: ['team-and-sharing/sharing-outputs', 'team-and-sharing/roles-and-permissions', 'team-and-sharing/invite-team-members'],
    lastUpdated: '2026-04-07',
  },
]

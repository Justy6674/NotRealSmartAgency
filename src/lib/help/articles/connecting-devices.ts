import type { HelpArticle } from '../types'

export const connectingDevicesArticles: HelpArticle[] = [
  {
    slug: 'claude-desktop',
    categorySlug: 'connecting-devices',
    title: 'Use From Claude Desktop',
    subtitle: 'Connect your agency to the Claude Desktop app on Mac or Windows',
    body: [
      {
        body: 'You can use your NotRealSmart agency directly inside the Claude Desktop app. This means you can talk to your Director, publish posts, generate images, and run audits without opening a browser.',
      },
      {
        heading: 'How to connect',
        body: 'Claude Desktop uses a secure login flow (like signing into an app with Google). You do not need to copy any passwords or codes.',
        steps: [
          'Open Claude Desktop and go to Settings.',
          'Click "Add custom connector" or "Integrations".',
          'Enter the server URL: https://www.notrealsmart.com.au/api/mcp',
          'A browser window will open asking you to log in to NotRealSmart.',
          'Log in with your usual email and password.',
          'Click "Authorise" to give Claude Desktop access to your agency.',
          'You will be redirected back to Claude Desktop — you are now connected.',
        ],
        tip: 'You only need to do this once. Claude Desktop will remember your connection.',
      },
      {
        heading: 'What you can do',
        body: 'Once connected, you can ask Claude to do anything your Director can do. For example: "Ask my NotRealSmart Director to write a blog post about winter skincare tips for Downscale." Claude will use your agency tools behind the scenes.',
      },
      {
        heading: 'Troubleshooting',
        body: 'If the login window does not appear, make sure you are running the latest version of Claude Desktop. If your connection expires, simply remove the connector in Settings and add it again.',
      },
    ],
    tags: ['claude desktop', 'connect', 'desktop app', 'oauth', 'login', 'mac', 'windows', 'mcp'],
    relatedSlugs: ['connecting-devices/claude-mobile', 'connecting-devices/api-keys'],
    lastUpdated: '2026-04-07',
  },
  {
    slug: 'claude-mobile',
    categorySlug: 'connecting-devices',
    title: 'Use From Claude Mobile',
    subtitle: 'Access your agency from the Claude app on your phone',
    body: [
      {
        body: 'The Claude mobile app (iOS and Android) lets you talk to your Director on the go. You can check reports, approve content, or ask for ideas from anywhere.',
      },
      {
        heading: 'How to connect',
        body: 'The setup is the same secure login flow as the desktop app.',
        steps: [
          'Open the Claude mobile app and go to Settings.',
          'Tap "Add custom connector" or "Integrations".',
          'Enter the server URL: https://www.notrealsmart.com.au/api/mcp',
          'Your phone browser will open the NotRealSmart login page.',
          'Log in with your email and password.',
          'Tap "Authorise" to connect your agency.',
          'You will be taken back to the Claude app — all done.',
        ],
        tip: 'This works well for quick tasks like checking analytics or approving a post while you are away from your desk.',
      },
      {
        heading: 'What works on mobile',
        body: 'Everything your Director can do works on mobile. The most useful things on the go are checking how your posts are performing, approving scheduled content, and brainstorming ideas. Larger tasks like full audits are better done on your computer.',
      },
      {
        heading: 'Staying connected',
        body: 'Your connection stays active until you remove it. If you are logged out of NotRealSmart, you may need to re-authorise — just follow the same steps again.',
      },
    ],
    tags: ['claude mobile', 'phone', 'ios', 'android', 'mobile app', 'connect', 'on the go'],
    relatedSlugs: ['connecting-devices/claude-desktop', 'connecting-devices/api-keys'],
    lastUpdated: '2026-04-07',
  },
  {
    slug: 'vs-code',
    categorySlug: 'connecting-devices',
    title: 'Use From VS Code',
    subtitle: 'Connect your agency to Visual Studio Code with the Cowork extension',
    body: [
      {
        body: 'If you or your developer uses VS Code (a code editor), the Cowork extension lets you talk to your Director right inside the editor. This is handy for teams that build websites or apps alongside their marketing.',
      },
      {
        heading: 'What you need',
        body: 'You will need an API key from your NotRealSmart account. Think of an API key as a special password that lets other apps connect to your agency securely.',
        steps: [
          'Log in to NotRealSmart at notrealsmart.com.au.',
          'Go to Settings (click your profile picture, then Settings).',
          'Find the "API Keys" section and click "Create New Key".',
          'Give it a name like "VS Code" and copy the key. It starts with nrs_sk_ — save it somewhere safe.',
        ],
        warning: 'Your API key is shown only once. If you lose it, you will need to create a new one.',
      },
      {
        heading: 'Setting up VS Code',
        body: 'Once you have your API key, add it to the Cowork extension settings.',
        steps: [
          'Install the Cowork extension from the VS Code marketplace.',
          'Open Cowork settings (Cmd+Shift+P on Mac, Ctrl+Shift+P on Windows, then search "Cowork").',
          'Add a new MCP server with the URL: https://www.notrealsmart.com.au/api/mcp',
          'Paste your API key as the Bearer token.',
          'Save and restart VS Code.',
        ],
      },
      {
        heading: 'Using it',
        body: 'You can now ask Cowork to use your NotRealSmart tools. For example: "Write a blog post for my brand using NotRealSmart" or "Check my social media analytics." The extension handles everything behind the scenes.',
      },
    ],
    tags: ['vs code', 'vscode', 'cowork', 'developer', 'extension', 'api key', 'code editor'],
    relatedSlugs: ['connecting-devices/api-keys', 'connecting-devices/claude-code-terminal'],
    lastUpdated: '2026-04-07',
  },
  {
    slug: 'api-keys',
    categorySlug: 'connecting-devices',
    title: 'API Keys',
    subtitle: 'A password for connecting other apps to your agency',
    body: [
      {
        heading: 'What is an API key?',
        body: 'An API key is like a special password that lets other apps connect to your NotRealSmart agency. You use it when connecting tools like VS Code, Claude Code, or any other app that supports MCP connections. You do not need an API key if you use Claude Desktop or Claude Mobile — those use the login flow instead.',
      },
      {
        heading: 'Creating an API key',
        body: 'You can create as many keys as you need. It is a good idea to create one per app, so you can revoke access to a single app without affecting others.',
        steps: [
          'Log in to NotRealSmart at notrealsmart.com.au.',
          'Go to Settings (click your profile picture, then Settings).',
          'Scroll to the "API Keys" section.',
          'Click "Create New Key".',
          'Give it a descriptive name (e.g. "My laptop Claude Code" or "VS Code at work").',
          'Copy the key immediately — it starts with nrs_sk_ and is only shown once.',
        ],
        warning: 'Treat your API key like a password. Do not share it publicly or paste it into websites you do not trust.',
      },
      {
        heading: 'Revoking a key',
        body: 'If you think a key has been compromised, or you simply do not need it any more, you can revoke it instantly. Go to Settings, find the key in the list, and click "Revoke". Any app using that key will be disconnected immediately.',
      },
      {
        heading: 'How many keys can I have?',
        body: 'There is no limit. Create as many as you need for different apps and devices. Each key works independently, so revoking one does not affect the others.',
      },
    ],
    tags: ['api key', 'password', 'connect', 'security', 'settings', 'revoke', 'nrs_sk'],
    relatedSlugs: ['connecting-devices/vs-code', 'connecting-devices/claude-code-terminal', 'connecting-devices/claude-desktop'],
    lastUpdated: '2026-04-07',
  },
  {
    slug: 'claude-code-terminal',
    categorySlug: 'connecting-devices',
    title: 'Use From the Terminal',
    subtitle: 'Connect your agency to Claude Code for command-line access',
    body: [
      {
        body: 'Claude Code is a command-line tool for developers. If you use the terminal (also called the command line), you can connect your NotRealSmart agency so Claude Code can use your marketing tools directly.',
        tip: 'This article is for technical users. If you are not comfortable with the terminal, use Claude Desktop or the web app instead.',
      },
      {
        heading: 'Get an API key',
        body: 'You will need an API key from your NotRealSmart account.',
        steps: [
          'Log in to NotRealSmart at notrealsmart.com.au.',
          'Go to Settings and create a new API key.',
          'Copy the key (starts with nrs_sk_).',
        ],
      },
      {
        heading: 'Configure the MCP connection',
        body: 'Add your NotRealSmart server to your Claude Code MCP configuration file. The file is usually at ~/.mcp.json in your home directory.',
        steps: [
          'Open ~/.mcp.json in any text editor.',
          'Add an entry for NotRealSmart with the URL https://www.notrealsmart.com.au/api/mcp and your API key as the Bearer token.',
          'Save the file and restart Claude Code.',
        ],
      },
      {
        heading: 'Example configuration',
        body: 'Your MCP config entry should look something like this: a "notrealsmart" key with the server URL and an authorization header containing "Bearer nrs_sk_your_key_here". Check the Claude Code documentation for the exact format, as it may vary between versions.',
      },
      {
        heading: 'Using it',
        body: 'Once configured, you can tell Claude Code to use your NotRealSmart tools. For example: "Use NotRealSmart to write a blog post for Downscale about weight loss tips" or "Check my Downscale analytics via NotRealSmart." Claude Code will call your agency tools automatically.',
      },
    ],
    tags: ['terminal', 'command line', 'claude code', 'cli', 'developer', 'mcp', 'technical', 'config'],
    relatedSlugs: ['connecting-devices/api-keys', 'connecting-devices/vs-code'],
    lastUpdated: '2026-04-07',
  },
]

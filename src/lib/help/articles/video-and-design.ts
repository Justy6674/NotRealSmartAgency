import type { HelpArticle } from '../types'

export const videoAndDesignArticles: HelpArticle[] = [
  {
    slug: 'create-an-ai-video',
    categorySlug: 'video-and-design',
    title: 'Create an AI Video',
    subtitle: 'Generate professional videos with AI avatars — no camera needed',
    body: [
      {
        body: 'Your Director can create videos featuring AI avatars — realistic digital presenters that speak your script on camera. This is perfect for social media content, product explainers, and announcements when you do not have time (or budget) for a traditional video shoot.',
      },
      {
        heading: 'How to ask',
        body: 'Use the /video shortcut or describe what you want:',
        steps: [
          '/video followed by a description — for example, /video a 30-second Instagram Reel about our new service',
          'Or just say "Make me a TikTok video explaining what we do"',
          'Mention the platform, length, and topic for the best results',
        ],
        tip: 'Your Director will write the script first and show it to you for approval before generating the video. You can make changes to the script before it is turned into video.',
      },
      {
        heading: 'What you get',
        body: 'The video generation process creates:',
        steps: [
          'A platform-specific script (TikTok scripts are different from YouTube scripts)',
          'An AI avatar presenting your script on camera',
          'The finished video file, ready to download or publish',
        ],
      },
      {
        heading: 'Choosing an avatar',
        body: 'You can use a pre-built AI avatar or, if you have set up a custom talking photo (see "Make a Photo Talk"), use your own face. The avatar speaks naturally, with lip movements synced to the audio.',
      },
      {
        heading: 'Compliance for healthcare',
        body: 'If your business is in healthcare, video scripts are checked for AHPRA and TGA compliance before generation. Claims, testimonials, and promotional language are reviewed and flagged if needed.',
        warning: 'AI-generated avatars should not be presented as real doctors or patients. Always disclose when content is AI-generated if required by your industry regulations.',
      },
    ],
    tags: ['video', 'ai', 'avatar', 'heygen', 'tiktok', 'reels', 'youtube', 'create', 'generate', 'script'],
    relatedSlugs: ['video-and-design/talking-photos', 'video-and-design/multi-scene-videos', 'video-and-design/upload-and-repurpose'],
    lastUpdated: '2026-04-07',
  },
  {
    slug: 'design-with-canva',
    categorySlug: 'video-and-design',
    title: 'Design Graphics',
    subtitle: 'Create branded graphics using Canva — right from the chat',
    body: [
      {
        body: 'Your Director connects to Canva to create professional graphics for social media, presentations, flyers, and more. You describe what you need, and it handles the design work.',
      },
      {
        heading: 'How to ask',
        body: 'Use the /design shortcut or describe your request:',
        steps: [
          '/design followed by what you need — for example, /design an Instagram story for our weekend sale',
          'Or just say "Design a Facebook cover photo for our clinic"',
          'You can mention colours, style, or mood — "modern and minimalist" or "warm and inviting"',
        ],
      },
      {
        heading: 'Brand kit',
        body: 'If you have set up your brand colours, fonts, and logo in Canva, the designs will automatically use your brand kit. This keeps everything consistent across all your marketing materials without you needing to specify it each time.',
        tip: 'If you have a Canva Pro account, your brand kit is available automatically. Ask your Director "Search my Canva designs" to see what you have already created.',
      },
      {
        heading: 'What you get',
        body: 'Your Director creates the design in Canva and provides:',
        steps: [
          'A thumbnail preview of the design',
          'A link to open and edit the design directly in Canva',
          'The option to export it as PNG, JPG, or PDF',
        ],
      },
      {
        heading: 'Editing your design',
        body: 'The link your Director provides opens the design in Canva where you can make any final adjustments — move elements around, change text, swap images, or resize it for different platforms. You have full control over the final result.',
      },
    ],
    tags: ['design', 'canva', 'graphic', 'image', 'social media', 'brand', 'logo', 'flyer', 'template'],
    relatedSlugs: ['creating-content/ai-images', 'video-and-design/create-an-ai-video', 'your-brand/brand-dna'],
    lastUpdated: '2026-04-07',
  },
  {
    slug: 'upload-and-repurpose',
    categorySlug: 'video-and-design',
    title: 'Upload & Repurpose Video',
    subtitle: 'Turn one video into content for six platforms automatically',
    body: [
      {
        body: 'Got a video from a client testimonial, a webinar, or a behind-the-scenes shoot? Upload it to NotRealSmart and your Director will transcribe it and generate platform-specific captions for six different social media platforms.',
      },
      {
        heading: 'How to upload',
        body: 'You can upload videos in two ways:',
        steps: [
          'Drag and drop your video file into the Media tab in the Creative Studio',
          'Or paste a video directly into the chat input',
        ],
        tip: 'You can upload multiple videos at once. Each one is processed independently.',
      },
      {
        heading: 'What happens after upload',
        body: 'The system automatically:',
        steps: [
          'Transcribes the audio (converts speech to text) using AI',
          'Generates six platform-specific captions — one each for YouTube, TikTok, Instagram, Facebook, LinkedIn, and X (Twitter)',
          'Each caption is written in the style that works best on that platform',
        ],
      },
      {
        heading: 'Repurposing content',
        body: 'You can also ask your Director to repurpose any video into other formats:',
        steps: [
          '/process — transcribe and generate captions for an uploaded video',
          '/repurpose — take existing content and adapt it for different platforms or formats',
          'Or just say "Turn this video into a blog post and 5 social media posts"',
        ],
      },
      {
        heading: 'The content machine',
        body: 'This is the full pipeline: you upload a video, it gets transcribed, captions are generated, and you can schedule them straight to your connected social accounts. One video can give you a week of content across all your platforms.',
      },
    ],
    tags: ['upload', 'video', 'repurpose', 'transcribe', 'caption', 'media', 'content', 'platform', 'audio'],
    relatedSlugs: ['video-and-design/create-an-ai-video', 'publishing/schedule-a-post', 'creating-content/write-a-social-post'],
    lastUpdated: '2026-04-07',
  },
  {
    slug: 'talking-photos',
    categorySlug: 'video-and-design',
    title: 'Make a Photo Talk',
    subtitle: 'Upload a headshot and bring it to life with a script',
    body: [
      {
        body: 'The talking photo feature lets you take a still headshot and animate it so it looks like the person is speaking. This is a quick way to create personal video content using just a photo and a script.',
      },
      {
        heading: 'How it works',
        body: 'The process is simple:',
        steps: [
          'Upload a clear, front-facing headshot photo',
          'Provide a script — what the person should say',
          'The AI animates the face to match the audio, creating a short video',
        ],
        tip: 'Use a high-quality photo with good lighting and a neutral expression. The person should be looking straight at the camera with their face clearly visible.',
      },
      {
        heading: 'When to use it',
        body: 'Talking photos are great for:',
        steps: [
          'Quick social media updates from the business owner',
          'Welcome messages on your website',
          'Personalised greetings for email campaigns',
          'Short announcements when you do not have time to film',
        ],
      },
      {
        heading: 'Creating your talking photo',
        body: 'Ask your Director to set it up: "Upload a talking photo" or "Create a talking photo from this headshot". Once your photo is uploaded and registered, you can reuse it for any future video — just provide a new script each time.',
      },
      {
        heading: 'Quality tips',
        body: 'For the most realistic results:',
        steps: [
          'Use a photo with even, natural lighting — no harsh shadows',
          'Make sure the face is centred and not cropped at the chin or forehead',
          'Avoid photos with sunglasses, hats, or anything covering the face',
          'A plain or simple background works best',
        ],
      },
    ],
    tags: ['talking photo', 'headshot', 'animate', 'face', 'video', 'personal', 'avatar', 'photo'],
    relatedSlugs: ['video-and-design/create-an-ai-video', 'video-and-design/multi-scene-videos', 'creating-content/ai-images'],
    lastUpdated: '2026-04-07',
  },
  {
    slug: 'multi-scene-videos',
    categorySlug: 'video-and-design',
    title: 'Multi-Scene Videos',
    subtitle: 'Create videos with different scenes, backgrounds, and scripts',
    body: [
      {
        body: 'For longer or more complex videos, you can create multi-scene projects. Each scene can have a different background, avatar, and script — giving you the flexibility to tell a story or walk through multiple points.',
      },
      {
        heading: 'When to use multi-scene',
        body: 'Multi-scene videos are ideal for:',
        steps: [
          'Product walkthroughs with different features highlighted in each scene',
          'Tutorial videos that cover multiple steps',
          'Marketing videos that tell a story (problem, solution, result)',
          'Longer YouTube content that needs visual variety',
        ],
      },
      {
        heading: 'How to create one',
        body: 'Ask your Director to build a multi-scene video:',
        steps: [
          'Describe the overall video and mention you want multiple scenes',
          'For example: "Create a 2-minute product demo with 4 scenes — intro, features, testimonials, and call to action"',
          'Your Director will write a script for each scene and show you the breakdown before generating',
        ],
        tip: 'You can review and edit each scene individually before the video is generated. Take a moment to check the scripts — it is much easier to change text than to re-render a video.',
      },
      {
        heading: 'Customising each scene',
        body: 'For each scene, you can specify:',
        steps: [
          'A different background (office, outdoor, studio, or a custom image)',
          'A different avatar or talking photo',
          'The script and pacing for that scene',
          'Transition style between scenes',
        ],
      },
      {
        heading: 'Output',
        body: 'The finished video stitches all scenes together into a single file. You can publish it directly to YouTube, TikTok, Instagram Reels, or any connected platform. It is also saved to your media library for future use.',
      },
    ],
    tags: ['multi-scene', 'video', 'scenes', 'complex', 'long', 'tutorial', 'walkthrough', 'demo', 'story'],
    relatedSlugs: ['video-and-design/create-an-ai-video', 'video-and-design/talking-photos', 'video-and-design/upload-and-repurpose'],
    lastUpdated: '2026-04-07',
  },
]

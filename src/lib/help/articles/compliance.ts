import type { HelpArticle } from '../types'

export const complianceArticles: HelpArticle[] = [
  {
    slug: 'how-compliance-works',
    categorySlug: 'compliance',
    title: 'How Compliance Checking Works',
    subtitle: 'Every piece of content is automatically checked before it goes out',
    body: [
      {
        body: 'NotRealSmart has built-in compliance checking that reviews every piece of content your agents create. If you run a health business in Australia, this is especially important — but it helps any business avoid risky marketing claims.',
      },
      {
        heading: 'What gets checked',
        body: 'Every output — blog posts, social media captions, ad copy, email campaigns, video scripts — is reviewed automatically before it is saved. You do not need to turn anything on or remember to check. It just happens.',
      },
      {
        heading: 'What the checker looks for',
        body: 'The compliance checker scans for issues like:',
        steps: [
          'Health claims that are not supported by evidence.',
          'Testimonials or before-and-after images that could breach AHPRA rules.',
          'Therapeutic claims about products that could breach TGA rules.',
          'Misleading guarantees or promises of outcomes.',
          'Missing disclaimers where they are required.',
        ],
      },
      {
        heading: 'What happens when something is flagged',
        body: 'If the checker finds a problem, it will flag it with a warning. The content is still saved, but the flag tells you what needs attention. Your Director will explain the issue in plain language and suggest how to fix it.',
        tip: 'Compliance flags are there to protect you, not to block you. They are warnings, not hard blocks.',
      },
      {
        heading: 'Not just healthcare',
        body: 'Even if you do not run a health business, the checker catches common issues like misleading claims, unsubstantiated guarantees, and language that could get you in trouble with the ACCC (Australian Competition and Consumer Commission).',
      },
    ],
    tags: ['compliance', 'checking', 'automatic', 'review', 'content', 'safety', 'healthcare', 'flagged'],
    relatedSlugs: ['compliance/ahpra-rules', 'compliance/tga-rules', 'compliance/the-guardian-agent'],
    lastUpdated: '2026-04-07',
  },
  {
    slug: 'ahpra-rules',
    categorySlug: 'compliance',
    title: 'AHPRA Advertising Rules',
    subtitle: 'What health practitioners cannot say in marketing — and why it matters',
    body: [
      {
        heading: 'What is AHPRA?',
        body: 'AHPRA (the Australian Health Practitioner Regulation Agency) regulates how health practitioners advertise their services. If you are a doctor, nurse, physiotherapist, dentist, psychologist, or any registered health practitioner, these rules apply to everything you publish — social media, websites, brochures, and more.',
        warning: 'Penalties for breaching AHPRA advertising rules can be up to $60,000 for individuals and $120,000 for businesses per offence. These are serious fines.',
      },
      {
        heading: 'The big rules',
        body: 'Here are the most important things you cannot do in health advertising:',
        steps: [
          'No testimonials — you cannot use patient reviews, success stories, or "I lost 20kg" quotes in your marketing.',
          'No before-and-after photos — even real ones. These are considered misleading by AHPRA.',
          'No guarantees of outcomes — you cannot say "we will fix your back pain" or "guaranteed results".',
          'No claims of superiority — you cannot say "best clinic in Melbourne" or "number one rated".',
          'No creating unreasonable expectations — keep it realistic and honest.',
        ],
      },
      {
        heading: 'What you can say',
        body: 'You can describe your services, your qualifications, your opening hours, and general information about conditions you treat. You can say things like "we offer physiotherapy for back pain" — just not "we cure back pain."',
        tip: 'When in doubt, describe what you do rather than what will happen. "We provide weight management consultations" is fine. "Lose 10kg in 4 weeks" is not.',
      },
      {
        heading: 'How NotRealSmart helps',
        body: 'Your Director and the Guardian Agent know these rules inside out. When they write content for a health brand, they automatically avoid AHPRA violations. If something borderline slips through, the compliance checker will flag it before it goes live.',
      },
    ],
    tags: ['ahpra', 'health', 'practitioner', 'advertising', 'rules', 'testimonials', 'before after', 'penalties', 'healthcare'],
    relatedSlugs: ['compliance/tga-rules', 'compliance/how-compliance-works', 'compliance/the-guardian-agent'],
    lastUpdated: '2026-04-07',
  },
  {
    slug: 'tga-rules',
    categorySlug: 'compliance',
    title: 'TGA Advertising Rules',
    subtitle: 'What you cannot claim about health products and treatments',
    body: [
      {
        heading: 'What is the TGA?',
        body: 'The TGA (Therapeutic Goods Administration) regulates how therapeutic goods are advertised in Australia. This includes medicines, supplements, skincare with therapeutic claims, medical devices, and more. If your product claims to treat, prevent, or cure a condition, TGA rules apply.',
      },
      {
        heading: 'What counts as a therapeutic claim',
        body: 'A therapeutic claim is anything that says your product treats, prevents, or cures a health condition. Some examples:',
        steps: [
          '"Reduces wrinkles" — this is a therapeutic claim (it claims to change a body function).',
          '"Contains vitamin C for immune support" — this is a therapeutic claim.',
          '"Moisturises skin" — this is generally NOT a therapeutic claim (it describes a cosmetic effect).',
          '"Cures acne" — this is a therapeutic claim and likely a breach.',
        ],
        tip: 'The line between cosmetic and therapeutic can be blurry. If you are unsure, ask your Director — it will tell you which side your claim falls on.',
      },
      {
        heading: 'What you cannot do',
        body: 'Under TGA rules, you cannot make therapeutic claims about a product unless it is listed or registered with the TGA. You also cannot use testimonials for therapeutic goods, reference serious conditions (like cancer or heart disease) in product advertising, or imply your product is a substitute for medical treatment.',
        warning: 'TGA penalties are severe and can include fines, product recalls, and criminal prosecution for serious breaches.',
      },
      {
        heading: 'How NotRealSmart helps',
        body: 'When your brand is flagged as selling products that might fall under TGA rules (skincare, supplements, wellness products), your agents are extra careful with language. The compliance checker specifically looks for unregistered therapeutic claims and will flag them for your review.',
      },
    ],
    tags: ['tga', 'therapeutic', 'goods', 'products', 'skincare', 'supplements', 'claims', 'regulation'],
    relatedSlugs: ['compliance/ahpra-rules', 'compliance/how-compliance-works', 'compliance/the-guardian-agent'],
    lastUpdated: '2026-04-07',
  },
  {
    slug: 'the-guardian-agent',
    categorySlug: 'compliance',
    title: 'The Guardian Agent',
    subtitle: 'Your invisible compliance reviewer that checks every output',
    body: [
      {
        body: 'The Guardian Agent is a specialist AI that reviews every piece of content created by your agency. It works silently in the background — you never need to interact with it directly. Think of it as a compliance officer sitting behind every agent, double-checking their work.',
      },
      {
        heading: 'What it checks',
        body: 'The Guardian reviews content against multiple rules:',
        steps: [
          'AHPRA advertising guidelines (for health practitioner brands).',
          'TGA advertising rules (for brands selling therapeutic products).',
          'Your Brand DNA — the voice, tone, and values you have set for your brand.',
          'General Australian consumer law (misleading claims, false guarantees).',
          'Platform-specific rules (what Instagram, TikTok, or Facebook allow in ads).',
        ],
      },
      {
        heading: 'How it reports issues',
        body: 'When the Guardian finds a problem, it adds a flag to the output. You will see a small warning label on the content. Click it to see what was flagged and why. The Director will also mention compliance issues in conversation if they are significant.',
        tip: 'The Guardian errs on the side of caution. Sometimes it flags things that are borderline. You can always ask the Director "Is this actually a problem?" and get a plain-language explanation.',
      },
      {
        heading: 'Can I override it?',
        body: 'Yes. The Guardian is an adviser, not a gatekeeper. If you believe the content is compliant and the flag is a false alarm, you can proceed. However, for AHPRA and TGA matters, we strongly recommend taking the warnings seriously — the fines are real and substantial.',
        warning: 'Overriding a compliance flag means you take responsibility for the content. NotRealSmart cannot be held liable for content you publish after dismissing a warning.',
      },
    ],
    tags: ['guardian', 'agent', 'compliance', 'reviewer', 'automatic', 'brand dna', 'override', 'flags'],
    relatedSlugs: ['compliance/how-compliance-works', 'compliance/ahpra-rules', 'compliance/tga-rules'],
    lastUpdated: '2026-04-07',
  },
]

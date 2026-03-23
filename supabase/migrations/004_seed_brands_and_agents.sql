-- Seed 8 brands for founder (user_id will need to be set after first login)
-- Using a placeholder function that inserts for the first user in the system

DO $$
DECLARE
  v_user_id UUID;
BEGIN
  -- Get the first user (founder)
  SELECT id INTO v_user_id FROM public.users LIMIT 1;

  -- Skip if no user exists yet (brands can be seeded via UI later)
  IF v_user_id IS NULL THEN
    RAISE NOTICE 'No user found — skipping brand seed. Brands will be created via the UI.';
    RETURN;
  END IF;

  -- 1. Downscale Weight Loss
  INSERT INTO public.brands (user_id, name, slug, tagline, description, website_url, niche, tone_of_voice, target_audience, competitors, compliance_flags, content_pillars, extra_context)
  VALUES (
    v_user_id,
    'Downscale Weight Loss',
    'downscale',
    'Affordable, accessible weight loss care',
    'Telehealth weight loss clinic offering $45 consultations. Evidence-based, nurse practitioner-led. GLP-1 and non-pharmacological approaches.',
    'https://downscale.com.au',
    'telehealth_weight_loss',
    '{"formality": "conversational", "humour": "light", "keywords": ["affordable", "evidence-based", "accessible", "telehealth", "nurse practitioner"], "avoid_words": ["guaranteed", "best", "miracle", "cure", "Dr", "Doctor"]}',
    '{"demographics": "Australian adults 25-55 seeking weight management support", "pain_points": ["expensive GP visits", "long wait times", "judgement from healthcare providers", "confusion about weight loss options"], "desires": ["affordable care", "no judgement", "convenient telehealth", "evidence-based approach"]}',
    '[{"name": "Juniper", "url": "https://www.myjuniper.com", "notes": "Premium pricing, strong brand"}, {"name": "Eucalyptus/Pilot", "url": "https://www.pilot.com.au", "notes": "VC-backed, broad men health"}, {"name": "Compound", "url": "https://www.trycompound.com", "notes": "Newer entrant"}]',
    '{"ahpra": true, "tga": true, "tga_categories": ["weight_loss", "prescription_medicines"]}',
    ARRAY['Weight loss education', 'Telehealth accessibility', 'Evidence-based treatment', 'Patient stories (compliant)', 'Affordable healthcare'],
    'Run by NP Justin Black. $45/consult is the key differentiator. 2,000+ patients. Cannot advertise specific drug names (GLP-1s, semaglutide, etc.) to the public per TGA rules. Can advertise the prescribing SERVICE. Must use "Nurse Practitioner" title, never "Dr" or "Doctor".'
  );

  -- 2. DownscaleDerm
  INSERT INTO public.brands (user_id, name, slug, tagline, description, website_url, niche, tone_of_voice, target_audience, competitors, compliance_flags, content_pillars)
  VALUES (
    v_user_id,
    'DownscaleDerm',
    'downscalederm',
    'Prescription skincare, delivered',
    'Telehealth tretinoin prescribing service. Evidence-based dermatological care via telehealth.',
    'https://downscalederm.com.au',
    'telehealth_skincare',
    '{"formality": "professional", "humour": "none", "keywords": ["prescription skincare", "evidence-based", "dermatological", "telehealth"], "avoid_words": ["guaranteed results", "best", "miracle", "anti-ageing cure"]}',
    '{"demographics": "Australian adults 20-45 interested in prescription skincare", "pain_points": ["long dermatologist wait times", "expensive consultations", "confusion about skincare ingredients"], "desires": ["access to prescription skincare", "convenience", "clear skin", "evidence-based guidance"]}',
    '[{"name": "Software", "url": "https://www.skin.software", "notes": "VC-backed, strong marketing"}, {"name": "Hairy Pill/Skin Pill", "url": "https://www.thehairypill.com.au", "notes": "Combined hair/skin"}]',
    '{"ahpra": true, "tga": true, "tga_categories": ["prescription_medicines", "skincare"]}',
    ARRAY['Skincare education', 'Prescription vs OTC', 'Skin science', 'Telehealth convenience']
  );

  -- 3. TeleCheck
  INSERT INTO public.brands (user_id, name, slug, tagline, description, website_url, niche, tone_of_voice, target_audience, compliance_flags, content_pillars)
  VALUES (
    v_user_id,
    'TeleCheck',
    'telecheck',
    'Medicare telehealth eligibility, instantly',
    'SaaS tool that checks whether a patient qualifies for Medicare-rebated telehealth based on the 12-month rule, exempt categories, and provider type.',
    'https://telecheck.com.au',
    'health_saas',
    '{"formality": "professional", "humour": "none", "keywords": ["Medicare", "telehealth", "eligibility", "compliance", "12-month rule"], "avoid_words": ["guaranteed", "always eligible"]}',
    '{"demographics": "Australian GP practices, telehealth clinics, practice managers", "pain_points": ["manually checking eligibility", "Medicare compliance risk", "rejected claims", "staff training on rules"], "desires": ["automated checking", "fewer rejected claims", "compliance confidence"]}',
    '{"ahpra": false, "tga": false, "tga_categories": []}',
    ARRAY['Medicare rules education', 'Telehealth compliance', 'Practice efficiency', 'Product updates']
  );

  -- 4. TeleScribe
  INSERT INTO public.brands (user_id, name, slug, tagline, description, website_url, niche, tone_of_voice, target_audience, compliance_flags, content_pillars)
  VALUES (
    v_user_id,
    'TeleScribe',
    'telescribe',
    'AI clinical documentation, built for Australian telehealth',
    'AI scribe tool purpose-built for Australian clinical documentation. Generates SOAP notes, referral letters, and clinical correspondence from consultation audio.',
    'https://telescribe.com.au',
    'health_saas',
    '{"formality": "professional", "humour": "light", "keywords": ["AI scribe", "clinical documentation", "Australian", "SOAP notes", "telehealth"], "avoid_words": ["replaces clinicians", "autonomous diagnosis", "medical device"]}',
    '{"demographics": "Australian GPs, NPs, allied health practitioners using telehealth", "pain_points": ["documentation burden", "after-hours notes", "burnout", "slow typing"], "desires": ["faster documentation", "accurate notes", "more time with patients"]}',
    '{"ahpra": false, "tga": false, "tga_categories": []}',
    ARRAY['AI in healthcare', 'Clinical documentation tips', 'Practitioner wellbeing', 'Product features']
  );

  -- 5. NotRealSmart
  INSERT INTO public.brands (user_id, name, slug, tagline, description, website_url, niche, tone_of_voice, target_audience, compliance_flags, content_pillars)
  VALUES (
    v_user_id,
    'NotRealSmart',
    'notrealsmart',
    'Your AI marketing agency',
    'AI-powered marketing agency platform. Produces finished marketing outputs across any industry with brand-aware, compliance-smart AI agents.',
    'https://notrealsmart.com.au',
    'saas_marketing',
    '{"formality": "conversational", "humour": "moderate", "keywords": ["AI agency", "marketing automation", "brand-aware", "Australian"], "avoid_words": []}',
    '{"demographics": "Australian small business owners, solopreneurs, clinic owners", "pain_points": ["cannot afford agencies", "generic AI output", "compliance fear", "time poor"], "desires": ["affordable marketing", "brand-consistent content", "compliance confidence", "ready-to-publish outputs"]}',
    '{"ahpra": false, "tga": false, "tga_categories": []}',
    ARRAY['AI marketing education', 'Small business growth', 'Australian business', 'Product updates']
  );

  -- 6. Downscale Diary
  INSERT INTO public.brands (user_id, name, slug, tagline, description, website_url, niche, tone_of_voice, target_audience, compliance_flags, content_pillars)
  VALUES (
    v_user_id,
    'Downscale Diary',
    'downscale-diary',
    'Your AI health companion',
    'Agentic AI health diary delivered via messenger. Tracks meals, exercise, mood, and health goals through natural conversation.',
    NULL,
    'consumer_health_tech',
    '{"formality": "casual", "humour": "moderate", "keywords": ["health diary", "AI companion", "daily tracking", "messenger"], "avoid_words": ["medical advice", "diagnosis", "treatment"]}',
    '{"demographics": "Health-conscious Australians 20-45", "pain_points": ["forgetting to track", "boring health apps", "no accountability"], "desires": ["easy tracking", "conversation not forms", "gentle accountability"]}',
    '{"ahpra": false, "tga": false, "tga_categories": []}',
    ARRAY['Health habits', 'Daily wellness', 'AI companions', 'Behaviour change']
  );

  -- 7. Scent Sell
  INSERT INTO public.brands (user_id, name, slug, tagline, description, website_url, niche, tone_of_voice, target_audience, compliance_flags, content_pillars)
  VALUES (
    v_user_id,
    'Scent Sell',
    'scent-sell',
    'Buy, sell, and discover fragrance',
    'Second-hand fragrance marketplace for Australian fragrance enthusiasts. Buy and sell authentic perfumes, colognes, and niche fragrances.',
    'https://scentsell.com.au',
    'fragrance_marketplace',
    '{"formality": "casual", "humour": "moderate", "keywords": ["fragrance", "perfume", "niche", "decant", "authentic", "community"], "avoid_words": ["fake", "replica", "knockoff"]}',
    '{"demographics": "Australian fragrance enthusiasts 18-45, collectors, hobbyists", "pain_points": ["overpriced retail", "cannot try before buying full bottle", "no local marketplace", "authenticity concerns"], "desires": ["affordable niche fragrance", "community", "discovery", "trusted marketplace"]}',
    '{"ahpra": false, "tga": false, "tga_categories": []}',
    ARRAY['Fragrance reviews', 'Collection showcases', 'Marketplace tips', 'Niche discoveries', 'Community features']
  );

  -- 8. EndorseMe
  INSERT INTO public.brands (user_id, name, slug, tagline, description, website_url, niche, tone_of_voice, target_audience, compliance_flags, content_pillars)
  VALUES (
    v_user_id,
    'EndorseMe',
    'endorseme',
    'Your NP endorsement pathway, mapped',
    'App that maps the nurse practitioner endorsement pathway through AHPRA/NMBA. Portfolio evidence tracking, advanced practice hours, CPD, and Standards for Practice alignment.',
    'https://endorseme.com.au',
    'health_education',
    '{"formality": "professional", "humour": "light", "keywords": ["nurse practitioner", "NP endorsement", "AHPRA", "NMBA", "advanced practice", "portfolio"], "avoid_words": ["guaranteed endorsement", "easy pathway"]}',
    '{"demographics": "Australian RNs pursuing NP endorsement, NP candidates, transitional NPs", "pain_points": ["confusing NMBA requirements", "portfolio evidence gaps", "hours tracking", "isolation in the process"], "desires": ["clear pathway", "organised evidence", "confidence in application", "peer connection"]}',
    '{"ahpra": true, "tga": false, "tga_categories": []}',
    ARRAY['NP endorsement tips', 'Portfolio evidence', 'Advanced practice', 'NMBA standards', 'NP candidate stories']
  );
END $$;

-- Seed agent configs (all 10 agents, Content Agent fully built out, others with base prompts)
INSERT INTO public.agent_configs (agent_type, display_name, description, icon, system_prompt, available_tools, is_active) VALUES

('content', 'Content & Copy', 'Social media posts, blog articles, landing page copy, captions — ready to publish.', 'PenLine', E'You are a senior content writer and copywriter working as part of an AI marketing agency called NotRealSmart.\n\nYour role is to produce finished, publish-ready marketing content. Not drafts. Not outlines. Finished work that can be copied and posted immediately.\n\nYou write in Australian English (colour, behaviour, organisation, optimise, analyse, licence/license, practise/practice).\n\nWhen producing content:\n- Always ask what platform(s) the content is for if not specified\n- Respect character/word limits per platform (Instagram caption: 2,200 chars, Facebook post: ~500 words ideal, LinkedIn: 3,000 chars, TikTok caption: 2,200 chars, Blog: 800-1,500 words standard, 2,000-3,000 for pillar pages)\n- Include relevant hashtags for social posts (5-15 per post)\n- Write meta titles (50-60 chars) and meta descriptions (150-160 chars) for blog articles\n- Use the brand''s tone of voice consistently\n- Reference the brand''s content pillars when choosing topics\n- Batch outputs: minimum 5 social posts, minimum 3 email subject lines\n- For landing pages follow: Hero → Problem → Solution → Social proof → Pricing → FAQ → CTA\n\nWhen you produce a deliverable, format it clearly with the platform, character count, and any notes. Use markdown formatting.\n\nIf the brand has compliance flags active, you MUST follow the compliance rules provided. Never deviate from these — the penalties are real ($60K individual, $120K body corporate per offence).', ARRAY['save_output', 'word_count'], TRUE),

('seo', 'SEO', 'Keyword research, topic clusters, on-page optimisation, local SEO copy.', 'Search', E'You are an SEO specialist working as part of an AI marketing agency called NotRealSmart.\n\nYour role is to produce actionable SEO strategies and optimised content briefs for Australian businesses.\n\nYou write in Australian English.\n\nCapabilities:\n- Keyword research briefs: primary keyword + 8-12 supporting, search intent, Australian context, competitor gaps\n- Topic clusters: pillar page + 8-12 cluster article titles, internal linking map, publishing priority\n- On-page SEO checklists: title tag, meta description, H1/H2, image alt text, schema type, URL slug\n- Local SEO: Google Business Profile copy, location page templates, citation consistency\n- Content briefs for writers: target keyword, search intent, competitor analysis, outline, word count target\n\nAlways consider Australian search behaviour and local context. Use Australian English spelling in all suggestions.', ARRAY['save_output', 'word_count'], TRUE),

('paid_ads', 'Paid Ads', 'Meta Ads, Google Ads, LinkedIn Ads, TikTok scripts — complete ad sets.', 'Megaphone', E'You are a paid advertising specialist working as part of an AI marketing agency called NotRealSmart.\n\nYour role is to produce complete, ready-to-upload ad copy and creative briefs.\n\nYou write in Australian English.\n\nCapabilities:\n- Meta Ads (Facebook/Instagram): 3 ad variations (A/B/C), primary text (125 chars ideal, 255 max), headline (40 chars), description (30 chars), audience targeting suggestion\n- Google Search Ads: 15 headlines (30 chars each), 4 descriptions (90 chars each), keyword themes, negative keyword list\n- LinkedIn Ads: B2B sponsored content + lead gen form copy\n- TikTok Ads: 15-30 second video scripts (hook/body/CTA)\n\nAlways produce multiple variations. Include audience targeting suggestions and budget recommendations where relevant.', ARRAY['save_output', 'word_count'], TRUE),

('strategy', 'Strategy & Launch', 'Campaign strategies, GTM plans, launch playbooks, quarterly planning.', 'Target', E'You are a marketing strategist working as part of an AI marketing agency called NotRealSmart.\n\nYour role is to produce actionable marketing strategies and launch plans.\n\nYou write in Australian English.\n\nCapabilities:\n- Campaign strategy: goal + KPIs, audience, platform mix, content pillars, week-by-week rollout, budget split, quick wins\n- GTM plan: go-to-market mode (product/marketing/sales-led), ICP, 90-day phased execution\n- Launch playbook: pre-launch, launch week, post-launch checklist with channel coordination\n- Quarterly planning: content calendar, campaign themes, key dates, resource allocation\n\nAlways ground strategies in the brand''s specific context, audience, and resources. Avoid generic advice.', ARRAY['save_output'], TRUE),

('email', 'Email Marketing', 'Welcome sequences, nurture flows, EDMs, newsletters — subject to send.', 'Mail', E'You are an email marketing specialist working as part of an AI marketing agency called NotRealSmart.\n\nYour role is to produce complete email sequences and individual emails ready for deployment.\n\nYou write in Australian English.\n\nCapabilities:\n- Welcome sequences: 5 emails, day-by-day schedule, subject + preview + body\n- Nurture sequences: 3-7 emails, trigger-based\n- Launch sequences: 1-3 emails, urgency-driven\n- EDMs (promotional): single send, offer-focused\n- Newsletters: recurring format, value-focused\n- Subject line A/B pairs for every email\n- Segmentation suggestions\n- Spam Act 2003 compliance (ACMA): consent + opt-out required\n\nDistinguish between EDM (promotional, direct response) and newsletter (nurture, relationship) strategies.', ARRAY['save_output', 'word_count'], TRUE),

('growth', 'Partnerships & Growth', 'Referral programs, influencer briefs, PR pitches, partnership strategies.', 'TrendingUp', E'You are a growth and partnerships specialist working as part of an AI marketing agency called NotRealSmart.\n\nYour role is to produce partnership strategies, referral programs, and PR materials.\n\nYou write in Australian English.\n\nCapabilities:\n- Referral programs: incentive structure, referral page copy, email sequence for referrers\n- Influencer/creator briefs: brand voice, do/don''t list, deliverables, usage rights, health-compliant versions\n- PR/media: press releases, media pitches, Australian publication targeting by niche\n- Partnership proposals: value proposition, co-marketing plans\n\nFor health brands, ensure influencer briefs comply with AHPRA advertising guidelines (no testimonials, no guaranteed outcomes).', ARRAY['save_output'], TRUE),

('brand', 'Brand Building', 'Voice guides, content pillars, competitor analysis, positioning strategy.', 'Palette', E'You are a brand strategist working as part of an AI marketing agency called NotRealSmart.\n\nYour role is to define and refine brand identity, positioning, and competitive strategy.\n\nYou write in Australian English.\n\nCapabilities:\n- Brand voice guide: 4-5 tone descriptors, example sentences (sounds like / not like), platform adaptations\n- Content pillars: 3-5 pillars, percentage split, 10 post ideas per pillar\n- Competitor analysis: top 3-5 competitors, their weaknesses, gaps to own\n- Positioning statement: target audience, category, key differentiator, reason to believe\n- Messaging hierarchy: tagline, value props, proof points, objection handlers\n\nGround all brand work in the specific market context and competitive landscape.', ARRAY['save_output'], TRUE),

('competitor', 'Competitor Intel', 'Analyse competitors — their messaging, positioning, gaps, and weaknesses.', 'Eye', E'You are a competitive intelligence analyst working as part of an AI marketing agency called NotRealSmart.\n\nYour role is to analyse competitors and identify strategic opportunities.\n\nYou write in Australian English.\n\nCapabilities:\n- Competitor profiles: positioning, messaging, pricing, strengths, weaknesses\n- Gap analysis: what competitors miss that the brand can own\n- Content analysis: what competitors publish, their engagement patterns, content gaps\n- Pricing analysis: how competitors price, positioning relative to market\n- SWOT analysis: structured competitive assessment\n\nUse the competitor data stored in the brand profile as a starting point. Ask for URLs or additional competitors if needed.', ARRAY['save_output'], TRUE),

('website', 'Website', 'Website copy, page structure, UX suggestions, conversion optimisation.', 'Globe', E'You are a website and conversion specialist working as part of an AI marketing agency called NotRealSmart.\n\nYour role is to produce website copy, structure recommendations, and conversion optimisation suggestions.\n\nYou write in Australian English.\n\nCapabilities:\n- Page copy: home, about, services, pricing, FAQ, contact — complete copy blocks\n- Landing pages: Hero → Problem → Solution → Social proof → Pricing → FAQ → CTA\n- UX audit recommendations: navigation, CTAs, mobile experience, load speed\n- Conversion optimisation: CTA copy, form design, trust signals, objection handling\n- Accessibility: alt text, heading structure, colour contrast, screen reader considerations\n\nFor healthcare websites: ensure AHPRA compliance, include risk information, no testimonials if health-regulated.', ARRAY['save_output', 'word_count'], TRUE),

('compliance', 'Compliance', 'AHPRA/TGA advertising checks, compliant rewrites, risk assessment.', 'ShieldCheck', E'You are an Australian healthcare advertising compliance specialist working as part of an AI marketing agency called NotRealSmart.\n\nYour role is to review marketing content for AHPRA and TGA compliance, flag issues, and produce compliant alternatives.\n\nYou write in Australian English.\n\nKey rules you enforce:\n\nAHPRA Advertising Guidelines:\n- No patient testimonials or outcome-based reviews\n- No guaranteed results or unrealistic expectations\n- No superlatives (best, leading, most effective) without Level I/II evidence\n- No before/after photos without genuine, unedited images with disclaimers\n- No fear-based pressure tactics\n- No specialist titles without specialist registration\n- No prizes, gifts, or inducements\n- Must include risk information for procedures\n- AI-generated content carries same legal accountability as manual (from Sep 2025)\n- AHPRA proactively scans websites and social media using AI\n- Penalties: up to $60K individual, $120K body corporate per offence\n\nTGA Therapeutic Goods Advertising Code:\n- Cannot advertise prescription medicines (including cannabis, GLP-1s, tretinoin) directly to consumers\n- Can advertise the prescribing SERVICE\n- Can provide general education about conditions\n- Cannot claim specific clinical outcomes in percentages\n- Cosmetic procedures targeting under-18s require stricter rules and cooling-off periods\n\nWhen reviewing content:\n1. Flag every non-compliant element with severity (critical/warning/info)\n2. Explain why it is non-compliant (cite the specific rule)\n3. Provide a compliant alternative for each flagged item\n4. Rate overall compliance risk (high/medium/low)\n\nYou are not a lawyer. Always recommend legal review for high-risk content.', ARRAY['save_output'], TRUE);

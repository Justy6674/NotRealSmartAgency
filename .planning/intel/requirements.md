# Requirements (PRD-class intel)

Extracted from classifications typed `PRD`. Two source documents, both precedence 30.

Both PRDs are research/analysis artefacts. Neither states acceptance criteria; where the source is silent, `acceptance` is marked absent rather than inferred.

---

## REQ-ab-content-testing
- source: 2026-04-12-competitive-analysis-klaviyo-madison.md
- description: A/B content testing — 2 variants, compare performance.
- acceptance: (absent — source lists this as an identified gap, no criteria stated)
- scope: content optimisation, performance measurement

## REQ-auto-monitors
- source: 2026-04-12-competitive-analysis-klaviyo-madison.md
- description: Auto-monitors — proactive alerts on engagement drops.
- acceptance: (absent — source lists this as an identified gap, no criteria stated)
- scope: analytics, proactive alerting

## REQ-reviews-ai
- source: 2026-04-12-competitive-analysis-klaviyo-madison.md
- description: Reviews AI — respond to Google/social reviews.
- acceptance: (absent — source lists this as an identified gap, no criteria stated)
- scope: reputation management, review response

## REQ-multi-armed-bandit-optimisation
- source: 2026-04-12-competitive-analysis-klaviyo-madison.md
- description: Multi-Armed Bandit content optimisation — learn what works per brand. Source names the algorithms to adopt from the Madison framework (MIT, github.com/Humanitariansai/Madison): Multi-Armed Bandit, Thompson sampling, reinforcement learning (Bellman), evidence-based validation (Popper).
- acceptance: (absent — source lists this as an identified gap, no criteria stated)
- scope: content optimisation, per-brand learning

## REQ-synthetic-persona-simulation
- source: 2026-04-12-competitive-analysis-klaviyo-madison.md
- description: Synthetic persona simulation — "would my audience like this?".
- acceptance: (absent — source lists this as an identified gap, no criteria stated)
- scope: pre-publication content validation

## REQ-image-remix
- source: 2026-04-12-competitive-analysis-klaviyo-madison.md
- description: Image remix — AI product photo editing.
- acceptance: (absent — source lists this as an identified gap, no criteria stated)
- scope: media generation, product imagery

## REQ-competitive-scope-exclusions
- source: 2026-04-12-competitive-analysis-klaviyo-madison.md
- description: Explicit non-requirements recorded by the analysis — Klaviyo K:AI features NRS does NOT need: CRM segmentation, CLV prediction, SMS ("different product").
- acceptance: (absent — stated as exclusions, not deliverables)
- scope: scope boundary, non-goals

## REQ-website-to-brand-kit
- source: 2026-04-12-interactive-demo-product-research.md
- description: NRS subscribers give their website URL; NRS auto-scans and extracts brand colours, fonts, voice/tone, key messaging and logo, then generates a brand kit automatically. Proposed build-first architecture: URL → screenshot pipeline (Puppeteer/Playwright captures key pages); brand extraction (Claude vision analyses screenshots for colours/fonts/voice); brand kit generation (auto-populate brand fields from analysis). Existing NRS tools that help: `scan_website`, `browse_page`, `analyse_voice`, `generate_image`.
- acceptance: (absent — source states "Status: Research Phase … Awaiting deep research results on brand extraction tools + video pipeline options")
- scope: onboarding, brand kit generation, website scanning

## REQ-animated-website-showcase
- source: 2026-04-12-interactive-demo-product-research.md
- description: Create an animated showcase video of the subscriber's website that "plays like a video", delivered as a shareable marketing asset (website walkthrough, product demo). Proposed implementation: FFmpeg or Remotion renders screenshots as video with Ken Burns/zoom effects, using the video toolkit at `~/.claude/video-toolkit-tools/`.
- acceptance: (absent — source states "Status: Research Phase")
- scope: video generation, marketing deliverables

## REQ-interactive-product-demo
- source: 2026-04-12-interactive-demo-product-research.md
- description: Interactive demo — click-through widget with hotspot overlays; Director integration so "Create a demo of my product" makes the Director orchestrate the pipeline. Build-first rationale: Arcade Software (arcade.software) is the inspiration but "too expensive for NRS to resell; build our own"; the open-source alternative Propels (github.com/Propels-AI/Propels, AGPL-3.0, 18 stars) is "not mature enough for production".
- acceptance: (absent — source states "Status: Research Phase")
- scope: interactive demo widget, Director orchestration, build-vs-buy

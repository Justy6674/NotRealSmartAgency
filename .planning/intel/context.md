# Context (DOC-class intel)

Extracted from classifications typed `DOC`. Three source documents, all precedence 40 (lowest authority). Recorded verbatim-in-substance with source attribution; where these contradict higher-precedence sources, see `.planning/INGEST-CONFLICTS.md`.

---

## Topic: Product identity and positioning
- source: README.md
- "Your own AI marketing agency. 1 Director + 13 specialist department agents run marketing autonomously across your brands — all through conversation." Tagline: "Not(Artificial) Real(Intelligence) Smart". "Built by a clinician who runs 8 businesses and got sick of paying agencies."

## Topic: Design principle (as published in the README)
- source: README.md
- "The LLM drives tomorrow's complexity. The user just talks. One screen: brands + chat. No forms, no department buttons. The Director handles everything." Conversation-first not form-first; the Director is the only face (14 departments work behind the scenes); auto-fill everything possible (scan website, sync GitHub, guess social handles); minimum clicks to value ("Make me a TikTok video" = script + generation in one flow); the agent should suggest, not wait; each brand learns independently — memory compounds per brand over time.

## Topic: Stack as published
- source: README.md
- Next.js 15.3 + React 19 + Tailwind CSS 4 (oklch colours); Supabase (auth, PostgreSQL + pgvector, RLS, Storage); Vercel AI SDK v6 `streamText` + AI Gateway (Claude Sonnet 4 with fallbacks); Vercel Cron (heartbeat every 15 min) + Fluid Compute (up to 5 min); Stripe (checkout, portal, webhooks); Resend (transactional email); shadcn/ui v4 (base-ui) + IBM Plex Sans + Mono; Zustand + GSAP + Motion.

## Topic: Getting started commands
- source: README.md
- `npm install`; `cp .env.local.example .env.local`; add Supabase, Stripe, Resend and AI Gateway keys to `.env.local`; `npm run dev` (http://localhost:3000). Commands table: `npm run dev` (Turbopack, port 3000), `npm run build` (production build), `npm run lint` (ESLint flat config v9).

## Topic: Browser/server architecture diagram
- source: README.md
- Browser (React 19): Sidebar (Brands, Chats, Add Brand, Settings) | Main content area (Director's Office, Creative Studio, Command Centre; Studio sub-tabs All Content | Calendar | Media | Create) | Chat Panel (Director, inline cards, slash commands, actions bar, `sendToDirector` DOM event). Server: NRS Director (`overall`) using `streamText` + `gateway('anthropic/claude-sonnet-4')`, intent router → routing hints in system prompt, `stepCountIs(5)` max tool loops; AgentWorker per department — 13 independent workers each with own model, own memory namespace (`nrs-{brand}-{dept}`), own tools, own budget, max 4 parallel.

## Topic: Memory System v2 as described in the README
- source: README.md
- onFinish after every chat response: (1) regex extraction (fast, common patterns), (2) LLM extraction (Haiku — structured facts), (3) session memory (Haiku — compounds per brand). Storage: Supabase `agent_memories` + pgvector embeddings. Search: semantic (cosine similarity) + keyword fallback. Dedup: >0.85 similarity = update, not insert. Types: preference, brand_rule, decision, observation, metric. Session: 7-section markdown record that compounds over time. Prompt injection: individual memories ranked by type priority, session memory ("Brand Learning" section), cross-department memories (global namespace).

## Topic: Publishing pipeline as described in the README
- source: README.md
- `/api/cron/publish-posts` every 5 min → Mixpost (self-hosted on VPS, $0/month) covering Facebook Pages, Instagram, LinkedIn, YouTube, and TikTok (sandbox, pending app review). Fallback: Ayrshare API. Webhooks: Mixpost → real-time publishing status updates.

## Topic: System architecture diagram
- source: docs/ARCHITECTURE.md
- Next.js app (notrealsmart.com.au) with a UI layer (React 19 + shadcn/ui v4): chat interface, meeting room, 10-action report bar, task board, agent dashboard, approval queue, cost dashboard, output library, landing pages. API routes: `/api/chat` (streamText streaming), `/api/heartbeat` (Vercel Cron, every 15 min), `/api/email-report` (Resend), `/api/extract-todos` (LLM task extraction), `/api/scan-github-quick`, plus agents/tasks/goals/approvals/audit and brands/conversations/outputs/stripe. Agent layer (AI SDK v6): streamText per-request (NOT ToolLoopAgent), rule-based multi-match intent router, `delegate_to_agent` (single dept), `convene_meeting` (multi-dept), pre-flight budget enforcement, Ruflo memory (per-brand per-dept namespaces), tool registry. Infrastructure: Vercel (AI Gateway + Fluid Compute + Cron; models claude-sonnet-4 → gpt-4.1 → gemini-2.5), Supabase (15 tables + RLS + auth + realtime), Stripe, Resend, Ruflo.

## Topic: Request flow
- source: docs/ARCHITECTURE.md
- User message → `/api/chat` → auth check (Supabase) → brand fetch (RLS) → agent config fetch → budget check (429 if exceeded) → Ruflo memory search injected into prompt → intent router (rule-based, free; single match delegates, multi match convenes a meeting, no match Director handles directly) → streamText via AI Gateway → onFinish (record spend to `agent_registry`, log to `ai_usage` + `audit_log`, extract memories to Ruflo, auto-save outputs to `outputs`).

## Topic: Meeting room mechanics
- source: docs/ARCHITECTURE.md
- When the intent router detects 2+ departments: (1) Director receives a "CONVENE A MEETING" routing advisory, (2) calls `convene_meeting` with brief + department list, (3) each department gets base prompt + brand context + meeting context + compliance rules, (4) all departments run in parallel via `Promise.allSettled`, (5) results collected and each output auto-saved to the library, (6) Director writes a synthesis summary.

## Topic: Database table inventory (as documented)
- source: docs/ARCHITECTURE.md
- 15 tables: `agent_registry` (runtime org chart — role, department, reports_to, budget, status), `agent_configs` (templates — system prompts, tool lists), `agent_memories` (per-brand per-department persistent memory), `tasks` (backlog → assigned → in_progress → done), `goals` (objective → key_result → task), `audit_log` (immutable append-only), `approval_queue`, `heartbeats`, `brands`, `conversations`, `messages`, `outputs`, `project_scans`, `ai_usage`, `users`.

## Topic: Styling reference
- source: docs/ARCHITECTURE.md
- Colours: oklch only; silver/chrome (hue ~240); gold accents (hue ~75). Fonts: IBM Plex Sans (body), IBM Plex Mono (code/terminal). Components: shadcn/ui v4 (base-ui) — `render` prop, NOT `asChild`. Dark mode default; variables in `globals.css`.

## Topic: Marketing-skills adaptation decision
- source: docs/marketing-skills-adaptation.md
- NRS uses public marketing frameworks from Corey Haines `marketingskills` (product marketing context, SEO/AI SEO, schema, site architecture, CRO, analytics, social, bounded marketing loops) and HyperFX `marketing-skills` (persistent brand context, evidence-backed SEO research, analytics workflows, approval-aware MCP execution). "These are adapted as lightweight routing and quality rules in `src/lib/agents/marketing-skills.ts`. NRS does not install Hyper MCP or add a second marketing orchestrator. The NRS Director remains the single orchestrator for the web app, NRS MCP, and Telegram Mini App."

## Topic: Marketing-skills pattern requirements
- source: docs/marketing-skills-adaptation.md
- Every selected pattern must: (1) read the active brand/proforma context before asking repeat questions; (2) use NRS project-scoped tools and the existing department handoff; (3) use observed evidence from scans, connected analytics or approved sources, never invent metrics, customer language or proof; (4) keep external writes, publishing, sending and spend behind NRS approval gates; (5) return clean text and a concrete next action over Telegram and MCP; (6) give recurring work a cadence, trigger, self-check, idempotent state, stop condition, output and kill switch. "The implementation is intentionally source-inspired rather than a wholesale copy: the commercial NRS product owns its data, permissions, MCP surface, and Telegram channel."

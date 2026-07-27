## Conflict Detection Report

Mode: new. Precedence: ADR > SPEC > PRD > DOC, with per-doc manifest overrides (lower integer = higher authority).
Docs consumed: 19 (ADR 2, SPEC 12, PRD 2, DOC 3). Cross-ref cycle detection: run, max depth 2, no cycles.

### BLOCKERS (0)

No blockers. Only one document in the ingest set is LOCKED (`CLAUDE.md`, precedence 0), so no LOCKED-vs-LOCKED contradiction is possible. No classification was `UNKNOWN`, no classification carried `low` confidence, and the cross-reference graph is acyclic.

### WARNINGS (3)

[WARNING] Contradictory Telegram channel state between two equal-precedence SPECs
  Found: docs/superpowers/plans/2026-07-24-nrs-project-boundary-foundation.md (SPEC, precedence 20) states as a global constraint "Telegram webhook stays disabled; no code path may re-enable it", and its execution record confirms "Replaced the Telegram webhook implementation with a fail-closed maintenance response. It creates no jobs, reads no memory and lists no projects."
  Found: docs/superpowers/plans/2026-07-25-telegram-marketing-chief.md (SPEC, precedence 20) states "Keep the existing project-scoped Telegram webhook as the secure edge until an Eve channel reaches parity" and builds seven tasks of intake, evidence, learning and delivery on top of a live webhook.
  Impact: Both documents are precedence 20, so the precedence rule cannot resolve them, and resolving by date would be an arbitrary tiebreaker. Synthesis cannot determine whether the Telegram channel is a disabled surface or the primary marketing interface, which changes whether the Telegram chief work is buildable at all.
  → Decide the Telegram channel state and record it. If Telegram is being re-enabled, mark the foundation plan's Telegram constraint superseded and raise the chief plan's precedence in --manifest; if it stays disabled, gate the chief plan behind the boundary design's acceptance suite and BotFather token rotation.

[WARNING] Two competing Creative Studio room models at equal precedence
  Found: docs/superpowers/specs/2026-04-05-creative-studio-rooms-design.md (SPEC, precedence 10) specifies the Create tab as "a launchpad into 6 full-screen creation workspaces" with routes /agency/studio/{video,design,post,campaign,repurpose} plus an enhanced Calendar tab.
  Found: docs/superpowers/specs/2026-04-08-nrs-complete-architecture-design.md (SPEC, precedence 10) specifies a four-room content pipeline and an explicit tab replacement — "BEFORE: All Content | Calendar | Media | Create | Grid Planner (default: All Content). AFTER: Create | Review | Schedule | Media (default: Create)" — folding Grid Planner into Create, All Content into Command Centre, and Calendar into Schedule.
  Impact: Both are precedence 10 design specs describing the same surface (Creative Studio navigation and creation flow) with incompatible structures — six sibling creation rooms versus a linear Create → Review → Schedule pipeline. Any roadmap built from both would produce contradictory routes, tabs and component ownership. Both models are preserved verbatim in .planning/intel/constraints.md; neither has been selected.
  → Choose one model, or state explicitly that the 6-room design is superseded by the 4-room pipeline, and set the winning spec's precedence in --manifest before routing.

[WARNING] Publishing transport contradicts itself: direct platform APIs versus Mixpost
  Found: CLAUDE.md (ADR, locked, precedence 0) Rule Zero states "Publishing: Direct platform APIs (Meta Graph, YouTube Data, TikTok Content, LinkedIn). No middleware dependencies. CLI agentic pattern — agent calls platform API directly as a tool."
  Found: CLAUDE.md (same locked ADR) also states "Mixpost Self-Hosted Publisher (LIVE) … Cron publisher uses Mixpost first, Ayrshare as fallback", and docs/superpowers/specs/2026-07-24-nrs-project-boundary-design.md (SPEC, precedence 10) states "Mixpost remains the owned publishing bridge."
  Impact: The contradiction is internal to a single locked ADR, so precedence cannot resolve it — a locked document cannot outrank itself. The two statements imply different publishing architectures, different failure modes and a different Rule Zero compliance story ("no middleware dependencies" versus a self-hosted Laravel middleware). Roadmapping either direction silently discards a locked decision.
  → State whether Mixpost is the target transport or an explicitly time-boxed bridge to direct platform APIs, and amend the Rule Zero publishing clause in CLAUDE.md to match before routing.

### INFO (10)

[INFO] Auto-resolved: ADR > SPEC on MCP exposure of publish_to_social and manage_posts
  Note: CLAUDE.md (ADR, locked, precedence 0) lists `publish_to_social` (gated by the mandatory approval rule) and `manage_posts` under "Still exposed on MCP (safe for direct plug-in access)". docs/superpowers/specs/2026-07-24-publishing-and-verification-hardening-design.md (SPEC, precedence 10) requires the opposite — `publish_to_social`, `blotato_publish`, `send_email` and `manage_posts` "stay Director-only by default" and are not registered as direct MCP tools — and its implementation plan (SPEC, precedence 20) marks all tasks complete. Precedence rule applied: a LOCKED ADR wins over a non-locked SPEC, so the ADR's exposure list is the synthesized position. Both statements are preserved verbatim — the ADR list in .planning/intel/decisions.md (ADR-CLAUDE-07) and the hardening allowlist in .planning/intel/constraints.md — because the ADR text predates the hardening decision and reversing the hardening would re-open a direct external publish path.

[INFO] Auto-resolved: SPEC precedence 10 > SPEC precedence 20 on Telegram availability
  Note: docs/superpowers/specs/2026-07-24-nrs-project-boundary-design.md (precedence 10) states "Telegram remains disabled until the entire acceptance suite passes and the BotFather token has been rotated". docs/superpowers/plans/2026-07-25-telegram-marketing-chief.md (precedence 20) assumes an operating webhook. The precedence-10 design wins: Telegram availability is gated on the acceptance suite plus token rotation. This resolves the design-versus-plan axis only; the equal-precedence clash between the two precedence-20 plans is recorded above as a WARNING.

[INFO] Auto-resolved: ADR > DOC on agent roster size
  Note: CLAUDE.md (ADR, locked) specifies 14 agents — 1 Director plus 13 departments, including the `video` (Video & Scripting) department. docs/ARCHITECTURE.md (DOC, precedence 40) is headed "## 13 Agents" and its table omits `video`. ADR wins; .planning/intel/decisions.md records 14 agents. The DOC table is retained verbatim in .planning/intel/context.md as a stale reference.

[INFO] Auto-resolved: ADR > DOC on database table inventory
  Note: CLAUDE.md (ADR, locked) lists 22 tables including `media_items`, `scheduled_posts`, `brand_proforma_sections`, `user_integrations`, `team_members`, `brand_conversation_log` and `api_keys`. docs/ARCHITECTURE.md (DOC, precedence 40) states "Database Tables (15)" and omits all seven. ADR wins.

[INFO] Auto-resolved: ADR > DOC on memory system capability
  Note: CLAUDE.md (ADR, locked) describes the Ruflo memory system with "Known limitations: Keyword search only (no semantic), regex extraction misses ~40-60% of insights, no deduplication, no importance scoring, no memory decay", with mem0 on pgvector as the planned replacement. README.md (DOC, precedence 40) describes a shipped "Memory System v2" with pgvector embeddings, semantic cosine search, Haiku LLM extraction and >0.85 dedup. ADR wins; both descriptions are preserved (decisions.md ADR-CLAUDE-19 and context.md).

[INFO] Auto-resolved: ADR > SPEC on current Creative Studio tab list
  Note: CLAUDE.md (ADR, locked) records the Creative Studio sub-tabs as "All Content (dashboard), Calendar, Media, Create, Grid Planner". docs/superpowers/specs/2026-04-08-nrs-complete-architecture-design.md (SPEC, precedence 10) labels that exact list as the "BEFORE" state and specifies "Create | Review | Schedule | Media" as the target. Treated as current-state versus target-state rather than a contradiction: the ADR wins for what exists today, and the SPEC's target is preserved in .planning/intel/constraints.md. The unresolved question of which target model applies is the Creative Studio WARNING above.

[INFO] Auto-resolved: ADR precedence 0 > ADR precedence 1 on the default model identifier
  Note: CLAUDE.md (locked, precedence 0) states "Default model: `anthropic/claude-sonnet-4`". AGENTS.md (precedence 1, not locked) states "Default model: `anthropic/Codex-sonnet-4`". AGENTS.md is a Codex-facing mirror produced by a global "Claude" → "Codex" substitution, which also corrupted `Codex Haiku`, `Codex vision`, `~/Obsidian/Reference/Codex-architecture.md` and `~/.Codex/projects/…`. CLAUDE.md wins on every such identifier; only the content unique to AGENTS.md (the imported Cowork project rules) is extracted separately in .planning/intel/decisions.md as ADR-AGENTS-01 through ADR-AGENTS-07.

[INFO] AGENTS.md typed ADR by manifest override against heuristic signal
  Note: The classifier for AGENTS.md recorded "Type set by MANIFEST_TYPE=ADR; heuristics/content would read as DOC (guidance prose, no Status/Context/Decision/Consequences). locked=false because no 'Accepted' status field present." The manifest type is authoritative for this run; the entries derived from it are marked `status: proposed`, not locked.

[INFO] Cross-reference graph is acyclic
  Note: Doc-to-doc edges within the ingest set are CLAUDE.md → 2026-04-08-post-creator-redesign.md and AGENTS.md → 2026-04-08-post-creator-redesign.md. All other `cross_refs` entries point at source files, migrations, or paths outside the ingest set (for example `~/Obsidian/Reference/nrs-mcp-architecture.md`) and are not traversed. Maximum depth 2, well under the depth-50 cap. No synthesis loop risk.

[INFO] 62 candidate docs excluded by the ingest manifest
  Note: .planning/ingest-manifest.yaml records that convention discovery found 78 candidate docs against a v1 cap of 50, and excluded `docs/gitbook-export/**` (62 files) as "End-user help-centre content (GitBook export). Describes shipped features for customers rather than encoding planning decisions or requirements." Those docs contributed nothing to this synthesis; if customer-facing feature descriptions are needed downstream they must be re-ingested via an explicit --manifest.

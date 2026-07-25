# NRS marketing-skills adaptation

NRS uses the public marketing frameworks from:

- [Corey Haines marketingskills](https://github.com/coreyhaines31/marketingskills) — product marketing context, SEO/AI SEO, schema, site architecture, CRO, analytics, social, and bounded marketing loops.
- [HyperFX marketing-skills](https://github.com/hyperfx-ai/marketing-skills) — persistent brand context, evidence-backed SEO research, analytics workflows, and approval-aware MCP execution.

## NRS decision

These are adapted as lightweight routing and quality rules in `src/lib/agents/marketing-skills.ts`. NRS does **not** install Hyper MCP or add a second marketing orchestrator. The NRS Director remains the single orchestrator for the web app, NRS MCP, and Telegram Mini App.

Every selected pattern must:

1. Read the active brand/proforma context before asking repeat questions.
2. Use NRS project-scoped tools and the existing department handoff.
3. Use observed evidence from scans, connected analytics, or approved sources; never invent metrics, customer language, or proof.
4. Keep external writes, publishing, sending, and spend behind NRS approval gates.
5. Return clean text and a concrete next action over Telegram and MCP.
6. Give recurring work a cadence, trigger, self-check, idempotent state, stop condition, output, and kill switch.

The implementation is intentionally source-inspired rather than a wholesale copy: the commercial NRS product owns its data, permissions, MCP surface, and Telegram channel.

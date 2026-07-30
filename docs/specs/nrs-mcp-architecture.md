---
created: 2026-04-07
updated: 2026-04-10
tags: [notrealsmart, mcp, architecture, marketing, reference]
project: NotRealSmart
---

# NotRealSmart Agency — MCP Architecture Reference

## Core principle — NRS directs, plug-in AIs don't

**Plug-in AIs never orchestrate. The NRS Director does.**

External AI clients (Claude Desktop, Claude Mobile, Cowork, Claude Code, any MCP client) are **messengers**. They hand the user's intent to `chat_with_director` and wait for a result. They do NOT call multi-step orchestration tools directly, do NOT write marketing copy, do NOT bypass the Review queue.

Enforcement: `src/lib/mcp/server.ts` exports a `HIDDEN_FROM_MCP` set. Tools on that set are **never registered** as MCP tools — they exist only inside the Director's internal AI SDK tool loop. The allowlist is enforced at registration time via `adaptToolsForMCP(..., hiddenFromMcp)`.

## Access Methods

| Method | Who | How | What They Get |
|--------|-----|-----|---------------|
| Web app | Everyone | notrealsmart.com.au → login | Full UI — chat, studio, calendar, media, brands |
| Claude Desktop | Everyone | Settings → Add connector → log in via OAuth 2.0 | Exposed MCP tools in every conversation |
| Claude Mobile | Everyone | Same — Add connector | Same tools from phone |
| Cowork (inside Claude Desktop) | Everyone | OAuth connector shared with Desktop | Same tools while coding |
| Claude Code (terminal) | Devs | `~/.mcp.json` with API key | Same tools from any project directory |
| Any MCP client | Future/technical | API key + MCP URL | Standard MCP protocol |

All methods hit the same backend: same Director, same 14 agents, same brands, same memory, same budget, same audit log.

## MCP Server

- **URL**: `https://www.notrealsmart.com.au/api/mcp`
- **Protocol**: Streamable HTTP, stateless
- **Auth**: Bearer token (API key, `nrs_sk_...`) OR OAuth 2.0 (Claude Desktop/Mobile)
- **Key files**:
  - `src/app/api/mcp/route.ts` — HTTP handler
  - `src/lib/mcp/server.ts` — McpServer factory + HIDDEN_FROM_MCP allowlist
  - `src/lib/mcp/tool-adapter.ts` — `adaptToolsForMCP(...)` with `hiddenFromMcp` filter
  - `src/lib/mcp/director-chat.ts` — chat_with_director (sync entry point, kicks async job)
  - `src/lib/mcp/director-job.ts` — chat_with_director_job (the async Director run)
  - `src/lib/mcp/director-job-tool.ts` — get_director_response (poll)
  - `src/lib/mcp/draft-post-tool.ts` — draft_post (sync Content & Copy shortcut)
  - `src/lib/auth/api-key.ts` — key generation + validation

## Tools exposed on the MCP surface

### Explicitly registered (conversational + orchestration entry points)
- `list_brands` — ALWAYS call first for brand IDs
- `chat_with_director` — async orchestration (returns job_id, poll via get_director_response)
- `get_director_response` — poll for the async job result
- `draft_post` — shortcut: Content & Copy writes a single post, lands in Review queue

### Via `adaptToolsForMCP` (filtered by HIDDEN_FROM_MCP)
Safe for plug-in AIs to call directly — read-only queries or bounded single-shot actions:
- `query_media`, `query_calendar`, `query_outputs`, `query_analytics`, `query_social_analytics`
- `publish_to_social` (gated by MANDATORY APPROVAL rule in Director prompt)
- `manage_posts`, `manage_tags`
- `save_output`
- `generate_image` (bounded single-shot)
- `scan_website`, `browse_page`, `browse_mixpost_media`
- `read_proforma`, `update_proforma`, `brand_glossary`
- `send_email`, `read_gmail`
- `scan_github`, `scan_social`
- `register_webhook`
- `inspiration`, `add_inspiration`, `search_inspiration`
- `create_task`, `request_approval`, `handoff_to_department`
- `text_to_speech` — wait, actually this IS hidden. See HIDDEN_FROM_MCP below.

## `HIDDEN_FROM_MCP` — tools only the Director calls

These tools exist in the Director's internal tool set (so the Director can use them during a delegated task) but are **never** exposed as direct MCP tools. Plug-in AIs that want any of these must call `chat_with_director` with a natural-language request; the Director decides which to call.

```ts
const HIDDEN_FROM_MCP: ReadonlySet<string> = new Set([
  // Media orchestration (multi-step: transcribe + caption + draft)
  'process_media',

  // Content writing — Director MUST author for brand voice + compliance
  'write_blog',
  'write_ads',
  'write_email_campaign',
  'repurpose_content',

  // Multi-step analysis / planning — needs Director reasoning
  'marketing_audit',
  'deep_competitor_scan',
  'fill_calendar',
  'analyse_voice',
  'analyse_content_gaps',

  // Media generation — expensive, multi-step, delegated work
  'create_video',
  'multi_scene_video',
  'generate_video_agent',
  'translate_video',
  'photo_avatar',
  'text_to_speech',
  'generate_slides',

  // Director-internal orchestration primitives — never callable externally
  'delegate_to_agent',
  'convene_meeting',
])
```

### Why these specifically

| Tool | Why hidden | What to call instead |
|---|---|---|
| `process_media` | Transcribe→caption→draft is multi-step; needs shared state with `/api/media/process` | `chat_with_director({message: "Turn media_id X into a week of posts"})` |
| `write_blog` / `write_ads` / `write_email_campaign` / `repurpose_content` | Content writing is the Director's main job — brand voice + AHPRA/TGA compliance | `chat_with_director({message: "Write a blog about X"})` |
| `marketing_audit` / `deep_competitor_scan` / `fill_calendar` | Multi-step reasoning + multi-department delegation | `chat_with_director({message: "Run a full marketing audit"})` |
| `analyse_voice` / `analyse_content_gaps` | Feeds into Director strategy — shouldn't run as standalone one-shot | `chat_with_director({message: "Analyse my brand voice"})` |
| `create_video` / `multi_scene_video` / `translate_video` / `photo_avatar` | Expensive HeyGen calls, requires delegation to Video & Scripting department | `chat_with_director({message: "Make me a 30s TikTok video about X"})` |
| `text_to_speech` / `generate_slides` | Creative assets — Director assigns to Video or Brand dept | `chat_with_director({message: "Turn this into a slide deck"})` |
| `delegate_to_agent` / `convene_meeting` | Director-internal primitives — never meaningful to call from outside | `chat_with_director` is the only correct entry |

## The `quick_start` MCP prompt

Exposed at the top of `src/lib/mcp/server.ts` via `server.registerPrompt('quick_start', ...)`. Tells plug-in AIs the exact policy with concrete before/after examples. Any MCP client that loads the prompt learns:

- "Turn this video into posts" → `chat_with_director` (not `process_media`)
- "Run an audit" → `chat_with_director` (not `marketing_audit`)
- "Write a blog" → `chat_with_director` (not `write_blog`)
- "Make me a TikTok video" → `chat_with_director` (not `create_video`)

## Adding new tools

1. Build the tool in `src/lib/agents/tools/<name>.ts`
2. Register it in `src/lib/agents/tools/index.ts` under the relevant agent types
3. **Decide exposure**:
   - Safe for direct MCP access (query-only, bounded, single-shot)? → do nothing, it's automatically exposed via `adaptToolsForMCP`
   - Needs Director orchestration (multi-step, content writing, delegation)? → add to `HIDDEN_FROM_MCP` in `src/lib/mcp/server.ts`
4. If the tool is Director-only, update `quick_start` prompt with a before/after example so MCP clients know to use `chat_with_director` for it
5. Rebuild — no other changes needed

## Why this matters

Without the allowlist, any plug-in AI could:
- Write its own marketing captions directly via `write_blog` (bypassing Director brand voice + compliance)
- Run expensive HeyGen video generations without user review (`create_video`)
- Run multi-agent meetings unsupervised (`convene_meeting`)
- Silently skip the Review → Approval → Schedule flow the user is relying on

The MANDATORY APPROVAL rule (commit `e7512a8`) forbids publish without explicit in-conversation approval, but it's enforced inside the Director's prompt — plug-in AIs reading the raw tool list could call `publish_to_social` or similar without ever talking to the Director. The allowlist is belt-and-braces: some tools are hidden structurally, not just gated by prompt rules.

## Database

- `api_keys` — hashed API keys, prefix `nrs_sk_`
- `mcp_jobs` — async job queue for chat_with_director background runs (added in migration 030)
- `audit_log` — reused by the `/api/debug/upload-log` route to persist client-side upload breadcrumbs (action='upload_debug')

## Related docs

- [[nrs-media-processing-pipeline]] — the consolidated media pipeline that `process_media` now delegates to
- [[nrs-video-pipeline-architecture]] — publishing a video end-to-end (intent → Mixpost → platform)
- [[nrs-creative-studio-definitive-architecture]] — where these tools get called from inside the app

---
**Related entity:** [[Reference/wiki/entities/notrealsmart|notrealsmart]]

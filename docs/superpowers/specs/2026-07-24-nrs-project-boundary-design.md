# NRS Project-Boundary Design

**Status:** Approved by Justin, 24 July 2026

## Goal

Make NotRealSmart Agency one central marketing platform where every project has
its own protected marketing workspace. Web, MCP and Telegram are only ways to
talk to the same Director; they must never widen the Director's project scope.

## Non-negotiable rules

1. NRS is marketing-only: strategy, social, copy, SEO, ads, approved email
   drafts, website messaging, aggregate marketing analytics and publishing.
2. A request receives one server-enforced project scope before any prompt,
   memory, tool, job, output or connector query occurs.
3. Project context is private by default. The Director does not receive
   sibling projects, owner-wide work context or agency-wide memory by default.
4. Cross-project work is possible only through an explicit, auditable project
   link that records both projects, purpose, allowed marketing data and expiry.
5. Patient, clinical, personal, customer, confidential operational and private
   lab data is rejected at the channel boundary. The raw rejected content is
   not written to prompts, jobs, memories or audit details.
6. Publishing, sending and any other external side effect remains approval
   gated. Approval never grants access beyond the current project scope.
7. Telegram remains disabled until the entire acceptance suite passes and the
   BotFather token has been rotated.

## Architecture

```text
Web / MCP / Telegram
  -> identity and channel grant
  -> ExecutionScope(actor, project, channel, capabilities, approvedLinks)
  -> data-boundary gate
  -> scoped Director
  -> project-only memory, proforma, assets, outputs, connectors and analytics
  -> Review / explicit approval / publisher
```

`ExecutionScope` is a typed server-side value. It is passed to every service
and repository. A client-supplied `brand_id` is only a requested project; it
is accepted only when the verified grant permits it.

## Channel behaviour

### Web

The signed-in workspace may list projects that the user is authorised to see.
Once a project is opened, every Director run is project-scoped. Team members
only see their granted projects.

### MCP

Each API key and OAuth grant has an explicit list of permitted project IDs and
capabilities. `list_projects` returns only those projects. A key may be limited
to one project. The Director receives a project scope, never an owner-wide
identity alone.

### Telegram

Telegram is an NRS channel adapter, not an alternative marketing system.
Channel pairing produces project grants. A generic NRS Telegram account can
choose only permitted projects; a project-specific bot is configured with one
fixed project grant. Channel state belongs in dedicated channel-session rows,
not agent memory. Telegram never returns raw job records or unscreened model
output.

## Project connectors

Each project may register one or more marketing connectors. A connector
declares source, credentials reference, allowed data classes, read/write mode,
freshness, provenance and health. The initial allowed classes are public
website facts, approved product/catalogue facts, approved assets, connected
social account metadata and aggregate marketing performance.

Examples:

- Downscale and Do Today: public positioning, approved marketing material and
  aggregate campaign performance only. Never Halaxy, patient accounts, chats,
  health logs, appointment data or clinic recipient lists.
- Scent Sell: approved public product/listing data and marketing assets only.
- Underground Parfums: approved public product/launch material and marketing
  analytics only. Never formulae, bench stock, costs, unreleased work or lab
  records.

Mixpost remains the owned publishing bridge. Any external distribution adapter
is bounded by the same connector contract and is never NRS's source of truth.

## Data model changes requiring a separate migration approval

- `api_keys`: scopes, capabilities, expiry and policy version.
- `project_access_grants`: actor-to-project grants for MCP and channels.
- `project_links`: explicit cross-project links with purpose, permitted data
  classes, approval record and expiry.
- `project_connectors`: marketing source contracts and health state.
- `channel_accounts` and `channel_sessions`: verified Telegram pairing and
  non-memory project selection.
- `execution_audit`: redacted policy decisions, scope ID and output class.
- Project-bound memory metadata or a dedicated memory table keyed by project ID.

## Immediate safe foundation

Before that migration, remove owner-wide and global context from the Director's
default prompt path, introduce typed scope and a deterministic inbound
data-boundary gate, and add proof tests. This improves the existing web/MCP
path without reopening Telegram or pretending key scopes already exist.

## Acceptance evidence

- A sentinel stored for Do Today cannot appear in Downscale or Scent Sell
  prompts, outputs, tools or Telegram replies.
- A standard MCP key restricted to Downscale cannot enumerate or invoke any
  other project.
- An explicit approved link can expose only its declared marketing facts.
- Patient/clinical/PII input is rejected before a job or memory is created.
- A Telegram project-specific channel cannot display a project picker or use a
  non-fixed project. A generic NRS channel lists only the paired grants.
- Publishing is impossible without a current-project approval.
- The production proof uses seeded, synthetic sentinel text only; no patient
  or real confidential data is used.

# NRS Project-Boundary Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove default cross-project Director context and create an independently tested foundation for project-scoped marketing work before any Telegram restoration.

**Architecture:** Introduce a small `ExecutionScope` value and use it to build prompts without owner-wide context or agency-global memory. A deterministic boundary gate rejects prohibited health/personal data before a channel can enqueue work. The database migration for grants, connector contracts and Telegram sessions is intentionally deferred for explicit live-schema approval.

**Tech Stack:** Next.js 15, TypeScript, Node test runner, Supabase, Vercel AI SDK.

## Global Constraints

- Telegram webhook stays disabled; no code path may re-enable it.
- NRS stays marketing-only and uses no patient, clinical, personal, customer, private operational or private lab input.
- Scope enforcement is code, not a prompt instruction.
- No live schema migration is applied in this plan.
- Every new behaviour starts with a failing Node test.

---

### Task 1: Establish a typed execution scope

**Files:**
- Create: `src/lib/security/execution-scope.ts`
- Create: `src/lib/security/execution-scope.test.ts`

**Interfaces:**
- Produces `ExecutionScope`, `createExecutionScope()` and `assertProjectScope()`.
- Consumed by Director, MCP and Telegram work in later plans.

- [ ] **Step 1: Write the failing test**

```ts
import test from 'node:test'
import assert from 'node:assert/strict'
import { assertProjectScope, createExecutionScope } from './execution-scope.ts'

test('scope permits its selected project only', () => {
  const scope = createExecutionScope({ actorId: 'user-1', projectId: 'downscale', channel: 'mcp' })
  assert.doesNotThrow(() => assertProjectScope(scope, 'downscale'))
  assert.throws(() => assertProjectScope(scope, 'scent-sell'), /outside the active project scope/)
})
```

- [ ] **Step 2: Run the test and verify it fails because the module is absent**

Run: `node --experimental-default-type=module --test src/lib/security/execution-scope.test.ts`

- [ ] **Step 3: Implement the minimal immutable scope API**

```ts
export type ExecutionChannel = 'web' | 'mcp' | 'telegram' | 'internal'
export interface ExecutionScope { actorId: string; projectId: string; channel: ExecutionChannel; capabilities: readonly string[] }
export function createExecutionScope(input: Omit<ExecutionScope, 'capabilities'> & { capabilities?: readonly string[] }): ExecutionScope { return Object.freeze({ ...input, capabilities: Object.freeze([...(input.capabilities ?? [])]) }) }
export function assertProjectScope(scope: ExecutionScope, projectId: string): void { if (scope.projectId !== projectId) throw new Error('Requested project is outside the active project scope.') }
```

- [ ] **Step 4: Run the test and verify it passes**

Run: `node --experimental-default-type=module --test src/lib/security/execution-scope.test.ts`

### Task 2: Block prohibited inbound data before Director work

**Files:**
- Create: `src/lib/security/marketing-data-boundary.ts`
- Create: `src/lib/security/marketing-data-boundary.test.ts`

**Interfaces:**
- Produces `inspectMarketingInput(input): { allowed: true } | { allowed: false; reason: string }`.
- Consumed by MCP, Telegram and web request handlers in the next implementation plan.

- [ ] **Step 1: Write the failing tests**

```ts
test('allows a normal social request', () => {
  assert.deepEqual(inspectMarketingInput('Draft a winter Instagram post'), { allowed: true })
})

test('blocks patient-identifying clinical input', () => {
  const result = inspectMarketingInput('Patient Jane Smith, DOB 1 January 1980, is taking semaglutide')
  assert.equal(result.allowed, false)
})
```

- [ ] **Step 2: Run the test and verify it fails because the module is absent**

Run: `node --experimental-default-type=module --test src/lib/security/marketing-data-boundary.test.ts`

- [ ] **Step 3: Implement deterministic conservative detection**

```ts
const PROHIBITED = [/\bpatient\b/i, /\bdob\b|date of birth/i, /\bmedication\b|\bdiagnosis\b|\bclinical note\b/i, /\bappointment\b/i, /\bemail\b.*@|@.*\b(?:com|com\.au)\b/i]
export function inspectMarketingInput(input: string) { return PROHIBITED.some((rule) => rule.test(input)) ? { allowed: false as const, reason: 'Use the approved secure system for patient, clinical or personal information.' } : { allowed: true as const } }
```

- [ ] **Step 4: Run the test and verify it passes**

Run: `node --experimental-default-type=module --test src/lib/security/marketing-data-boundary.test.ts`

### Task 3: Make Director prompt construction project-only by default

**Files:**
- Modify: `src/lib/agents/prompt-builder.ts`
- Modify: `src/lib/agents/prompt-builder.test.ts`
- Modify: `src/app/api/chat/route.ts`
- Modify: `src/lib/mcp/director-job.ts`

**Interfaces:**
- `buildSystemPromptWithMemory()` accepts an explicit scope object.
- Default Director retrieval reads only its brand and department namespaces.

- [ ] **Step 1: Add a failing sentinel-isolation test**

```ts
test('Director prompt excludes sibling portfolio and global-memory context by default', async () => {
  const prompt = buildSystemPrompt(brand, director, null, [], null)
  assert.doesNotMatch(prompt, /Brand Ecosystem/)
  assert.doesNotMatch(prompt, /Scent Sell sentinel/)
})
```

- [ ] **Step 2: Run the prompt test and verify the existing cross-project behaviour fails it**

Run: `node --experimental-default-type=module --test src/lib/agents/prompt-builder.test.ts`

- [ ] **Step 3: Implement the smallest safe change**

```ts
// Do not fetch sibling brands or users.work_context in normal Director paths.
// Do not query getGlobalNamespace() for any ordinary project scope.
// Query only getNamespace(brand.slug, agentType) and getBrandNamespace(brand.slug).
```

- [ ] **Step 4: Run all prompt and MCP unit tests**

Run: `npm test`

### Task 4: Keep Telegram contained while the scoped-channel migration is pending

**Files:**
- Modify: `src/app/api/webhooks/telegram/route.ts`
- Modify: `src/lib/telegram/telegram-selection.ts`
- Modify: `src/lib/telegram/telegram-selection.test.ts`

**Interfaces:**
- Telegram receives no marketing request until a future `channel_session` grant exists.
- Existing legacy selection stored in `agent_memories` is not read or written.

- [ ] **Step 1: Add a failing route/helper test for legacy selection refusal**

```ts
test('legacy Telegram selection memory is never a valid project grant', () => {
  assert.equal(isLegacySelectionAuthoritative(), false)
})
```

- [ ] **Step 2: Verify the test fails, then implement a maintenance response**

```ts
export const TELEGRAM_CHANNEL_STATUS = 'disabled_pending_scoped_channel_migration'
```

The route returns a generic maintenance acknowledgement and creates no `mcp_jobs` row while the webhook is disabled. It must not list brands or expose a project picker.

- [ ] **Step 3: Run Telegram tests**

Run: `npm test`

### Task 5: Verify, document and commit the foundation

**Files:**
- Modify: `docs/superpowers/specs/2026-07-24-nrs-project-boundary-design.md`
- Modify: `docs/superpowers/plans/2026-07-24-nrs-project-boundary-foundation.md`

- [ ] **Step 1: Run full verification**

Run: `npm test && npm run lint && npm run build`

- [ ] **Step 2: Confirm the results against the acceptance evidence**

Record only the commands, exit codes and synthetic test names; never include real patient or private project content.

- [ ] **Step 3: Commit only the foundation files**

```bash
git add src/lib/security src/lib/agents/prompt-builder.ts src/lib/agents/prompt-builder.test.ts src/app/api/chat/route.ts src/lib/mcp/director-job.ts src/app/api/webhooks/telegram/route.ts src/lib/telegram/telegram-selection.ts src/lib/telegram/telegram-selection.test.ts docs/superpowers
git commit -m "feat: establish NRS project-boundary foundation"
```

## Deferred plan: schema-backed access and connectors

The next plan begins only after explicit approval of a live Supabase migration. It creates project grants, project-scoped API keys/OAuth, explicit project links, connector contracts, channel sessions and redacted execution audit. It then rebuilds MCP and Telegram on those structures and runs synthetic cross-project proof tests before enabling Telegram.

## Plan self-review

- Scope coverage: prompt/memory contamination, inbound data boundary and Telegram containment are covered now; database grants/connectors are explicitly deferred because they require a live schema migration.
- No placeholders: every foundation task names its files, interfaces, test command and expected boundary.
- Type consistency: `ExecutionScope` is the single cross-channel scope contract introduced in Task 1.

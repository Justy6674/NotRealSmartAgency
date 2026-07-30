# Testing Patterns

**Analysis Date:** 2026-07-30

## Test Framework

**Runner:**
- **Node's built-in test runner** (`node:test`) driven through `tsx`. No Jest, no Vitest, no Mocha.
- Defined in `package.json`: `"test": "tsx --test $(find src -name '*.test.ts' -print)"`
- No config file. `tsconfig.json` does the heavy lifting: `allowImportingTsExtensions: true` is what lets tests write `import { x } from './module.ts'`.

**Assertion Library:**
- `node:assert/strict` — `assert.equal`, `assert.deepEqual`, `assert.ok`, `assert.match`, `assert.doesNotMatch`, `assert.throws`, `assert.doesNotThrow`. Nothing else.

**Run Commands:**
```bash
npm test              # Run all tests (TAP output, ~1.3s)
npm run lint          # ESLint — must be 0 errors
npm run build         # Production build — must pass before claiming done
npx tsx --test src/lib/telegram/telegram-thread.test.ts   # Run one file
```

There is **no watch mode and no coverage command**. `coverage/` is in the ESLint ignore list but nothing generates it.

## Current Pass/Fail State (verified 2026-07-30)

```
1..157
# tests 157
# suites 0
# pass 156
# fail 1
# duration_ms 1330.986958
```

**52 test files, 157 tests, 1 failing.**

### The known pre-existing failure — `brand-portfolio.test.ts`

```
not ok 19 - Scent Sell portfolio is the fragrance marketplace, not seggs.life
  location: 'src/lib/agents/knowledge/brand-portfolio.test.ts:2:957'
  operator: 'doesNotMatch'
  stack: TestContext.<anonymous> (src/lib/agents/knowledge/brand-portfolio.test.ts:10:10)
```

**Cause — the test contradicts the copy it guards.** `src/lib/agents/knowledge/brand-portfolio.test.ts:10` asserts:

```ts
assert.doesNotMatch(context!, /seggs\.life/i)
```

but the Scent Sell brand context in `src/lib/agents/knowledge/brand-portfolio.ts` deliberately contains the string as a **negative disambiguation** for the model:

> `- **Product**: Australian second-hand fragrance marketplace … NOT an intimacy app. NOT seggs.life.`

The prose is doing exactly the job the test intends (stopping the Director from confusing Scent Sell with seggs.life); the assertion is just too blunt to tell "mentions X" from "says it is not X". The companion assertion on line 11 (`doesNotMatch(/Erotic Blueprint/i)`) passes, so only the one line is wrong.

**Fix when touched:** narrow the assertion to catch a *positive* claim rather than any mention — e.g. assert the context matches `/NOT seggs\.life/i` and does not match `/(?<!NOT )\bseggs\.life\b/i` — or drop line 10 and rely on line 8's `assert.match(context!, /fragrance marketplace/i)` plus line 11. Do **not** fix it by deleting the "NOT seggs.life" line from the brand context; that copy is load-bearing for the model.

Treat 156/157 as the current green baseline. Any new failure is yours.

## Test File Organisation

**Location:** co-located with the module under test. `src/lib/mixpost/brand-mapping.test.ts` sits beside `src/lib/mixpost/brand-mapping.ts`. There is no `__tests__/`, no `tests/` directory.

**Naming:** `<module>.test.ts`. `.test.tsx` is not used (no component tests exist).

**Distribution across the tree:**

```
src/lib/telegram/          12    src/lib/agents/knowledge/   2
src/lib/mcp/                7    src/lib/abeai/              2
src/lib/agents/             7    src/lib/webhooks/           1
src/lib/security/           5    src/lib/pico/               1
src/lib/agents/tools/       4    src/lib/mixpost/            1
src/lib/github/             3    src/lib/discovery/          1
src/lib/memory/             2    src/lib/auth/               1
                                 src/lib/ai/                 1
src/app/api/webhooks/telegram/  1
src/app/api/heartbeat/          1
```

The concentration is deliberate: tests cluster where a regression is expensive and invisible — Telegram/MCP contracts, execution scope, project-access boundaries, brand mapping.

## Test Structure

**No `describe` blocks anywhere** (0 files use them). Flat top-level `test()` calls with a **full-sentence behavioural name**:

```ts
import assert from 'node:assert/strict'
import test from 'node:test'
import { assertProjectScope, createExecutionScope } from './execution-scope.ts'

test('scope permits its active project only', () => {
  const scope = createExecutionScope({ actorId: 'user-1', projectId: 'downscale', channel: 'mcp' })

  assert.doesNotThrow(() => assertProjectScope(scope, 'downscale'))
  assert.throws(() => assertProjectScope(scope, 'scent-sell'), /outside the active project scope/)
})
```
(`src/lib/security/execution-scope.test.ts`)

**Patterns:**
- Names describe behaviour and the rule being protected, not the function: *"an aliased account is not reassigned when its brand is retired"*, *"only active MCP project grants become an authenticated MCP principal"*, *"a Telegram website scan is performed before the Director writes its response"*.
- No `beforeEach`/`afterEach` — 27 of the local imports pull pure functions, so each test builds its own inputs inline.
- Small local builder helpers instead of fixture files:
  ```ts
  function account(id: number, name: string, provider: string, username: string | null = null): MixpostAccount {
    return { id, name, username, provider, media_url: null }
  }
  const DOWNSCALE = { id: 'brand-downscale', name: 'Downscale Weight Loss', slug: 'downscale' }
  ```
  (`src/lib/mixpost/brand-mapping.test.ts:6-10`)
- Tests carry *why* comments explaining the real-world failure being prevented:
  ```ts
  // DownscaleDerm is deactivated, so only the weight loss clinic is active.
  // … publishing a weight loss post to the skincare accounts is a cross-brand leak.
  ```

## Two Test Styles

### 1. Pure-function unit tests (40 files)

Import the real function, feed it plain data, assert on the return. Works because the logic that matters was deliberately extracted into pure modules: `mapMixpostAccountsToBrands`, `toScopedMcpPrincipal`, `createExecutionScope`, `getBrandPortfolioContext`, `verifyMixpostSignature`.

```ts
import { toScopedMcpPrincipal } from './api-key.ts'

test('only active MCP project grants become an authenticated MCP principal', () => {
  const principal = toScopedMcpPrincipal({ id: 'key-1', user_id: 'user-1' }, [ /* grant rows */ ])
  assert.deepEqual(principal, { /* … */ })
})
```
(`src/lib/auth/api-key.test.ts`)

Note the import specifier: **`'./api-key.ts'` with the extension**, not `@/lib/auth/api-key`. Only 2 test imports use the `@/` alias; 27 use relative-with-extension. `tsx --test` resolves relative paths without the Next.js path-alias plugin, so **use `./module.ts` in tests**.

### 2. Source-text contract tests (12 files)

Where behaviour lives in code that cannot be called without a live Supabase/LLM (`director-job.ts`, the heartbeat route, migration SQL), the test reads the **source file as a string** and asserts the wiring is present:

```ts
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

test('a Telegram website scan is performed before the Director writes its response', () => {
  const source = readFileSync(resolve(process.cwd(), 'src/lib/mcp/director-job.ts'), 'utf8')

  assert.match(source, /isWebsiteScanRequest\(message\)/)
  assert.match(source, /scanWebsiteCore\(supabase, userId, brand_id, websiteUrl, 'messaging', jobId\)/)
  assert.match(source, /websiteScanDirective \? null : buildRoutingContext/)
  assert.match(source, /buildWebsiteScanGroundingDirective\(websiteScan\)/)
})
```
(`src/lib/mcp/director-job-website-scan.test.ts`)

Files using this style: `src/app/api/heartbeat/goal-review-enforcement.test.ts`, `src/app/api/webhooks/telegram/route-scope.test.ts`, `src/lib/memory/store-scope.test.ts`, `src/lib/security/project-scope-migration.test.ts`, `src/lib/security/github-app-connector-migration.test.ts`, `src/lib/agents/goal-loop-migration.test.ts`, `src/lib/agents/heygen-removal.test.ts`, `src/lib/mcp/director-job-website-scan.test.ts`, `src/lib/mcp/director-job-telegram-response-quality.test.ts`, `src/lib/mcp/director-job-telegram-contract.test.ts`, `src/lib/mcp/director-job-founder-learning.test.ts`, `src/lib/mcp/mcp-scope-wiring.test.ts`.

**Trade-off, know it before adding one:** these tests are brittle against refactors (renaming a variable breaks them) and prove wiring exists, not that it works. They are the right tool for "this safety property must not silently disappear" — scope enforcement, grounding-before-answering, a removed integration staying removed. They are the wrong tool for logic you can extract and call directly. **Prefer extracting a pure function and writing a style-1 test; reach for style 2 only when the call site is genuinely untestable in isolation.**

## Mocking

**There is none.** Zero uses of `node:test`'s `mock.*`, zero test doubles, zero fake Supabase clients (`grep` for `SupabaseClient`/`createClient` in `*.test.ts` returns nothing).

**What to mock:** nothing — the codebase avoids the need by extracting pure logic. If a function needs a Supabase client to be tested, that is the signal to split the decision logic out of the I/O.

**What NOT to mock:** Supabase, the AI SDK, Mixpost, Anthropic. No test hits a network or a database, and none should start.

## Fixtures and Factories

No fixture files, no factory library, no `__fixtures__` directory. Test data is defined inline in the file that uses it, either as a `const` or a tiny local builder function (see `account()` above). Keep it that way — inline data makes each test readable on its own.

## Coverage

**No coverage target and no coverage tooling.** `coverage/` is ESLint-ignored but nothing writes to it.

Rough shape of what is and isn't covered:

**Covered (the risk-weighted core):**
- Security & scope — `src/lib/security/` (5 files): execution scope, project access, marketing-data boundary, two migration contracts.
- Telegram channel — `src/lib/telegram/` (12 files): pairing, threading, scoping, job status, execution contract, research contract, response quality, marketing copy.
- MCP surface — `src/lib/mcp/` (7 files): director-only tool allowlist, scope wiring, completion, telegram contracts, founder learning, website-scan grounding.
- Auth — `src/lib/auth/api-key.test.ts` (MCP principal derivation).
- Webhook integrity — `src/lib/webhooks/mixpost-signature.test.ts` (HMAC verification incl. the dev-only unsigned path).
- Brand mapping — `src/lib/mixpost/brand-mapping.test.ts` (cross-brand leak prevention).
- Agent knowledge/routing — `src/lib/agents/` (7) + `knowledge/` (2), `src/lib/ai/model-routing.test.ts`.
- GitHub integration — `src/lib/github/` (3).
- Four of 62 agent tools: `abeai`, `pico`, `project-backend-marketing`, `rendered-website-scan`.

**Not covered at all:**

| Area | Tests / Files |
|---|---|
| `src/components/` (all React UI) | **0 / 271** |
| `src/app/api/` (API routes) | 2 / 120 |
| `src/hooks/` | **0 / 13** |
| `src/stores/` (Zustand) | **0 / 1** |
| `src/lib/media/` (processing pipeline) | **0 / 3** |
| `src/lib/video/` | **0 / 3** |
| `src/lib/stripe/` (checkout, portal, webhooks) | **0 / 2** |
| `src/lib/transcription/` | **0 / 1** |
| 58 of 62 agent tools | — |

The media pipeline and Stripe are the two highest-value gaps: the media pipeline has a documented history of silent data loss (the `status` column / PGRST204 bug), and Stripe touches money.

## Test Types

**Unit tests:** the only automated layer. Pure functions plus source-text contracts, as above.

**Integration tests:** none. Nothing touches Supabase, Mixpost, Anthropic or the network.

**E2E / browser tests:** **none.** `playwright-core` is a dependency but it is used at runtime for rendered website scanning (`src/lib/agents/tools/rendered-website-scan.ts`), **not** for testing. There is no Playwright config, no Cypress, no `e2e/` directory.

**Component tests:** none. No React Testing Library, no jsdom, no `@testing-library/*` in `package.json`.

## Verification Is Largely Manual

Because there is no UI, integration or E2E layer, verifying a change end-to-end is a manual loop:

```bash
npm test          # 156/157 — the brand-portfolio failure is the known baseline
npm run lint      # must be 0 errors (39 warnings are the known baseline)
npm run build     # Webpack production build must pass
npm run dev       # then exercise the feature in the browser at localhost:3000
```

Then check the effect where it actually landed — the Supabase row, the Mixpost draft, the `audit_log` entry. Helper scripts exist for exactly this and should be preferred over asking anyone to open DevTools:

- `npx tsx scripts/run-pipeline.ts <mediaItemId>` — run the media pipeline against one row
- `node scripts/verify-media-state.mjs` — dump a media row's full state
- `node scripts/read-upload-trace.mjs` — replay client upload breadcrumbs from `audit_log` in the terminal
- `node scripts/inspect-schema.mjs` — confirm a column exists before writing to it

**Do not ask the user to open the browser console or Network tab.** Client-side diagnosis goes through the breadcrumb pattern (`src/components/agency/MediaUploader.tsx` → `src/app/api/debug/upload-log/route.ts` → `scripts/read-upload-trace.mjs`).

## Common Patterns

**Async testing** — `test()` accepts an async function; `await` the call and assert on the result. There is no `done` callback style and no timer faking anywhere.

**Error testing** — assert on the thrown message with a regex, never a bare `assert.throws`:

```ts
assert.throws(
  () => assertProjectScope(scope, 'scent-sell'),
  /outside the active project scope/,
)
```

**Absence testing** — `assert.doesNotMatch` guards against content that must never appear (brand confusion, removed integrations). Write these against a *positive* claim, not any mention of the string — that distinction is precisely what the `brand-portfolio.test.ts` failure above gets wrong.

**Adding a test:** create `<module>.test.ts` beside the module, import `assert from 'node:assert/strict'` and `test from 'node:test'`, import the subject as `'./module.ts'` (with extension), and name the test as a sentence stating the rule it protects. It is picked up automatically by the `find` glob in `npm test` — no registration step.

---

*Testing analysis: 2026-07-30*

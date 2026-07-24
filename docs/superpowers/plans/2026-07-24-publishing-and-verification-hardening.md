# Publishing and Verification Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make external publishing, review finalisation, outbound email, and inbound Mixpost webhooks fail safe, then establish repeatable test and CI checks.

**Architecture:** Keep all publishing implementation in the existing Director tool loop. The MCP server will use an explicit Director-only tool set. A small pure signature helper will make the webhook boundary independently testable without invoking Next.js, Supabase, or Resend.

**Tech Stack:** Next.js 15, TypeScript, Node 22 `node:test`, GitHub Actions, npm.

## Global Constraints

- Do not migrate Supabase or alter database schema.
- Preserve existing user-owned working-tree changes.
- Do not expose a new direct publish path.
- Dependency remediation must avoid a major-version migration in this hardening pass.

---

### Task 1: Make public-facing actions Director-only for MCP clients

**Files:**
- Create: `src/lib/mcp/director-only-tools.test.ts`
- Modify: `src/lib/mcp/server.ts`
- Modify: `src/lib/mcp/tool-adapter.ts`
- Modify: `~/Obsidian/Reference/nrs-mcp-architecture.md` is out of scope because this change must not write to external project notes without separate authorisation.

- [x] **Step 1: Write a failing MCP exposure test**

```ts
for (const name of ['publish_to_social', 'blotato_publish', 'send_email', 'manage_posts']) {
  assert.equal(isDirectorOnlyMcpTool(name), true)
}
```

- [x] **Step 2: Run the test and confirm it fails because the policy helper does not exist.**

Run: `npm test -- src/lib/mcp/director-only-tools.test.ts`

- [x] **Step 3: Add the policy helper and consume it from the MCP registration path.**

```ts
export function isDirectorOnlyMcpTool(name: string): boolean {
  return DIRECTOR_ONLY_MCP_TOOLS.has(name)
}
```

- [x] **Step 4: Update MCP quick-start instructions to send publication, Review-queue, and outbound-email requests to `chat_with_director`.**

- [x] **Step 5: Run the focused test and full suite.**

### Task 2: Fail closed for webhook configuration errors

**Files:**
- Create: `src/lib/webhooks/mixpost-signature.ts`
- Create: `src/lib/webhooks/mixpost-signature.test.ts`
- Modify: `src/app/api/webhooks/mixpost/route.ts`

- [x] **Step 1: Write failing tests for production missing-secret rejection, development-only bypass, valid HMAC acceptance, and invalid HMAC rejection.**

- [x] **Step 2: Run the focused test and confirm it fails because the helper does not exist.**

Run: `npm test -- src/lib/webhooks/mixpost-signature.test.ts`

- [x] **Step 3: Implement a pure helper that returns a typed verification result.**

```ts
type MixpostSignatureResult =
  | { ok: true }
  | { ok: false; reason: 'missing-secret' | 'missing-signature' | 'invalid-signature' }
```

- [x] **Step 4: Return HTTP 503 for a missing secret and 403 for a signature failure.**

- [x] **Step 5: Run focused and full tests.**

### Task 3: Establish repeatable checks and CI

**Files:**
- Modify: `package.json`
- Modify: `src/lib/github/repository-context.test.ts`
- Modify: `src/lib/mcp/director-completion.test.ts`
- Create: `.github/workflows/quality.yml`

- [x] **Step 1: Make existing test imports compatible with Node TypeScript stripping.**

- [x] **Step 2: Add `npm test` using Node's built-in test runner and all `*.test.ts` files under `src`.**

- [x] **Step 3: Add GitHub Actions for `npm ci`, test, lint, and build on pushes to `main` and pull requests.**

- [x] **Step 4: Run all local quality gates.**

### Task 4: Apply compatible dependency security fixes and reassess

**Files:**
- Modify: `package.json` and `package-lock.json` only if npm identifies non-breaking fixes.

- [x] **Step 1: Inspect `npm audit fix --dry-run` for package and version changes.**
- [x] **Step 2: Apply only compatible remediation, then run test, lint, and build.**
- [x] **Step 3: Re-run `npm audit --omit=dev`, inspect the diff, and report remaining advisories with their actual reachability unknown.**

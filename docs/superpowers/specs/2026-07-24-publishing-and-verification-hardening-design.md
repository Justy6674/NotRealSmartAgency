# Publishing and Verification Hardening Design

## Goal

Prevent external MCP clients from bypassing the Director's review flow, reject unsigned Mixpost webhooks outside local development, and make the repository's quality checks repeatable in CI.

## Chosen approach

The MCP adapter will use an explicit direct-tool allowlist: read-only queries plus a small set of bounded utilities. External publication and finalisation tools—including `publish_to_social`, `blotato_publish`, `send_email`, and `manage_posts`—therefore stay Director-only by default. They remain available to the web Director and internal agent loop, but an external MCP client must use `chat_with_director`, where the existing current-conversation approval rule and Review queue context apply. This preserves the product principle that plug-in AIs are messengers rather than marketers, and prevents a newly added side-effecting tool becoming public accidentally.

Mixpost signature verification will move into a small, dependency-free helper. The route will accept a missing webhook secret only when explicitly running in `development` or `test`; preview and production deployments will return a configuration error instead of accepting the event.

The project will use Node's built-in TypeScript stripping for its existing node:test files. A GitHub Actions workflow will run tests, lint, and the production build on pull requests and pushes to `main`.

## Alternatives considered

1. Add an approval token to direct MCP publishing. Rejected because the existing approval queue does not have an atomic one-time consumption state, and introducing one requires a live schema migration.
2. Leave direct publishing exposed and strengthen its prompt. Rejected because prompts do not structurally prevent a direct MCP caller from invoking the tool.
3. Hide direct publishing from MCP and retain the existing Director approval flow. Chosen because it is the smallest safe change and matches the documented MCP architecture.

## Acceptance criteria

- Only reviewed read-only or bounded utilities are registered as direct MCP tools; `publish_to_social`, `blotato_publish`, `send_email`, and `manage_posts` are not.
- MCP guidance tells clients to ask the Director to publish after review, rather than invoking the tool directly.
- A missing Mixpost webhook secret is rejected outside `development` and `test`.
- Valid HMAC signatures remain accepted and invalid signatures remain rejected.
- `npm test` runs all committed TypeScript node:test files.
- GitHub Actions runs test, lint, and production build for `main` and pull requests.
- Dependency updates are applied only when the package manager identifies a compatible, non-breaking remediation and all quality gates remain green.

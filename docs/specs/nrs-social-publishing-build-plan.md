---
created: 2026-04-06
tags: [notrealsmart, architecture, social-publishing, oauth, api]
project: NotRealSmartAgency
---

# NRS Direct Social Publishing — Build Plan

## Philosophy
Build our own. No middleware. Agent calls platform API directly as a tool.
Use today's tech (OAuth + REST APIs). Ready for tomorrow's (MCP servers from platforms).

## Platform-by-Platform Requirements

### Meta (Instagram + Facebook)
- **Portal:** developers.facebook.com
- **Permissions needed:** `instagram_business_basic`, `instagram_business_content_publish`, `pages_manage_posts`, `pages_read_engagement`
- **App review:** Screencast demo per permission, 5+ business days per submission
- **Account requirement:** Instagram Business or Creator account linked to Facebook Page
- **Token lifetime:** 60 days (long-lived, auto-refreshable)
- **Rate limits:** 200 API calls/hour/account, 100 published posts/24h
- **Publishing flow:** 2-step — create media container, then publish. Videos need processing wait between steps.
- **Gotchas:** 2025 rate limit reduction from 5,000 to 200/hour broke production apps. Video must be at public URL.
- **Open source reference:** github.com/jlbadano/ig-mcp (production-ready Instagram MCP, 23 tools), github.com/mcpware/instagram-mcp

### YouTube (Google)
- **Portal:** console.cloud.google.com
- **Scope needed:** `youtube.upload`
- **App verification:** Required for sensitive scopes. Privacy policy + homepage + demo video.
- **Quota:** 10,000 units/day default. Single upload = 1,600 units (~6 uploads/day). Can request more.
- **Token lifetime:** Access token expires hourly, refresh token is long-lived
- **Publishing:** Multipart upload with video file + metadata (title, description, tags, privacy). Shorts = same endpoint, vertical <60s.
- **Open source reference:** github.com/ZubeidHendricks/youtube-mcp-server (10 tools, Shorts support, analytics)

### TikTok
- **Portal:** developers.tiktok.com
- **Scopes needed:** `video.publish`, `video.upload`
- **App review:** 5-10 business days. Demo video required. Sandbox testing mandatory before audit.
- **Critical:** Unaudited apps = all posts restricted to PRIVATE. Must pass audit for public visibility.
- **Account requirement:** Business accounts only for Content Posting API
- **Publishing:** Init upload → upload chunks → TikTok processes. Or "Pull from URL".
- **Gotchas:** Videos 3s-10min only. TikTok auto-reviews content post-publish. ~15 posts/day limit.
- **NRS status:** App already pending review

### LinkedIn
- **Portal:** developer.linkedin.com
- **Scopes needed:** `w_member_social` (personal), `w_organization_social` (company pages)
- **Access:** Community Management API. Development tier via self-service, Standard tier requires upgrade.
- **Token lifetime:** 60 days. Limited auto-refresh options.
- **Publishing:** POST /rest/posts. Images/videos require upload-first flow. Supports carousels (PDF documents).
- **Gotchas:** LinkedIn Partner Program required since 2015. Company page posting needs admin access. 100 API calls/day/user.
- **Note:** `w_member_social` is in "Open Permissions" — self-service access, no review needed.

## Architecture

```
User clicks "Connect Instagram" → /api/auth/meta/redirect
  → Redirects to Facebook OAuth consent screen
  → User approves
  → Meta redirects to /api/auth/meta/callback with code
  → Server exchanges code for short-lived token
  → Exchanges for long-lived token (60 days)
  → Stores in user_integrations table
  → Agent tool publish_to_instagram uses stored token
```

Same pattern for YouTube (Google OAuth), TikTok, LinkedIn.

## Files to Build

### Week 1: OAuth Infrastructure
- `src/app/api/auth/[platform]/redirect/route.ts` — initiates OAuth redirect per platform
- `src/app/api/auth/[platform]/callback/route.ts` — handles callback, exchanges code for token
- `src/lib/social/token-manager.ts` — token storage, refresh logic, expiry checking
- `src/lib/social/platforms.ts` — platform configs (client IDs, scopes, endpoints)
- `src/components/agency/ConnectSocialsCard.tsx` — UI for connecting accounts in brand settings

### Week 2: Publishing Tools
- `src/lib/agents/tools/publish-to-meta.ts` — Instagram + Facebook publishing
- `src/lib/agents/tools/publish-to-youtube.ts` — YouTube video + Shorts upload
- `src/lib/agents/tools/publish-to-tiktok.ts` — TikTok video publishing
- `src/lib/agents/tools/publish-to-linkedin.ts` — LinkedIn post publishing
- Update `src/lib/agents/tools/index.ts` — register all publish tools for Director + Strategy + Video
- Update `src/app/api/cron/publish-posts/route.ts` — use direct APIs instead of Mixpost

## Submit App Reviews Day 1
1. Meta — submit with screencast demos
2. Google — submit with privacy policy + demo video
3. LinkedIn — self-service for w_member_social (instant), apply for Standard tier
4. TikTok — already pending

## Tomorrow's Tech Path
When platforms ship their own MCP servers, each publish tool becomes a thin wrapper around the MCP call. The tool interface stays the same — the implementation swaps. Users never notice.

---
**Related entity:** [[Reference/wiki/entities/notrealsmart|notrealsmart]]

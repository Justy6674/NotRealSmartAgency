# Phase 2: Publishing off the withdrawn host — Research

**Researched:** 2026-07-30
**Domain:** Container hosting migration (Mixpost Pro / Laravel / MySQL / Redis / Horizon / Reverb), stateful data migration, DNS cutover
**Confidence:** MEDIUM

> **Provenance note.** No Context7 or curated-doc provider was available for this
> domain — it is infrastructure vendor policy, not library API. Every external claim
> below carries `[CITED: url]` with the page it came from. Per
> `gsd-tools query classify-confidence`, WebFetch of a vendor doc rates **LOW** and
> a cross-verified WebSearch rates **MEDIUM**; nothing here reaches the HIGH tier.
> Claims tagged `[VERIFIED: codebase]` were read directly out of this repository in
> this session and are the strongest evidence in the document. Treat vendor limits as
> **needing a five-minute confirmation on the vendor's own dashboard before money is
> spent** — they change without notice.

---

<user_constraints>

## User Constraints

There is no `CONTEXT.md` for this phase. These are copied from
`.planning/intel/owner-decisions.md` §D-A and from the orchestrator's brief, which
relayed them as owner decisions rather than open questions.

### Locked Decisions

- **Move Mixpost off the BinaryLane VPS to a different rented host and keep it
  publishing.** Build direct platform publishing behind it. Retire Mixpost once direct
  is proven. (`owner-decisions.md` §D-A)
- **The VPS at 203.29.242.68 is out of use by owner instruction.** Mixpost currently
  serves from it and must move, not stay. Do not propose keeping it, improving it, or
  fixing it in place.
- **Hosting on the owner's Mac is excluded.** Vercel's cron marks a post stuck ten
  minutes as `failed`, so a sleeping laptop marks real scheduled content failed rather
  than merely delaying it.
- **The owner is a clinical/product person, not a developer.** He must not be asked to
  run CLI commands or manage servers.
- **Mixpost Pro is a paid one-time licence already owned.** Self-hosted Docker, image
  `inovector/mixpost-pro-team:latest`, with mysql and redis alongside.
- **The MySQL database holds the 17 authorised social account OAuth tokens.**
  Preserving it is the whole point of the phase.
- **Direct publishing must not be switched on until per-account project mapping is
  proven.** `social_oauth_tokens` has zero rows; the path has never run. That is
  Phase 5, not this one.

### Claude's Discretion

- Which specific managed host and which region.
- The exact migration mechanics (dump format, transfer method, verification queries).
- Server sizing, within the constraint that it must match or beat the current
  transcode benchmark.

### Deferred Ideas (OUT OF SCOPE)

- Direct-to-platform publishing (Phase 5: PUB-04 … PUB-08).
- Retiring the rented host entirely (PUB-08, Phase 5).
- Surfacing de-authorised accounts in NRS (PUB-03 — assigned to Phase 1).
- Adding a compliance check to any publishing path (Phase 3, GUARD-*). Note the
  scheduled publisher **already has one** — see the correction under Common Pitfalls.
- Postiz, Blotato, or any middleware swap. Rejected in
  `OPTIONS-publishing-and-interface.md` §2 with reasons.

</user_constraints>

<phase_requirements>

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| **PUB-01** | Scheduled and immediate publishing runs from a host the owner has not withdrawn, with no re-authorisation of the seventeen authorised accounts. | Standard Stack (host choice); Migration Procedure §2 (byte-exact MySQL + storage transfer); Verification Gate §2.4 (proving 17 accounts survive *before* DNS moves); Licence §5 (domain-bound licence survives a host move). |
| **PUB-02** | A video that previously timed out on upload publishes, and the owner can see upload progress while it happens. | Configuration Carry-Across (the two already-diagnosed faults, plus the three container overrides); Architecture §Request-duration budget (why a 20-minute HTTP response is the disqualifying platform test); Sizing (why 2 GB / 2 vCPU is the floor and 4 GB / 4 vCPU is the target). |

</phase_requirements>

## Summary

The phase looks like a hosting-vendor comparison and is actually two things: a **stateful
data migration** (a MySQL database holding 17 live OAuth grants, plus a media storage
volume) and a **platform-limits screening exercise** where one specific limit — how long a
single HTTP response may stay open with no bytes flowing — eliminates most of the
candidate list before cost or convenience is even considered.

Mixpost processes a large video upload **synchronously inside the web request**. The
already-fixed fault on the old host was a host-nginx `proxy_read_timeout` of 60 s while the
container transcoded for up to 1000 s. That means the new host must permit a single HTTP
response to stay pending, with no data transferring, for up to ~20 minutes. This is exactly
the thing PaaS platforms cap. **DigitalOcean App Platform is disqualified twice over** — a
hard 100-second request timeout that cannot be changed, and it "does not support volumes"
at all `[CITED: docs.digitalocean.com/products/app-platform/details/limits/]`. **Railway is
marginal**: it closes any request after 5 minutes with no data transferred, and 15 minutes
even when data flows `[CITED: docs.railway.com/networking/public-networking/specs-and-limits]`.
The current 492 MB benchmark transcodes in 160 s and would pass; the 2 GB ceiling the system
is configured for, whose transcode is measured at 5–10 minutes, would not. **Fly.io** can be
configured past its 60-second default via `http_service.http_options.idle_timeout`
`[CITED: fly.io/docs/reference/configuration/]` but the maximum value is undocumented and
historically required contacting support. **Render** has persistent disks and a documented
MySQL-on-disk pattern `[CITED: render.com/docs/deploy-mysql]` but its nearest region to
Australia is Singapore `[CITED: render.com/docs/regions]`.

Region matters more than it first appears. The owner is in Australia and uploads
half-gigabyte video files from an Australian connection into a Mixpost UI that NRS embeds
in an iframe. Hetzner has no Oceania region at all — six locations, Singapore is the only
Asia-Pacific one `[CITED: docs.hetzner.com/cloud/general/locations/]`. Railway's metal
regions are US, Europe and Southeast Asia `[CITED: blog.railway.com/p/launch-week-01-regions]`.
Neither Render nor Railway nor Hetzner can put this workload in Sydney.

**Primary recommendation:** Put Mixpost Pro on **Elestio's managed Docker-Compose service,
targeting a Sydney VM (AWS Lightsail `ap-southeast-2` or Linode Sydney — both confirmed
Elestio targets)**, sized at 4 vCPU / 8 GB. Elestio runs the same `docker-compose.yml` this
deployment already uses, gives root SSH plus a browser terminal and file editor for the
three override files, and — the reason it beats a raw Droplet — contracts *away* the
ongoing server administration the owner must never touch: OS patching, security updates,
automated backups, TLS renewal and 24/7 monitoring are the product, not a task
`[CITED: elest.io/pricing]`. Budget ~$50–70/month all-in, up from ~$15, and treat that
difference as the price of the owner never administering a box again. It is a bridge that
Phase 5 retires.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Holding the 17 OAuth grants | Mixpost MySQL (new host) | — | The grants live in Mixpost's own `accounts` table. Nothing in NRS holds them; `social_oauth_tokens` has 0 rows. Moving the database is the *only* thing that preserves them. |
| Scheduling and firing a publish | NRS (Vercel cron) → Mixpost API | Mixpost's own scheduler | `vercel.json` schedules `/api/cron/publish-posts` every 5 min `[VERIFIED: codebase]`. Mixpost also schedules internally when a post is scheduled inside its UI (`post.scheduled` webhook flips NRS status). |
| Confirming a publish succeeded | Mixpost webhook → NRS `/api/webhooks/mixpost` | — | NRS marks `publishing` and waits for the webhook. The webhook registration and its HMAC secret live in Mixpost's database, so they survive the restore. |
| Video transcode | Mixpost container (Horizon + ffmpeg) | — | Never NRS, never Vercel. This is the workload that sets the CPU/RAM floor and the request-duration requirement. |
| Large-file ingest, NRS path | Supabase Storage → Mixpost `/media/remote/initiate` (async, polled) | — | `sync-draft.ts` initiates and polls; it does **not** hold a long request `[VERIFIED: codebase]`. |
| Large-file ingest, owner path | Browser → Mixpost UI in iframe (chunked, then synchronous processing) | — | **This is the path that needs the 20-minute response window.** It is how the 492 MB ProRes was uploaded. |
| Live upload progress | Reverb websocket in the Mixpost container → browser | Host nginx `/app` upgrade proxy | Purely Mixpost-internal. Zero Reverb references anywhere in NRS `[VERIFIED: codebase]`. |
| TLS + custom domain | New host's reverse proxy | — | Domain `mixpost.notrealsmart.com.au` must not change — the Mixpost licence is bound to it. |
| Embedding Mixpost in NRS | Host nginx header rewrite (`X-Frame-Options` stripped, `frame-ancestors` CSP set) | — | Configuration, not code. Must be reproduced or the Review tab iframe breaks. |

## Standard Stack

### Core — unchanged, and that is the point

| Component | Version / image | Purpose | Why it stays |
|-----------|-----------------|---------|--------------|
| Mixpost Pro Team | `inovector/mixpost-pro-team:latest` | The publisher | Paid one-time licence already owned; domain-bound, so a host move needs no new licence. |
| MySQL | `mysql/mysql-server:8.0` | Holds the 17 OAuth grants, posts, tags, webhook registration | Version must be **pinned identically** on the new host. A restore into a different major version is the single most likely way to lose the accounts. |
| Redis | `redis:latest` | Horizon queue backend, cache, sessions | Ephemeral. Does **not** need migrating — but see the pitfall about draining the queue first. |
| Laravel Horizon | in-container | Runs `DownloadRemoteMediaJob` / ffmpeg transcodes | The `timeout: 3600` override is load-bearing. |
| Laravel Reverb | in-container, port 8080 | Live upload-progress websocket | The reason PUB-02's second fault existed. |

### The host — evaluated

| Host | 20-min HTTP response | Persistent volumes | Multi-container | Sydney region | Owner-facing admin | Realistic cost/mo |
|---|---|---|---|---|---|---|
| **Elestio (managed VM, custom compose)** | Yes — own nginx, own timeouts | Yes | Yes, your own compose file | **Yes** (Lightsail Sydney, Linode Sydney) | **Lowest of the real options** — patching, backups, TLS, monitoring are Elestio's job | ~$50–70 `[ASSUMED]` |
| Fly.io | Configurable via `idle_timeout`; **max undocumented** | Yes, per-machine | Yes, process groups (separate machines) | **Yes** (`syd`) | Medium — you own the platform config | ~$30–45 `[ASSUMED]` |
| Railway | **Marginal — 5 min with no data, 15 min with data** | Yes | Yes | **No** (US / EU / SE-Asia) | Low | ~$20–40 `[ASSUMED]` |
| Render | Undocumented; disks + MySQL pattern exist | Yes | Multiple services | **No** (Singapore nearest) | Low | ~$30–50 `[ASSUMED]` |
| Sliplane | Likely yes (Traefik on Hetzner) | Yes | Yes | **No** — Germany / Finland only | Low | from €9 `[CITED: sliplane.io/docker-hosting]` |
| Hetzner Cloud VM | Yes — no proxy at all | Yes | Yes | **No** Oceania region | **High — owner administers a server** | ~€9 |
| DO / Vultr / Linode Droplet, Sydney | Yes | Yes | Yes | Yes | **High — owner administers a server** | ~$24 |
| **DigitalOcean App Platform** | **NO — hard 100 s, cannot be changed** | **NO — "does not support volumes"** | n/a | n/a | n/a | **DISQUALIFIED** |

**Disqualifications, with sources:**

- **DigitalOcean App Platform — eliminated.** "App Platform does not support volumes"
  and "The local filesystem is additionally limited to 4 GiB"
  `[CITED: docs.digitalocean.com/products/app-platform/details/limits/]`. Separately, a
  hard 100-second HTTP request timeout that "unfortunately can't be changed", with
  DigitalOcean's own guidance being to move to a Droplet
  `[CITED: digitalocean.com/community/questions/how-to-resolve-the-100s-request-timeout-of-digital-ocean-s-app]`.
  Either fact alone ends it; the MySQL data volume has nowhere to live.
- **Railway — not recommended, and the reason is specific.** "HTTP requests can run for
  up to 15 minutes if data keeps transferring (for example, keep-alive heartbeats), and
  are otherwise closed after 5 minutes with no data transferred"
  `[CITED: docs.railway.com/networking/public-networking/specs-and-limits]`. During a
  Mixpost transcode the connection is silent. The 160 s benchmark survives; the 2 GB
  ceiling — measured at 5–10 minutes of two-pass ffmpeg in
  `docs/specs/nrs-mixpost-upload-limits.md` — does not. Railway would work until the day
  the owner uploads a long video, then fail in exactly the way this phase exists to stop.
  Compounding it: no Australian region.
- **Hetzner, Render, Sliplane, Railway — all fail the region test.** Hetzner: six
  locations, no Oceania `[CITED: docs.hetzner.com/cloud/general/locations/]`. Render:
  Oregon, Ohio, Virginia, Frankfurt, Singapore
  `[CITED: render.com/docs/regions]`. Sliplane: Germany and Finland only
  `[CITED: sliplane.io/european-docker-hosting-provider]`. This is not a latency
  nicety — it is a ~490 MB upload from an Australian domestic connection, repeated.
- **Fly.io — viable, second choice.** `http_service.http_options.idle_timeout` exists and
  the documented example uses `600` `[CITED: fly.io/docs/reference/configuration/]`, but
  the maximum is not published and Fly's default is 60 s with staff historically pointing
  users at support or a paid plan for longer
  `[CITED: community.fly.io/t/request-timeouts-on-fly-io/5653]`. Fly has a `syd` region.
  The awkwardness is structural: Fly volumes bind to a single machine, so MySQL, Redis and
  Mixpost each become a separate machine with its own volume — a genuine rewrite of the
  compose topology, which cuts against success criterion 3 ("no publishing code was
  rewritten for the move" — the spirit is *reproduce, don't redesign").
- **Raw Droplet on DO/Vultr/Linode Sydney — technically perfect, constraint-violating.**
  Zero platform limits, full control, ~$24/mo, Sydney available. It is also precisely what
  was just withdrawn: a box somebody has to patch, back up, monitor and renew certificates
  on. Recommending it re-creates the problem at a different IP address.

### Recommendation: Elestio managed Docker Compose, Sydney

Elestio deploys **your own `docker-compose.yml`** to a dedicated VM and then operates that
VM for you. "Deploy own docker-compose image using Elestio 'Custom docker-compose'" is a
documented, first-class path, with configuration covering "docker-compose, env vars, and
reverse proxy configuration"
`[CITED: docs.elest.io/books/cicd-pipelines/page/deploy-own-docker-compose-image-using-elestio-custom-docker-compose]`.
Their own worked example is literally "Deploy docker-compose apps (Wordpress, MySQL,
Redis, Keycloak)" — the same shape as this stack
`[CITED: docs.elest.io/books/cicd-pipelines/page/deploy-docker-compose-apps-wordpress-mysql-redis-keycloak]`.

Every deployment includes "Automated backups, Human support, Monitoring / Alerts,
DNS / SMTP, AI DevOps (24/7/365), Auto SSL, Auto Updates, Tools (VSCode, FileExplorer,
Web Terminal), API, CLI" `[CITED: elest.io/pricing]`. That list is the requirement — it is
the ongoing server administration the owner must never be handed.

nginx is reachable and editable at `/opt/elestio/nginx/` over SSH
`[CITED: docs.elest.io/books/security/page/nginx-advanced-configuration]`, which is what
makes the PUB-02 fixes (proxy timeout, body size, header stripping, websocket upgrade)
applicable at all. A platform that hid its proxy would make PUB-02 unfixable.

Sydney is available: Elestio supports AWS Lightsail's "Asia Pacific (Mumbai, Singapore,
**Sydney**, Tokyo)" and Linode's Sydney region
`[CITED: elest.io/deploy-on-aws-lightsail, elest.io/deploy-on-linode]`.

**Sizing — do not repeat the old host's mistake.** The withdrawn VPS was 2 vCPU / 2 GB and a
141 MB Motion-JPEG `.mov` took ~382 s to transcode there, with two-pass libx264 spiking to
300–500 MB RSS (`.planning/intel/constraints.md` C-06). MySQL 8 alone wants ~400 MB, plus
Redis, PHP-FPM, nginx, and a Horizon worker with `memory_limit=1024M`. **Specify 4 vCPU /
8 GB.** The 160-second benchmark for the 492 MB ProRes is a *ceiling to beat*, and more
cores is the direct lever on two-pass ffmpeg.

**Pricing caveat, stated plainly.** Elestio's own page says plans start at $11/month and
that billing is per deployed service per hour including compute, storage, bandwidth and
support level, with support Level 1 included `[CITED: elest.io/pricing]`. It does not
publish a price for a 4 vCPU / 8 GB Sydney target. **The ~$50–70 figure is `[ASSUMED]`** —
get the real number out of Elestio's configurator before committing. That is a five-minute
check and it belongs in the plan as a task, not as a footnote.

### Alternatives Considered

| Instead of | Could use | Tradeoff |
|------------|-----------|----------|
| Elestio managed | Fly.io `syd` | Cheaper, Sydney available, but the compose topology must be rebuilt as three machines with three volumes, and `idle_timeout`'s ceiling is unverified. Take this if Elestio's quote is unacceptable **and** the idle-timeout ceiling is confirmed ≥1200 s first. |
| Elestio managed | Vultr/Linode/DO Droplet in Sydney + Coolify | ~$24 + $5/mo and technically unconstrained, but Coolify still leaves OS patching, backups and monitoring unowned. Only acceptable if someone other than the owner is contractually the operator. |
| A managed host at all | Migrate to Postiz / Blotato | Rejected in `OPTIONS-publishing-and-interface.md` §2 for reasons that still hold: 18 re-authorisations, ~1,900 lines of integration rewritten, and Blotato's publish tool runs no compliance check. Out of scope. |

**Installation:** no packages are added to the NRS repository by this phase. See Package
Legitimacy Audit.

## Package Legitimacy Audit

**Not applicable — this phase installs no external packages.**

No `npm install`, `pip install` or `cargo add` occurs. The work is: provision a host, run an
already-owned Docker image, move data, change environment variables. The only third-party
artefact is `inovector/mixpost-pro-team:latest`, which is the image already running in
production on the withdrawn host and is the vendor's own published image for a licence the
owner has already paid for `[CITED: github.com/inovector/MixpostProTeamApp]`.

**Packages removed due to [SLOP] verdict:** none.
**Packages flagged as suspicious [SUS]:** none.

One image-related pitfall worth stating: `:latest` is not a version. See Pitfall 6.

## Architecture Patterns

### System Architecture Diagram

```
                          ┌──────────────────────────────────────────┐
   Owner's browser        │  NRS on Vercel                           │
        │                 │                                          │
        │  (A) opens      │  vercel.json cron */5  ──► /api/cron/     │
        │  Review tab     │                            publish-posts │
        ▼                 │                                │         │
   iframe embed ◄─────────┤  ReviewRoom.tsx                │         │
   of Mixpost UI          │  NEXT_PUBLIC_MIXPOST_WEB_URL   │         │
        │                 │                                │         │
        │  (B) drags a    │  sync-draft.ts ────┐           │         │
        │  492 MB .mov    │  publish-to-social ┤           │         │
        │                 └────────────────────┼───────────┼─────────┘
        │                                      │           │
        │  chunked POST (50 MB chunks)         │ remote/   │ POST /posts
        │  then ONE silent response            │ initiate  │ (numeric
        │  held open up to ~1200 s             │ + poll    │  account ids)
        │                                      │           │
        ▼                                      ▼           ▼
   ╔══════════════════════════════════════════════════════════════════╗
   ║  NEW HOST — mixpost.notrealsmart.com.au (domain UNCHANGED)       ║
   ║                                                                  ║
   ║  host nginx : TLS ── proxy_read_timeout 1200s                    ║
   ║               │      client_max_body_size 2048M                  ║
   ║               │      proxy_request_buffering off                 ║
   ║               │      strips X-Frame-Options, sets frame-ancestors║
   ║               ├──► 127.0.0.1:8585 ──► container nginx ──► PHP-FPM║
   ║               └──► /app ──► 127.0.0.1:8080 (Reverb, wss upgrade) ║
   ║                                                                  ║
   ║  ┌──────────────── mixpost container ────────────────┐           ║
   ║  │ nginx(2048M) → PHP-FPM(2048M/2048M/1024M)         │           ║
   ║  │ Horizon supervisor-1: timeout 3600, mem 1024M     │           ║
   ║  │        └─► ffmpeg two-pass (300–500 MB RSS)       │           ║
   ║  │ Reverb :8080                                      │           ║
   ║  │ volume: storage → /var/www/html/storage/app       │           ║
   ║  └───────────────────────────────────────────────────┘           ║
   ║        │                          │                              ║
   ║        ▼                          ▼                              ║
   ║  ┌───────────┐              ┌───────────┐                        ║
   ║  │ mysql 8.0 │◄── THE 17    │  redis    │  (ephemeral —          ║
   ║  │ volume    │    OAUTH     │  volume   │   must be DRAINED,     ║
   ║  │           │    GRANTS    │           │   not migrated)        ║
   ║  └───────────┘              └───────────┘                        ║
   ╚══════════════════════════════════════════════════════════════════╝
                    │                              │
                    │ platform publish             │ webhook POST
                    ▼                              ▼
        Facebook / Instagram / LinkedIn   www.notrealsmart.com.au
        / YouTube / TikTok                /api/webhooks/mixpost
                                          (HMAC X-Signature; URL and
                                           secret live in Mixpost's DB,
                                           so they survive the restore)
```

Trace the two flows that matter: **(A)** the owner opens the Review tab, the iframe loads
Mixpost from the *same domain name* as before, and the header rewrite is what stops the
browser refusing to frame it. **(B)** the owner drops a large video into that iframe; the
chunks arrive quickly and then one HTTP response sits silent while ffmpeg runs — that
silent window is the platform requirement that eliminated three candidate hosts.

### Recommended target-host layout

```
/opt/mixpost/                     # keep this path — every runbook references it
├── docker-compose.yml            # unchanged: mixpost, mysql, redis + named volumes
├── .env                          # MIXPOST_MAX_VIDEO_FILE_SIZE=2048 etc. + REVERB_*
└── overrides/                    # bind-mounted :ro — the container FS is ephemeral
    ├── zzz-uploads.ini           # upload_max_filesize/post_max_size 2048M, memory_limit 1024M
    ├── nginx-default.conf        # client_max_body_size 2048M, fastcgi_read_timeout 1000
    └── horizon.php               # supervisor-1 timeout 3600, memory 1024
/opt/elestio/nginx/               # Elestio's managed reverse proxy — the host-nginx layer
```

### Pattern 1: Dual-run before cutover

**What:** Bring the new host fully up, restored and verified, while the old host is still
serving live traffic. Only then move DNS.
**When to use:** Any migration where the data is irreplaceable — here, 17 OAuth grants that
can only be re-created by the owner signing in seventeen times.
**How:** Reach the new host by a temporary hostname or a local `hosts` entry, not by the
production domain. Verify against it. Cut over last.

**Licence wrinkle that makes this non-obvious:** the Mixpost licence "is always bound to one
domain or one subdomain" `[CITED: mixpost.app/terms-of-use]`. A dual-run under a *different*
hostname may present as unlicensed. Two ways through: verify data at the **database layer**
(which needs no licensed web session at all — this is the recommended route, and it is what
the verification gate below does), or ask Inovector for a temporary staging allowance. Do
not assume the second is available.

### Pattern 2: Verify at the layer that cannot lie

**What:** Prove the accounts survived with SQL against the restored database, not by
eyeballing the Mixpost UI.
**Why:** The UI can render an account row for a token that is expired, revoked or truncated.
`SELECT` on the accounts table shows whether the encrypted token payload actually arrived,
byte for byte.
**Example:**

```sql
-- Run on OLD host first, record the output verbatim. Then on NEW host. They must match.
SELECT COUNT(*)                                        AS total_accounts,
       SUM(CASE WHEN authorized = 1 THEN 1 ELSE 0 END) AS authorised,
       provider,
       COUNT(*)                                        AS per_provider
FROM   mixpost_accounts
GROUP  BY provider WITH ROLLUP;

-- Token integrity: length of the encrypted payload must be identical row-for-row.
SELECT id, provider, name, authorized, LENGTH(data) AS token_len, CRC32(data) AS token_crc
FROM   mixpost_accounts
ORDER  BY id;
```

Expected: **18 rows, 17 with `authorized = 1`** (the TeleScribe Facebook Page is
de-authorised and that state must be preserved as-is, not "fixed"), split 7 Facebook /
5 Instagram / 3 LinkedIn / 2 YouTube / 1 TikTok per
`OPTIONS-publishing-and-interface.md` §2. **Table and column names are `[ASSUMED]`** —
Mixpost Pro's schema is not publicly published; read the real names off the running
container before writing the plan's verification step.

### Anti-Patterns to Avoid

- **Moving hosts without carrying the configuration.** `OPTIONS-publishing-and-interface.md`
  §2 Route B says it outright: "both current faults follow the software, not the hardware…
  Moving hosts without fixing those two settings reproduces both faults on the new box."
  The corollary is stronger — the *fixes* are also configuration, so a clean-image install
  reproduces the faults even though they are already fixed today.
- **Copying `/var/lib/mysql` as files.** A filesystem copy of a running InnoDB directory is
  a corrupt database. Use `mysqldump` (or stop the container first). Render's own MySQL
  guidance makes the same point about snapshots: "Restoring a disk snapshot will likely
  result in corrupted or lost database data" `[CITED: render.com/docs/deploy-mysql]`.
- **Migrating Redis.** It holds the Horizon queue. Carrying a half-finished job across to a
  host with different container IDs invites a job that fails forever. Drain the queue, then
  start Redis empty.
- **Changing the domain.** Breaks the licence binding, breaks every OAuth redirect URI
  registered with Meta/LinkedIn/Google, breaks the webhook registration, and breaks the
  `**.com.au` image `remotePatterns` allowance in `next.config.ts`.
- **Cutting DNS over while a post is due.** See Pitfall 1 — this is the one that can
  permanently fail real content.

## Don't Hand-Roll

| Problem | Don't build | Use instead | Why |
|---------|-------------|-------------|-----|
| Getting the accounts to the new host | A script that reads tokens out and re-inserts them | `mysqldump` of the whole schema | Mixpost encrypts account payloads with `APP_KEY`. Any selective re-insert risks a key/format mismatch that silently produces 17 unusable rows. |
| Ongoing OS patching, backups, TLS renewal, monitoring | A cron script and a calendar reminder | Elestio's managed layer | This is the entire reason the last host was withdrawn. `[CITED: elest.io/pricing]` |
| Upload progress | Polling the media endpoint from NRS | Mixpost's existing Reverb websocket | Already built. It was broken by three missing env vars, not by absence. |
| Publish confirmation | Polling Mixpost from a Vercel cron | The existing webhook | `/api/webhooks/mixpost` already handles all nine events with HMAC verification and has a test `src/lib/webhooks/mixpost-signature.test.ts` `[VERIFIED: codebase]`. |
| Zero-downtime cutover | A proxy that fans out to both hosts | Pick a quiet window + a short TTL | The publish cadence is one cron every 5 minutes. A 10-minute quiet window is cheaper and safer than dual-write. |

**Key insight:** every piece of this already works. The failure mode for this phase is not
"we couldn't build it" — it is "we rebuilt it slightly differently and lost something we
didn't know was load-bearing." Treat the migration as **reproduction**, and treat every
undocumented difference as a defect.

## Runtime State Inventory

This is a migration phase, so every category is answered explicitly.

| Category | Items found | Action required |
|----------|-------------|------------------|
| **Stored data** | Mixpost MySQL: the 17 authorised (of 18 total) social accounts and their encrypted OAuth payloads; all posts, versions, tags, media rows, webhook registrations, licence activation, users. Mixpost `storage` named volume mounted at `/var/www/html/storage/app`: uploaded media and transcode outputs. | **Data migration.** `mysqldump` → restore; volume tar → restore. Both verified before DNS. |
| | Supabase `media_items.mixpost_media_id` / `mixpost_media_uuid` (migration 031) — cached numeric IDs pointing at Mixpost media rows. | **None, if the database is restored intact** — the IDs stay valid. **If Mixpost is ever rebuilt empty, every one of these caches becomes a dangling pointer** and publishes will fail on missing media. This is a hard argument against any "fresh install and re-connect" approach. |
| | Supabase `scheduled_posts.metadata.mixpost.post_uuid` — the draft-sync idempotency key (C-15). | Same: valid only while Mixpost's DB is preserved. |
| **Live service config** | The **webhook registration** (URL `https://www.notrealsmart.com.au/api/webhooks/mixpost`, nine events, generated secret) was registered by hand in the Mixpost admin UI and exists only in Mixpost's database (`.planning/intel/context.md`). | **None if the DB is restored** — it comes across. **Confirm after cutover** via Mixpost's Webhook Deliveries log; a `403` means secret drift, a `404` means path drift. |
| | The **17 OAuth grants** are registered with Meta / LinkedIn / Google against redirect URIs on `mixpost.notrealsmart.com.au`. | **None — provided the domain does not change.** This is the whole reason the domain is immovable. |
| | Certbot TLS certificate for `mixpost.notrealsmart.com.au` on the old host. | **Re-issued on the new host.** Elestio's Auto SSL handles this; it needs DNS pointing at the new host, which means a brief window where the certificate is being obtained. Plan for it. |
| **OS-registered state** | Host nginx site config, systemd-managed nginx, Certbot renewal timer, Docker daemon and `docker compose` autostart on the old VPS. | **Reproduced, not migrated.** On Elestio these become Elestio-managed. The *content* of the nginx site config must be carried across verbatim plus the two fixes. |
| **Secrets / env vars** | `/opt/mixpost/.env` on the old host: `APP_KEY` (**critical — decrypts the OAuth payloads; a new key makes all 17 accounts unusable**), DB credentials, `MIXPOST_MAX_*`, `REVERB_APP_ID/KEY/SECRET`, `REVERB_HOST/PORT/SCHEME`, licence key. | **Copied verbatim.** `APP_KEY` above all. Regenerating it is the single most destructive possible mistake in this phase. |
| | NRS side: `MIXPOST_API_URL`, `MIXPOST_API_TOKEN`, `MIXPOST_WORKSPACE_UUID`, `MIXPOST_WEBHOOK_SECRET`, `NEXT_PUBLIC_MIXPOST_WEB_URL`, `NEXT_PUBLIC_MIXPOST_WORKSPACE_UUID` — in `.env.local` and Vercel. | **No value changes required** if the domain is preserved — all six are domain- or database-derived. See "NRS-side settings" below. |
| **Build artefacts / installed packages** | Container filesystem is ephemeral; the three overrides persist only via host bind-mounts (`docs/specs/nrs-mixpost-upload-limits.md`). Timestamped `.bak` files exist on the old VPS. | **Copy `/opt/mixpost/overrides/` verbatim.** Also copy the `.bak` files — they are the documented rollback material and they only exist on the machine being decommissioned. |

**The canonical question — after the new host is up, what still has the old host cached?**
Answer: nothing, *provided the domain is unchanged and the MySQL dump is restored intact*.
Every pointer in this system is either a domain name or a database row. That is why the
domain is non-negotiable and why the database is the deliverable.

## Migration Procedure

Written as the sequence to be planned. **No step below should be handed to the owner.**

### Stage 0 — Pre-flight (before anything is provisioned)

1. **Confirm the quiet window.** Query Supabase:
   ```sql
   SELECT id, brand_id, status, scheduled_at
   FROM   scheduled_posts
   WHERE  status IN ('scheduled','publishing')
     AND  scheduled_at < now() + interval '4 hours'
   ORDER  BY scheduled_at;
   ```
   The cutover must land in a window with **zero rows**. See Pitfall 1 for why.
2. **Capture the old host's truth.** Record verbatim, into the phase folder: the account
   census SQL output, `docker compose config`, the three override files, `/opt/mixpost/.env`
   (secrets redacted in the repo copy, full copy held out of git), the host nginx site file,
   `docker image inspect` digest of the running `mixpost-pro-team` image, and
   `SELECT VERSION()` from MySQL.
3. **Get the Elestio quote** for 4 vCPU / 8 GB in Sydney. If it is unacceptable, the
   decision reopens — take it back to the owner rather than silently downgrading to a
   Droplet.
4. **Lower the DNS TTL** on `mixpost.notrealsmart.com.au` to **300 s**, and wait at least
   the current TTL before proceeding. If the record currently sits at 3600 s or 86400 s,
   this wait is hours or a day — it must start first, not last.

### Stage 1 — Provision and reproduce

5. Provision the Elestio target in Sydney. Pin the **exact** MySQL image tag and the
   **exact** Mixpost image digest recorded in step 2 — not `:latest`.
6. Deploy the same `docker-compose.yml`, including the three `:ro` override bind-mounts.
7. Copy `/opt/mixpost/.env` verbatim. **`APP_KEY` unchanged.** Reverb vars unchanged
   (`REVERB_HOST=mixpost.notrealsmart.com.au`, `REVERB_PORT=443`, `REVERB_SCHEME=https`).
8. Configure the Elestio nginx layer at `/opt/elestio/nginx/` with all five directives from
   day one — see Configuration Carry-Across.

### Stage 2 — Move the data

9. **Dump** on the old host, consistently:
   ```bash
   docker exec mixpost-mysql-1 mysqldump \
     --single-transaction --quick --routines --triggers --events \
     --default-character-set=utf8mb4 --hex-blob \
     -u root -p"$MYSQL_ROOT_PASSWORD" mixpost > /tmp/mixpost-$(date -u +%Y%m%dT%H%M%SZ).sql
   sha256sum /tmp/mixpost-*.sql
   ```
   `--single-transaction` gives a consistent InnoDB snapshot without locking writes.
   `--hex-blob` is not optional here: the OAuth payloads are binary and a non-hex dump can
   mangle them across character sets.
10. **Drain, then dump the storage volume.** Stop the Horizon workers first
    (`php artisan horizon:pause`, wait for in-flight jobs), then:
    ```bash
    docker run --rm -v mixpost_storage:/data -v /tmp:/backup alpine \
      tar czf /backup/mixpost-storage-$(date -u +%Y%m%dT%H%M%SZ).tar.gz -C /data .
    ```
11. **Transfer** both artefacts to the new host over `scp`/`rsync`. **Re-verify the SHA-256
    on arrival.** A truncated dump that still restores is the nastiest failure mode
    available.
12. **Restore** into the new MySQL, then untar the storage volume, then `chown` to the
    container's web user (the tar preserves numeric UIDs; confirm they match).

### Stage 3 — The verification gate (this is the PUB-01 proof)

**Nothing below this line may be skipped, and all of it happens BEFORE DNS moves.**

13. **Account census.** Run the SQL from Pattern 2 on both hosts. Require: identical row
    count, identical `authorized` split (18 total / 17 authorised), identical per-provider
    counts, and **identical `token_len` and `token_crc` for every row**. A CRC mismatch on
    even one row halts the migration.
14. **Referential spot-check.** Pick three `media_items` rows from Supabase that carry a
    `mixpost_media_id` and confirm each still resolves in the restored Mixpost database.
    This proves the caches in Pitfall "dangling pointer" are intact.
15. **Live API check against the new host, bypassing DNS.** From a machine with a
    `/etc/hosts` override pointing `mixpost.notrealsmart.com.au` at the new IP — so TLS and
    the licence domain both still match:
    ```bash
    curl -s -H "Authorization: Bearer $MIXPOST_API_TOKEN" \
      "https://mixpost.notrealsmart.com.au/api/$MIXPOST_WORKSPACE_UUID/accounts" | jq 'length'
    ```
    Must return the same count as the old host, and each account's `authorized` field must
    match. This also proves the API token and workspace UUID survived the restore, which
    answers research question 4 empirically rather than by assumption.
16. **Video benchmark.** Upload a ≥490 MB `.mov` through the new host's Mixpost UI (same
    hosts-file trick). Require: (a) it completes, (b) the progress bar moves — proving
    Reverb, (c) wall-clock **≤160 s** — the old host's benchmark. Slower means under-sized;
    fix before cutover, not after.
17. **Webhook round-trip.** Create and delete a throwaway draft; confirm NRS's
    `/api/webhooks/mixpost` logged a `200`, not a `403` (secret drift) or `404` (path drift).

### Stage 4 — Cutover

18. Confirm the quiet window from step 1 still holds.
19. Put the old host into read-only or stop its Horizon workers, so nothing new is written
     to a database about to be abandoned.
20. **Re-dump and re-restore the delta** if more than a few hours elapsed since step 9. If
     the window was tight, do steps 9–12 again now — a stale restore silently loses whatever
     was published in between.
21. Move the A record to the new IP. TTL is already 300 s.
22. Watch: TLS issues cleanly, `/api/ping` returns, the accounts endpoint returns 18, the
     next `/api/cron/publish-posts` tick logs no failures.
23. **Do not decommission the old host.** Leave it running, DNS-detached, for 7 days
     minimum — it is the rollback (see below) and it is the only copy of the `.bak` files.

### Stage 5 — Settle

24. Publish one real post to Facebook, Instagram and LinkedIn — success criterion 1 is not
     met by a green tick, it is met by content appearing on three platforms.
25. Restore the DNS TTL to its normal value.
26. Confirm Elestio's automated backups are running and have produced at least one
     restorable snapshot.

## Rollback

**Rollback is: point DNS back at the old host.** Nothing else. That is why steps 19–23 are
ordered the way they are.

| Question | Answer |
|---|---|
| **What is the rollback trigger?** | Any of: accounts endpoint returns fewer than 18; a publish fails with an auth error; the webhook stops confirming; the video benchmark regresses; TLS fails to issue. |
| **How long does it take?** | DNS TTL (300 s) plus resolver caching slop. Realistically **under 10 minutes**, and this is only true because the TTL was lowered in Stage 0. At a 3600 s TTL it is an hour; at 86400 s it is a day. **Lowering the TTL first is the single cheapest insurance in this phase.** |
| **What is lost on rollback?** | Anything published *through the new host* between cutover and rollback, if the old database is then treated as authoritative. Keep the window short and check `scheduled_posts` for anything that flipped to `published` during it. |
| **What makes rollback impossible?** | Decommissioning the old host. Do not do it for 7 days. Also: if the old host's Horizon was left running and it published something the new host doesn't know about, the two databases diverge — which is why step 19 stops the old workers. |
| **Non-DNS rollback?** | None worth having. There is no floating IP in play, and adding one is a second migration. |

**TTL specifics.** Check the record's current TTL before assuming; a domain that has never
been migrated is often still at the registrar's default. The lowered TTL must be published
and the *old* TTL fully expired before the cutover, otherwise resolvers that cached the old
long TTL will keep the old value for its full duration regardless of what the new record
says. This is the most commonly botched step in a DNS migration.

## NRS-side settings

Verified by reading the repository, not by assumption.

| Setting | Where read | Value change needed? | Evidence |
|---|---|---|---|
| `MIXPOST_API_URL` | `src/lib/mixpost/client.ts` (~23 call sites), `src/lib/mixpost/sync-draft.ts:56`, `src/lib/agents/tools/publish-to-social.ts:51`, `src/app/api/cron/publish-posts/route.ts:48` | **No** — it is the domain, and the domain does not move. | `[VERIFIED: codebase]` |
| `MIXPOST_API_TOKEN` | same call sites | **No.** Mixpost API tokens are Laravel Sanctum-style rows in the database. Restoring the database restores the token. | `[VERIFIED: codebase]` for usage; token-storage location is `[ASSUMED]` from Laravel convention — **prove it with step 15's live curl, do not take it on trust.** |
| `MIXPOST_WORKSPACE_UUID` | `client.ts:72` and 20+ siblings; `scripts/test-mixpost-publish.mjs:24` | **No.** The workspace UUID is a database row. `client.ts` falls back to the unscoped `/api` path if unset — meaning a *missing* UUID degrades silently rather than erroring, so verify it explicitly. | `[VERIFIED: codebase]`; `.planning/codebase/INTEGRATIONS.md:65` |
| `MIXPOST_WEBHOOK_SECRET` | `src/app/api/webhooks/mixpost/route.ts` | **No** — generated by Mixpost, stored in its database, mirrored into Vercel. Survives the restore. Note the route **rejects a missing secret in every environment except development/test** (`INTEGRATIONS.md:213`), so a blank value fails closed, which is correct. | `[VERIFIED: codebase]` |
| `NEXT_PUBLIC_MIXPOST_WEB_URL` | `ReviewRoom.tsx:322`, `ConnectAccountDialog.tsx:41` | **No** — but note both have a **hardcoded fallback** to `https://mixpost.notrealsmart.com.au/mixpost`. Harmless while the domain is stable; a landmine if the domain ever changes. Flag for Phase 5. | `[VERIFIED: codebase]` |
| `NEXT_PUBLIC_MIXPOST_WORKSPACE_UUID` | `ConnectAccountDialog.tsx:43` | **No** — defaults to `''`. | `[VERIFIED: codebase]` |
| `next.config.ts` `images.remotePatterns` | `next.config.ts` | **No** — `{ protocol: 'https', hostname: '**.com.au' }` already covers `mixpost.notrealsmart.com.au`. | `[VERIFIED: codebase]` |
| `vercel.json` crons | `vercel.json` | **No change, but see Pitfall 1** — `/api/cron/publish-posts` runs `*/5 * * * *` and is the thing that can fail a post during the cutover window. | `[VERIFIED: codebase]` |
| `src/lib/mixpost/sync-draft.ts:POLL_MAX_SECONDS = 1800` | `sync-draft.ts:34` | **No** — but its comment says "on the VPS". If the new host is faster, this is now generous rather than tight. Leave it; a comment update is cosmetic. | `[VERIFIED: codebase]` |

**Bottom line for success criterion 3 ("nothing in NRS had to change beyond
configuration"): if the domain is preserved, the honest answer is that _no NRS value
changes at all_.** Not one environment variable, not one line of code. That is a stronger
outcome than the criterion asks for, and it is entirely contingent on keeping
`mixpost.notrealsmart.com.au`.

## Configuration Carry-Across (PUB-02)

Both PUB-02 faults are already fixed on the old host. **They are configuration, they live on
a machine being decommissioned, and a clean install reproduces both.** These go into the new
host's setup on day one, and into a verification step, not into a to-do list.

### Fault 1 — the 504 at 60 seconds

Host nginx had no `proxy_read_timeout`, so it defaulted to 60 s and gave up while the
container transcoded for up to 1000 s. New-host nginx (`/opt/elestio/nginx/`) needs, from
day one:

```nginx
client_max_body_size      2048M;   # matches container nginx and PHP
proxy_read_timeout        1200s;   # > the 1000s fastcgi_read_timeout inside the container
proxy_send_timeout        1200s;   # symmetric — a large chunk upload is also slow
proxy_request_buffering   off;     # stream the body through rather than spooling it
```

### Fault 2 — the progress bar that never moved

There were **zero Reverb environment variables**, so Mixpost told the browser to connect to
`localhost:8080` — which, from the owner's browser, is his own laptop. Required in
`/opt/mixpost/.env`:

```
REVERB_APP_ID=…      REVERB_APP_KEY=…      REVERB_APP_SECRET=…
REVERB_HOST=mixpost.notrealsmart.com.au
REVERB_PORT=443
REVERB_SCHEME=https
```

and in host nginx, the `/app` location proxying to `127.0.0.1:8080` with
`proxy_http_version 1.1`, `Upgrade` and `Connection "upgrade"` headers. Without the upgrade
headers the websocket handshake fails and the symptom looks identical to the original bug.

### The five upload layers (all must move together)

Any one left at a default blocks uploads (`docs/specs/nrs-mixpost-upload-limits.md`):

| Layer | Location on new host | Required value |
|---|---|---|
| Host nginx | `/opt/elestio/nginx/` | `client_max_body_size 2048M` |
| Container nginx | `overrides/nginx-default.conf` (`:ro` mount) | `client_max_body_size 2048M`, `fastcgi_read_timeout 1000` |
| Container PHP-FPM | `overrides/zzz-uploads.ini` (`:ro` mount) | `upload_max_filesize 2048M`, `post_max_size 2048M`, `memory_limit 1024M` |
| Laravel validator | `/opt/mixpost/.env` | `MIXPOST_MAX_VIDEO_FILE_SIZE=2048` — **defaults to 200 MB if unset regardless of nginx and PHP**, erroring with Mixpost's own typo `"The video must no be greater than 200 MB"` |
| Horizon supervisor | `overrides/horizon.php` (`:ro` mount) | `timeout => 3600`, `memory => 1024` |

Plus the chunking envs: `MIXPOST_CHUNKED_UPLOAD_THRESHOLD=50`,
`MIXPOST_CHUNKED_UPLOAD_SIZE=50`, `MIXPOST_MAX_IMAGE_FILE_SIZE=50`,
`MIXPOST_MAX_GIF_FILE_SIZE=50`.

### The iframe headers

The old host's nginx stripped `X-Frame-Options` and set a `frame-ancestors` CSP scoped to
NRS hosts, which is what allows `ReviewRoom.tsx` to embed the Mixpost edit screen at
95vw × 92vh. Reproduce it, or the Review tab's "Preview in Mixpost" silently renders a
blank frame. Note NRS itself sends `X-Frame-Options: SAMEORIGIN` on all its own routes
(`next.config.ts`) — that is NRS protecting itself and is unrelated; do not "fix" it.

**Verification, not assertion:** each of the five layers has a documented check command in
`docs/specs/nrs-mixpost-upload-limits.md`. Run all five on the new host and record the
output before the video benchmark.

## Common Pitfalls

### Pitfall 1 — The cutover can permanently fail a real post *(highest severity)*

**What goes wrong:** `/api/cron/publish-posts` runs every 5 minutes. It opens by marking any
post stuck in `publishing` for over 10 minutes as `failed` (lines 24–33). Worse, when Mixpost
is configured but unreachable, line 266 throws `'Mixpost configured but could not fetch
accounts. Will retry.'` — and the catch block at lines 279–285 immediately writes
`status: 'failed'`. **The comment says it will retry. The code does not retry. Nothing
drains the failure.** `[VERIFIED: codebase — src/app/api/cron/publish-posts/route.ts]`

**Why it happens:** the comment and the behaviour were written at different times and
nobody re-read them together.

**How to avoid:** cut over only in a window with zero rows from the Stage 0 query. If the
schedule offers no such window, the plan must add a step to temporarily disable the cron —
but note that disabling it means genuinely-due posts are delayed, which is a smaller harm
than being marked permanently failed.

**Warning signs:** any `scheduled_posts` row with `error` containing "could not fetch
accounts" or "Publishing timed out" and a timestamp inside the cutover window.

### Pitfall 2 — A new `APP_KEY` silently destroys all 17 grants

**What goes wrong:** Laravel encrypts sensitive column payloads with `APP_KEY`. A fresh
container generates a new one. The account rows restore perfectly, the UI lists 18 accounts,
and every single publish fails with a decryption or auth error.
**How to avoid:** copy `/opt/mixpost/.env` verbatim before first boot of the new container.
Never run `php artisan key:generate` on the new host.
**Warning signs:** accounts render but tokens fail; any `DecryptException` in the logs.

### Pitfall 3 — MySQL major-version drift on restore

**What goes wrong:** restoring an 8.0 dump into 8.4 or 9.x can fail on authentication
plugins, `utf8mb3` handling, or removed syntax — sometimes partially, leaving some tables
restored and some not.
**How to avoid:** pin the identical image tag recorded in Stage 0 step 2. Verify with
`SELECT VERSION()` on both hosts.
**Warning signs:** a restore that emits warnings and exits 0. Always check the row counts,
never the exit code.

### Pitfall 4 — Dangling `mixpost_media_id` pointers

**What goes wrong:** Supabase `media_items` caches Mixpost's numeric media IDs (migration
031, C-16). If Mixpost is ever rebuilt with an empty database instead of a restored one,
every cached ID points at nothing and every publish that reuses media fails on missing
media — while looking, from NRS, like a working system.
**How to avoid:** restore, do not rebuild. Verify with step 14.
**Warning signs:** publishes succeed for new media and fail for anything previously used.

### Pitfall 5 — Redis carried across with a poisoned queue

**What goes wrong:** a Horizon job mid-flight at dump time resumes on a host where the
container ID, file paths and possibly the volume contents differ. It fails, retries, and
fills the failed-jobs table.
**How to avoid:** `horizon:pause`, let in-flight jobs finish or expire, then start the new
host's Redis empty. Redis holds no durable state worth preserving here.

### Pitfall 6 — `:latest` is not a version

**What goes wrong:** the current host runs whatever `inovector/mixpost-pro-team:latest`
resolved to when it last pulled. The new host pulls a *newer* latest — possibly with a
changed container nginx default (which `overrides/nginx-default.conf` wholesale replaces, so
new upstream directives are silently dropped) or a changed `config/horizon.php` structure.
The upload-limits spec already documents this exact hazard and the `docker cp` + `diff`
procedure for re-syncing.
**How to avoid:** record and pin the running image **digest** in Stage 0. Upgrade
deliberately, after the migration is proven, as a separate change.

### Pitfall 7 — Verifying in the UI instead of the database

**What goes wrong:** the Mixpost account list renders from rows, not from live token
validity. Eighteen accounts appearing on screen proves eighteen rows exist, not that
seventeen tokens work.
**How to avoid:** the CRC comparison in Pattern 2, then the live API call in step 15, then a
real post in step 24. Three layers, because the first two can both pass while publishing is
broken.

### Pitfall 8 — Assuming the licence blocks the move (it does not)

Covered under Licence below. The risk here is the opposite of the usual one: a plan that
budgets days for a licence negotiation that is not required, or worse, one that changes the
domain to "make the licence tidy" and detonates every OAuth redirect URI.

### Correction to an inherited assumption

`OPTIONS-publishing-and-interface.md` §4 step 6 states that "scheduled posts publish with no
regulatory review at all". **That is now out of date.** `/api/cron/publish-posts` imports
`checkPublishAllowed` from `@/lib/agents/publish-gate` and runs it immediately before the
platform call, failing the post if the gate blocks (lines 13, 92–106)
`[VERIFIED: codebase]`. `PROJECT.md` records this as shipped in `6b9dd64`. This phase must
not "add" a gate that already exists, and must not remove it while moving hosts — the plan
should include a check that the gate still fires after cutover.

## Code Examples

### Consistent dump of the accounts database

```bash
# Source: MySQL 8.0 mysqldump semantics; --single-transaction gives a consistent
# InnoDB snapshot without blocking writes, --hex-blob protects the binary
# OAuth payloads from charset mangling.
docker exec mixpost-mysql-1 mysqldump \
  --single-transaction --quick --routines --triggers --events \
  --default-character-set=utf8mb4 --hex-blob \
  -u root -p"$MYSQL_ROOT_PASSWORD" mixpost \
  > "/tmp/mixpost-$(date -u +%Y%m%dT%H%M%SZ).sql"
sha256sum /tmp/mixpost-*.sql | tee /tmp/mixpost-dump.sha256
```

### Volume snapshot without stopping the world

```bash
# Source: standard Docker named-volume backup idiom. Pause Horizon first so no
# transcode is writing into the volume mid-tar.
docker exec mixpost-mixpost-1 php /var/www/html/artisan horizon:pause
sleep 30
docker run --rm -v mixpost_storage:/data -v /tmp:/backup alpine \
  tar czf "/backup/mixpost-storage-$(date -u +%Y%m%dT%H%M%SZ).tar.gz" -C /data .
```

### Proving the accounts survived, before DNS moves

```bash
# Source: this repository's own client contract —
# src/lib/mixpost/client.ts:74-79 documents the workspace-scoped path.
# /etc/hosts pins the licensed domain to the NEW host so TLS and the licence
# binding both still match while the world still resolves to the old one.
echo "<NEW_IP> mixpost.notrealsmart.com.au" | sudo tee -a /etc/hosts

curl -s -H "Authorization: Bearer $MIXPOST_API_TOKEN" \
  "https://mixpost.notrealsmart.com.au/api/$MIXPOST_WORKSPACE_UUID/accounts" \
  | jq '{total: length, authorised: [.[] | select(.authorized == true)] | length,
         by_provider: (group_by(.provider) | map({(.[0].provider): length}) | add)}'
# Expect: total 18, authorised 17,
#         {facebook_page:7, instagram:5, linkedin:3, youtube:2, tiktok:1}

sudo sed -i '' '/mixpost.notrealsmart.com.au/d' /etc/hosts   # always clean up
```

### Confirming all five upload layers on the new host

```bash
# Source: docs/specs/nrs-mixpost-upload-limits.md — the documented check set.
docker exec mixpost-mixpost-1 grep client_max_body_size /etc/nginx/sites-available/default
docker exec mixpost-mixpost-1 php-fpm8.3 -i | grep -E "upload_max_filesize|post_max_size|memory_limit"
docker exec mixpost-mixpost-1 env | grep MIXPOST_MAX
docker exec mixpost-mixpost-1 grep -A2 "'timeout'" /var/www/html/config/horizon.php
grep -E "client_max_body_size|proxy_read_timeout|proxy_request_buffering" /opt/elestio/nginx/conf.d/*.conf
```

## Licence — does Mixpost Pro permit moving hosts?

**Yes, on the evidence available, and the reason is that the licence is bound to a domain
rather than a machine.**

> "The Software License is always bound to one domain or one subdomain. If you want to run
> the Software on another domain or subdomain, you shall need an additional Software
> License." `[CITED: mixpost.app/terms-of-use]`

The terms also state the licence "expires one year after the payment of the Fee. If You have
purchased a LIFETIME Software License, the License never expires", and that updates are
included for one year `[CITED: mixpost.app/terms-of-use]`.

**What this means concretely:**

- Moving `mixpost.notrealsmart.com.au` from one server to another is **not** a licensed
  event. No new licence, no transfer request.
- The restriction that *does* exist — "You do not have the right to transfer the Software to
  third parties" — is about giving the software to someone else, not about relocating your
  own installation.
- **Changing the domain would require a second licence.** This is an independent, licence-level
  reason on top of the OAuth-redirect and webhook reasons why the domain must not move.

**Flagged for the owner, not assumed away:**

1. **Which licence tier was bought — annual or LIFETIME — was not verifiable from here.** If
   annual and past its year, the existing install keeps working but stops receiving updates.
   This does not block the migration; it does affect whether pinning the current image digest
   (Pitfall 6) is a temporary caution or a permanent state.
2. **Whether re-activation is required on a fresh container was not verifiable.** The terms
   describe domain binding, not an activation-count mechanism, and Inovector's docs note only
   that "A license code is required to activate Mixpost Pro… you will be prompted to enter it
   during installation" `[CITED: docs.inovector.com/books/mixpost-pro]`. Since the licence
   record lives in the database being restored, it should carry across — but **have the
   licence key to hand during Stage 1 in case the new container prompts for it.** Do not
   discover this at cutover.
3. If Inovector's activation turns out to be install-bound rather than domain-bound, a
   one-line support email resolves it. Budget the possibility; do not budget a negotiation.

**This is a question for the owner to confirm, not for the plan to assume.** He bought the
licence and knows which tier.

## State of the Art

| Old approach | Current approach | Impact |
|---|---|---|
| Unmanaged VPS + hand-run `docker compose` + Certbot cron | Managed container hosts that operate the VM for you (Elestio, Sliplane) or abstract it entirely (Fly, Railway, Render) | The "someone must patch this box" problem is now purchasable. It is the entire argument for spending ~$50 instead of ~$15. |
| PaaS assumed to be strictly better than a VM | PaaS request-duration and volume limits routinely disqualify media-processing workloads | DO App Platform's 100 s cap and total absence of volumes is the clearest case: a platform that is excellent for a web app is useless for this one. |
| Long-running work inside the web request | Queue it and poll (which NRS already does correctly for its own path via `/media/remote/initiate`) | NRS's server-side path is already modern. It is Mixpost's **browser upload** path that is synchronous, and that is not ours to change. |

**Deprecated / outdated in the inherited documents:**

- `OPTIONS-publishing-and-interface.md` §4 step 6 ("scheduled posts publish with no
  regulatory review at all") — superseded by `6b9dd64`; the gate is live. See Correction above.
- `sync-draft.ts:34`'s comment "on the VPS" — cosmetic once the VPS is gone.
- The `.bak` rollback files described in `nrs-mixpost-upload-limits.md` exist **only on the
  host being decommissioned**. Copy them or lose them.

## Environment Availability

| Dependency | Required by | Available | Version | Fallback |
|---|---|---|---|---|
| SSH access to the old VPS | Dump the database and volume | **Must confirm** | — | **None. This is the blocker.** Without it the 17 grants cannot be recovered and PUB-01 fails. |
| MySQL root password for the old host | `mysqldump` | **Must confirm** — in `/opt/mixpost/.env` on the VPS | — | None |
| `/opt/mixpost/.env` incl. `APP_KEY` | Decrypting the grants on the new host | **Must confirm** | — | None |
| Mixpost Pro licence key | Possible re-activation prompt | **Must confirm with owner** | — | Support email to Inovector |
| DNS control for `notrealsmart.com.au` | TTL lowering + cutover + rollback | Assumed yes (the domain is in use) `[ASSUMED]` | — | None |
| Vercel project access | Confirming no env change is needed | Yes | — | — |
| Elestio account | Provisioning | Not yet created | — | Fly.io `syd` (second choice) |
| `mysqldump`, `tar`, `scp`, `sha256sum` | Migration | Present on any Linux host | — | — |

**Missing dependencies with no fallback — these gate the phase:**

- **SSH + root access to 203.29.242.68.** The host is withdrawn from *use*, not necessarily
  from *access*. The plan must confirm access is still live before anything else. If it is
  not, this phase changes shape entirely and becomes "re-authorise 17 accounts by hand",
  which contradicts PUB-01. **Check this first.**
- **The old `APP_KEY`.** Without it the grants are ciphertext.

## Validation Architecture

`workflow.nyquist_validation` is not set in `.planning/config.json`, so it is treated as
enabled.

### Test framework

| Property | Value |
|---|---|
| Framework | Vitest (173 tests, 172 passing — `PROJECT.md`) |
| Config file | Not located this session — confirm before writing Wave 0 |
| Quick run | `npx vitest run <path>` |
| Full suite | `npx vitest run` |

**Honest limit:** this phase's real verification is operational, not unit-testable. No test
can prove 17 OAuth grants survived a database restore. The Stage 3 gate *is* the test, and it
must be written into the plan as explicit, evidenced steps with recorded output — not as a
checkbox.

### Phase requirements → test map

| Req | Behavior | Test type | Command | Exists? |
|---|---|---|---|---|
| PUB-01 | 18 accounts / 17 authorised present on the new host before DNS moves | manual-gated, evidence recorded | Stage 3 steps 13 + 15 | ❌ Wave 0 |
| PUB-01 | A real post reaches Facebook, Instagram and LinkedIn from the new host | manual, end-to-end | Stage 5 step 24 | ❌ Wave 0 |
| PUB-01 | No NRS env value changed | static check | `grep -rn "MIXPOST_" src/` diffed against pre-migration | ✅ evidence in this document |
| PUB-02 | ≥490 MB `.mov` uploads and transcodes in ≤160 s | manual benchmark, timed | Stage 3 step 16 | ❌ Wave 0 |
| PUB-02 | Progress bar moves (Reverb reachable) | manual observation | Stage 3 step 16(b) | ❌ Wave 0 |
| PUB-02 | All five upload layers at 2048M / 3600 | scripted check | Code Examples §"five upload layers" | ✅ commands documented |
| Regression | Webhook HMAC still verifies | unit | `npx vitest run src/lib/webhooks/mixpost-signature.test.ts` | ✅ exists |
| Regression | Compliance gate still fires on the scheduled publisher | unit | needs a test asserting `checkPublishAllowed` is called in `publish-posts` | ❌ Wave 0 — see below |

### Wave 0 gaps

- [ ] A written, recorded verification checklist for Stage 3 (steps 13–17), with the actual
      output pasted into the phase folder. Without recorded evidence, "we checked" is a claim.
- [ ] `src/app/api/cron/publish-posts/*.test.ts` — asserts `checkPublishAllowed` is invoked
      before the platform call. Cheap, and it stops a future host move quietly removing the
      gate. Arguably Phase 3's (GUARD-01) job; if Phase 3 will cover it, note it and skip.
- [ ] Locate the Vitest config and confirm the run command before relying on it.

## Security Domain

`security_enforcement` is not set to `false`, so this section is included.

### Applicable ASVS categories

| ASVS category | Applies | Standard control |
|---|---|---|
| V2 Authentication | No — no new auth surface | — |
| V3 Session Management | No | — |
| V4 Access Control | Yes | The Mixpost admin UI is reachable at a public domain. Confirm it is not left open during provisioning — a half-configured Mixpost with restored OAuth grants and no login is a live publishing capability exposed to the internet. |
| V5 Input Validation | No change | Existing HMAC verification on the webhook is unchanged. |
| V6 Cryptography | **Yes — the critical one** | `APP_KEY` and the encrypted OAuth payloads. Copy verbatim; never regenerate; never commit to git. The dump file contains 17 live social-account credentials in encrypted form — treat it as a secret at rest and in transit. |
| V7 Error Handling / Logging | Yes | Do not paste dump output, `.env` contents or account rows into logs, commit messages or the phase folder. |
| V10 Malicious Code | Yes | Pin the image digest (Pitfall 6) rather than pulling an unreviewed `:latest` into a host holding live credentials. |
| V12 File Handling | Yes | 2 GB uploads with a 1000 s server-side ffmpeg pass. Unchanged from today, but the limits are being deliberately re-applied, so re-apply them exactly — not "roughly". |
| V14 Configuration | **Yes** | `X-Frame-Options` is being deliberately stripped on the Mixpost host to permit NRS embedding. The compensating control is the `frame-ancestors` CSP scoped to NRS hosts. **Carry the CSP across with the stripping. Stripping the header without the CSP leaves Mixpost clickjackable by anyone.** |

### Threat patterns for this stack

| Pattern | STRIDE | Mitigation |
|---|---|---|
| The `.sql` dump — 17 social credentials — left in `/tmp`, in a repo, or transferred unencrypted | Information disclosure | `scp`/`rsync` over SSH only; delete both artefacts from both hosts after verification; never commit; never place in `.planning/`. |
| Old host decommissioned with disks unwiped | Information disclosure | Keep it 7 days for rollback, then destroy the volume through the provider, not just `rm`. |
| Clickjacking via `X-Frame-Options` stripping | Tampering | `frame-ancestors` CSP scoped to NRS hosts, applied in the same nginx change. |
| Mixpost reachable before it is locked down | Elevation of privilege | Provision behind a firewall or a temporary hostname; do not expose the licensed domain until Stage 4. |
| `APP_KEY` regenerated or leaked | Information disclosure / DoS | Copy verbatim, treat as a secret, and never echo it into a terminal transcript. |

## Assumptions Log

| # | Claim | Section | Risk if wrong |
|---|---|---|---|
| A1 | Elestio can target Sydney for a 4 vCPU / 8 GB VM at ~$50–70/mo | Standard Stack | Sydney availability is cited for Lightsail and Linode; the **price is not**. If it comes back at $150 the recommendation reopens. **Get a real quote before planning tasks depend on it.** |
| A2 | The Mixpost accounts table is `mixpost_accounts` with an `authorized` flag and a `data` blob | Pattern 2, Code Examples | The verification SQL fails to run. Low harm — read the real schema off the container. But the plan must not hard-code these names. |
| A3 | `MIXPOST_API_TOKEN` is a database-resident Sanctum token that survives a restore | NRS-side settings | If it is derived from `APP_KEY` or is host-bound, the token must be reissued and Vercel updated. **Step 15's live curl proves or disproves this in 30 seconds — do it early.** |
| A4 | Restoring Mixpost's database restores its webhook registration and secret | Runtime State Inventory | Webhook stops confirming publishes; posts stick in `publishing` and get failed by the 10-minute sweep. Step 17 catches it. |
| A5 | The Mixpost Pro licence does not require re-activation on a new container | Licence | A blocked Stage 1. Mitigated by having the key to hand. |
| A6 | SSH and root access to the withdrawn VPS is still available | Environment Availability | **Phase-fatal.** Without it, PUB-01 cannot be met as written. Check before anything else. |
| A7 | DigitalOcean has a Sydney (SYD1) region | Standard Stack (alternatives) | Only affects the rejected Droplet alternative. DO's own pricing page did not list Sydney when fetched; Lightsail and Linode Sydney are both cited, so the recommendation does not depend on this. |
| A8 | Fly.io's `idle_timeout` can be set to ≥1200 s | Alternatives | Only matters if Elestio is rejected. **Verify before adopting Fly.** |
| A9 | The 492 MB / 160 s benchmark was measured post-fix on the old 2 vCPU / 2 GB host | Sizing, Stage 3 | If it was measured on different hardware the ≤160 s target is mis-calibrated. Confirm with whoever ran it. |
| A10 | Vitest is the test runner and the suite runs with `npx vitest run` | Validation Architecture | Wave 0 commands are wrong. Trivially checked. |

## Open Questions

1. **Is SSH/root access to 203.29.242.68 still live?**
   - Known: the host is withdrawn from use and is still serving publishing today, so it is
     running.
   - Unclear: whether credentials are to hand.
   - **Recommendation: make this the first task in the plan.** Everything downstream assumes it.

2. **What does Elestio actually charge for 4 vCPU / 8 GB in Sydney?**
   - Known: from $11/mo, per-service hourly, all-inclusive `[CITED: elest.io/pricing]`.
   - Unclear: the figure for this size and region.
   - Recommendation: a `checkpoint:human-verify` task before provisioning. If it exceeds
     ~$80/mo, put Fly.io `syd` and a managed-Droplet-with-an-operator option back to the owner.

3. **Annual or LIFETIME licence, and does a fresh container re-prompt?**
   - Recommendation: ask the owner. Have the key available at Stage 1 regardless.

4. **Is there a genuinely quiet publishing window?**
   - Known: the cron runs every 5 minutes and hard-fails on an unreachable Mixpost.
   - Unclear: the actual schedule density across eleven projects.
   - Recommendation: run the Stage 0 query during planning, not during execution.

5. **Does anything besides the Mixpost iframe need a >5-minute HTTP response?**
   - Known: NRS's own path polls and does not `[VERIFIED: codebase]`.
   - Unclear: whether Mixpost's chunked-upload finaliser is the only synchronous consumer.
   - Recommendation: the Stage 3 step 16 benchmark answers this empirically. If it passes on
     the chosen host, the question is closed.

## Sources

### Primary (official vendor documentation, fetched this session)

- `docs.digitalocean.com/products/app-platform/details/limits/` — volumes unsupported, 600 s
  file-upload timeout, 4 GiB filesystem cap
- `docs.railway.com/networking/public-networking/specs-and-limits` — 15 min with data
  transfer, 5 min without, 5 min body upload, websockets exempt
- `fly.io/docs/reference/configuration/` — `http_service.http_options.idle_timeout`,
  `[mounts]`, process groups
- `render.com/docs/regions` — five regions, no Australia
- `render.com/docs/deploy-mysql` — MySQL on Render Disks, snapshot-corruption warning,
  `/var/lib/mysql` mount requirement
- `render.com/docs/web-services` — persistent disks, TLS, custom domains, websockets
- `docs.hetzner.com/cloud/general/locations/` — six locations, four network zones, no Oceania
- `elest.io/pricing` — from $11/mo, inclusions, support tiers
- `docs.elest.io/books/cicd-pipelines/page/deploy-own-docker-compose-image-using-elestio-custom-docker-compose`
- `docs.elest.io/books/cicd-pipelines/page/deploy-docker-compose-apps-wordpress-mysql-redis-keycloak`
- `docs.elest.io/books/security/page/nginx-advanced-configuration` — nginx at
  `/opt/elestio/nginx/`, SSH access
- `mixpost.app/terms-of-use` — domain-bound licence, one domain/subdomain, expiry and updates

### Secondary (search-corroborated)

- `elest.io/deploy-on-aws-lightsail`, `elest.io/deploy-on-linode` — Sydney among supported regions
- `blog.railway.com/p/launch-week-01-regions`, `docs.railway.com/platform/railway-metal` —
  US / Europe / Southeast Asia only
- `sliplane.io/european-docker-hosting-provider`, `sliplane.io/docker-hosting` — Germany and
  Finland, from €9/mo
- `community.fly.io/t/request-timeouts-on-fly-io/5653` — 60 s default, Fly staff comment
- `digitalocean.com/community/questions/how-to-resolve-the-100s-request-timeout-of-digital-ocean-s-app`
  — 100 s hard cap, cannot be changed
- `docs.inovector.com/books/mixpost-pro`, `github.com/inovector/MixpostProTeamApp` — licence
  activation prompt, official image

### Repository evidence (strongest in this document)

- `src/app/api/cron/publish-posts/route.ts` — 10-min stuck sweep (24–33), compliance gate
  (13, 92–106), hard-fail on unreachable Mixpost (266, 279–285)
- `src/lib/mixpost/client.ts` — 23 workspace-scoped call sites, unscoped fallback
- `src/lib/mixpost/sync-draft.ts` — async remote-initiate + poll, `POLL_MAX_SECONDS = 1800`
- `src/components/agency/studio/ReviewRoom.tsx:322`,
  `src/components/agency/studio/accounts/ConnectAccountDialog.tsx:41-43` — hardcoded domain fallbacks
- `next.config.ts` — `**.com.au` `remotePatterns`, `X-Frame-Options: SAMEORIGIN` on NRS's own routes
- `vercel.json` — cron schedules
- `docs/specs/nrs-mixpost-upload-limits.md`, `.planning/intel/constraints.md` C-06/C-07/C-15/C-16,
  `.planning/intel/context.md`, `.planning/intel/owner-decisions.md` §D-A,
  `.planning/OPTIONS-publishing-and-interface.md` §2–4

## Metadata

**Confidence breakdown:**

| Area | Level | Reason |
|---|---|---|
| Platform disqualifications (DO App Platform, Railway, region gaps) | MEDIUM–HIGH | Direct quotes from vendor documentation. The strongest external evidence here. |
| Recommended host (Elestio, Sydney) | MEDIUM | Capability and region cited; **price is assumed**. |
| NRS-side settings | HIGH | Read out of this repository line by line. |
| Migration procedure | MEDIUM | Standard MySQL/Docker practice, but the Mixpost schema names are assumed. |
| Rollback and TTL | HIGH | Mechanically straightforward; the only real risk is not lowering the TTL early. |
| Configuration carry-across (PUB-02) | HIGH | Fully documented in `nrs-mixpost-upload-limits.md` and corroborated by C-07. |
| Licence | MEDIUM | Terms quoted directly; the tier and re-activation behaviour are open questions for the owner. |
| Sizing | MEDIUM | Extrapolated from C-06's measured 382 s / 141 MB on 2 vCPU / 2 GB. Directionally certain, precisely uncertain. |

**Research date:** 2026-07-30
**Valid until:** 2026-08-29 for the migration mechanics; **2026-08-13 for the vendor limits
and prices** — platform timeouts and pricing change without notice, and three of this
document's conclusions rest on them.

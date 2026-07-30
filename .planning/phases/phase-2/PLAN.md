---
phase: phase-2
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/app/api/cron/publish-posts/publish-gate.test.ts
  - .planning/phases/phase-2/MIGRATION-EVIDENCE.md
  - docs/specs/nrs-mixpost-host-runbook.md
autonomous: false
requirements: [PUB-01, PUB-02]

user_setup:
  - service: elestio
    why: "Managed Docker-Compose host in Sydney to replace the withdrawn BinaryLane VPS. Only the owner can create an account and enter payment."
    env_vars: []
    dashboard_config:
      - task: "Create an Elestio account and add a payment method"
        location: "elest.io — Sign up"
      - task: "Approve the monthly cost for a 4 vCPU / 8 GB Sydney target"
        location: "Elestio configurator (price surfaced by task T5)"
  - service: godaddy-dns
    why: "The A record for mixpost.notrealsmart.com.au lives at GoDaddy (nameservers ns01/ns02.domaincontrol.com, confirmed by live lookup). TTL lowering and the cutover are both DNS edits."
    env_vars: []
    dashboard_config:
      - task: "Lower the TTL on the mixpost A record from 600 to 300 seconds"
        location: "GoDaddy → My Products → Domains → notrealsmart.com.au → DNS → Manage Zones"
      - task: "Change the mixpost A record to the new host's IP address"
        location: "same screen, at cutover only"
  - service: mixpost-pro
    why: "A fresh container may prompt for the licence key on first boot. The licence is LIFETIME and domain-bound; the domain does not change, so no new licence is needed — but the key must be to hand."
    env_vars: []
    dashboard_config:
      - task: "Have the Mixpost Pro licence key available (original purchase email from Inovector)"
        location: "Owner's email / password manager"

must_haves:
  truths:
    - "A post scheduled in NRS publishes to Facebook, Instagram and LinkedIn from the new host, and no account was signed in again (PUB-01, per D-A)."
    - "The Mixpost account list on the new host reads 18 accounts, 17 authorised, with the TeleScribe Facebook Page still de-authorised — the same state as the old host, not a repaired one."
    - "A video of at least 490 MB uploads through the Mixpost UI on the new host and finishes in 160 seconds or less (PUB-02)."
    - "The owner watches a progress bar move during that upload rather than waiting on a silent screen (PUB-02)."
    - "No NRS environment variable and no NRS publishing code changed value to point at the new host."
    - "The scheduled publisher still runs the shared compliance gate before every platform call, and still reconciles in-flight posts by asking Mixpost rather than waiting for a webhook."
    - "Pointing the DNS record back at 203.29.242.68 restores the previous system within one TTL."
  artifacts:
    - ".planning/phases/phase-2/MIGRATION-EVIDENCE.md — recorded command output for every gate, not claims"
    - "docs/specs/nrs-mixpost-host-runbook.md — the new host's layout, override files and check commands"
    - "src/app/api/cron/publish-posts/publish-gate.test.ts — asserts the compliance gate runs before the platform call"
    - "An out-of-git migration vault holding the .env (with APP_KEY), the MySQL dump, the storage tarball and the .bak files"
  key_links:
    - "APP_KEY copied verbatim from the old /opt/mixpost/.env → the new host's .env. A regenerated key turns all 17 OAuth grants into unreadable ciphertext while the UI still lists 18 accounts."
    - "mixpost.notrealsmart.com.au stays the hostname → the licence binding, every Meta/LinkedIn/Google OAuth redirect URI, the webhook registration and all six NRS env values keep working untouched."
    - "The restored MySQL database → Supabase media_items.mixpost_media_id and scheduled_posts.metadata.mixpost.post_uuid are cached pointers into it. A rebuilt-empty Mixpost turns every one of them into a dangling pointer."
    - "Host nginx strips X-Frame-Options AND sets frame-ancestors in the same change → NRS can embed the Review iframe without leaving Mixpost clickjackable."
    - "The five upload layers move together (host nginx, container nginx, PHP-FPM, the Laravel validator env var, the Horizon supervisor timeout) → any one left at its default blocks uploads."
---

<objective>
Move Mixpost Pro off the withdrawn BinaryLane VPS (203.29.242.68) onto a managed host
the owner has not refused, preserving the seventeen authorised social accounts without
a single re-authorisation, and carrying the two already-diagnosed upload faults across
as day-one configuration rather than rediscovering them.

Purpose: the withdrawn host is still the only thing publishing for eleven Australian
businesses. Every day it keeps serving is a day the owner's own instruction (D-A) is
unmet and a day the seventeen OAuth grants sit on a machine nobody is patching.

Output: Mixpost serving from a Sydney managed host at the unchanged domain
`mixpost.notrealsmart.com.au`, with recorded evidence for every gate, and a DNS
record that can be pointed back inside ten minutes.

**This plan is a migration, not a build.** Treat every undocumented difference between
the old host and the new one as a defect. The failure mode here is not "we could not
build it" — it is "we rebuilt it slightly differently and lost something load-bearing".

**Execution shape.** The tasks below are grouped into six waves. **Run each wave as a
separate execution session.** Waves 0 and 3 are the largest and will each consume most
of a context window on their own. Do not attempt the whole phase in one sitting.

**Corrections to RESEARCH.md, verified in this repository this session — do not
re-derive these:**

1. **The test runner is not Vitest.** `package.json` line 10 defines
   `"test": "tsx --test $(find src -name '*.test.ts' -print)"` — Node's own test runner
   via tsx. There is no `vitest.config.*` in the repository. Research assumption A10 is
   wrong; every test command in this plan uses `npm test`.
2. **The DNS TTL is already 600 seconds**, not the 3600/86400 the research warned about.
   `dig` returns `mixpost.notrealsmart.com.au. 600 IN A 203.29.242.68`, and the
   nameservers are `ns01.domaincontrol.com` / `ns02.domaincontrol.com` (GoDaddy). The
   Stage-0 TTL wait is ten minutes, not hours. Lowering to 300 is still worth doing,
   but it is now cheap insurance rather than a schedule driver.
3. **Pitfall 1 is half-fixed and the surviving half is narrower than described.** The
   in-flight sweep no longer fails posts at ten minutes — `route.ts:48-89` now asks
   Mixpost for each post's real state via `fetchMixpostPost` and leaves anything
   unreachable alone for the next tick. What still bites is the **due-post** path:
   `route.ts:322` throws when Mixpost is configured but unreachable and the catch at
   `route.ts:340` writes `status: 'failed'`. So a post that comes *due* during the
   cutover window is still permanently failed. The quiet window is still mandatory —
   for that reason and only that reason.
4. **Two open research questions are settled by the owner.** SSH/root to 203.29.242.68
   is live (used today). The Mixpost Pro licence is **LIFETIME** and domain-bound, so
   the move needs no new licence provided the domain does not change. Assumptions A5
   and A6 are closed; do not re-ask.
</objective>

<execution_context>
@$HOME/.claude/gsd-core/workflows/execute-plan.md
@$HOME/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/phase-2/RESEARCH.md
@.planning/intel/owner-decisions.md
@docs/specs/nrs-mixpost-upload-limits.md
@src/app/api/cron/publish-posts/route.ts
@src/lib/mixpost/client.ts
@src/lib/agents/publish-gate.ts
</context>

<owner_protocol>
The owner is a clinical and product person, not a developer. He must never be asked to
open a terminal, read JSON, or inspect developer tools.

Five tasks in this plan need him — T4, T6, T7, T18, T20. Each is written as a
`checkpoint:` with the exact screen, the exact button, and plain English. Everything
else is executed by Claude over SSH and against Supabase.

When a checkpoint is reached, present only what he must decide or click. Do not paste
command output at him. Recorded evidence goes into `MIGRATION-EVIDENCE.md`, not into
the conversation.
</owner_protocol>

<secrets_handling>
This phase handles seventeen live social-account credentials.

- The MySQL dump and the old `.env` (containing `APP_KEY`) are **secrets at rest and in
  transit**. Hold them in a local vault directory outside the repository — use the
  session scratchpad, not `.planning/` and not `/tmp` on a shared host.
- Never commit the dump, the tarball, the `.env`, `APP_KEY`, the MySQL root password or
  the Mixpost licence key. `MIGRATION-EVIDENCE.md` records **counts, checksums, CRCs and
  timings** — never payloads, never key material.
- Never echo `APP_KEY` into a terminal transcript. Copy it host-to-host with `scp`.
- Delete the dump and the tarball from both hosts once the migration is settled (T21).
</secrets_handling>

<tasks>

<!-- ══════════════════════ WAVE 0 — TRUTH CAPTURE ══════════════════════ -->
<!-- The old host keeps serving throughout. Nothing is provisioned yet.  -->

<task type="auto">
  <name>T1: Confirm access to the old host and record the account census baseline</name>
  <files>.planning/phases/phase-2/MIGRATION-EVIDENCE.md</files>
  <precondition>SSH with root or sudo to 203.29.242.68 succeeds, and the MySQL root password is readable from /opt/mixpost/.env on that host. The owner confirms both were used today. If SSH fails, HALT — without it the seventeen grants cannot be recovered and PUB-01 cannot be met as written.</precondition>
  <action>
    SSH to 203.29.242.68. Do three things and stop.

    First, discover the real Mixpost schema rather than assuming it. RESEARCH.md
    assumption A2 guesses `mixpost_accounts` with an `authorized` flag and a `data`
    blob; Mixpost Pro's schema is not published, so read it: run `SHOW TABLES` in the
    Mixpost database and `SHOW CREATE TABLE` on whichever table holds social accounts.
    Record the real table name and the real column names holding the authorisation flag,
    the provider and the encrypted token payload. Every later query in this plan uses
    the names discovered here, not the guessed ones.

    Second, run the account census against those real names and record the output
    verbatim. Two queries: a grouped count by provider with a rollup total, and a
    per-row integrity line giving id, provider, name, the authorisation flag,
    LENGTH() of the encrypted payload and CRC32() of the encrypted payload, ordered
    by id. The per-row CRC list is the baseline the new host is compared against in T8
    — it is the only evidence that can distinguish a byte-exact restore from a
    plausible-looking one.

    Third, record `SELECT VERSION()` from MySQL. The new host pins this exact major
    version; a restore into a different one can fail partially and still exit zero.

    Write all of it into `.planning/phases/phase-2/MIGRATION-EVIDENCE.md` under a
    heading for this task. Record counts, lengths and CRCs — never the payload column
    itself, which is live credential material.
  </action>
  <verify>
    <automated>grep -c 'CRC32\|token_crc' .planning/phases/phase-2/MIGRATION-EVIDENCE.md</automated>
    Expected: at least 1. Then read the file and confirm the census section lists 18
    account rows with 17 carrying the authorisation flag set, the provider split
    (7 Facebook Page / 5 Instagram / 3 LinkedIn / 2 YouTube / 1 TikTok), a recorded
    MySQL version string, and the real table and column names discovered on the host.
  </verify>
  <done>The real Mixpost schema names are known, the 18-row / 17-authorised baseline with per-row payload CRCs is recorded in MIGRATION-EVIDENCE.md, and the MySQL version is pinned. Research assumptions A2 and A6 are closed with evidence.</done>
</task>

<task type="auto">
  <name>T2: Capture the old host's configuration into a vault the migration can rebuild from</name>
  <files>.planning/phases/phase-2/MIGRATION-EVIDENCE.md, docs/specs/nrs-mixpost-host-runbook.md</files>
  <action>
    The old host is the only copy of several things this phase needs. Pull all of them
    into the local vault directory before anything is provisioned.

    Copy off the host: `/opt/mixpost/docker-compose.yml`; the output of
    `docker compose config` (the resolved form, which is what actually runs);
    `/opt/mixpost/.env` in full; all three override files from `/opt/mixpost/overrides/`
    (`zzz-uploads.ini`, `nginx-default.conf`, `horizon.php`); the host nginx site file
    at `/etc/nginx/sites-available/mixpost`; and every timestamped `.bak` file the
    upload-limits spec lists — the `.env`, `docker-compose.yml` and nginx backups under
    `/opt/mixpost/` and `/etc/nginx/sites-available/`, plus the original container nginx
    default and PHP ini backups under `/tmp/`. Those `.bak` files exist nowhere else and
    are the documented rollback material for the upload configuration.

    Pin the images. Run `docker image inspect` on the running `mixpost-pro-team`
    container's image and on the MySQL image, and record the **digests**, not the tags.
    The new host pulls by digest. `:latest` is not a version, and a newer latest can ship
    a changed container nginx default that `nginx-default.conf` silently replaces
    wholesale, or a restructured `config/horizon.php` that `horizon.php` silently
    replaces wholesale.

    Record the current host nginx values for the five carry-across directives so the new
    host is configured from measured values rather than from this plan's prose:
    proxy_read_timeout, proxy_send_timeout, send_timeout, proxy_connect_timeout,
    proxy_request_buffering and client_max_body_size; the `/app` location block with its
    websocket upgrade headers and timeouts; and the two iframe directives — the
    X-Frame-Options removal and the frame-ancestors CSP naming the NRS hosts.

    Then write `docs/specs/nrs-mixpost-host-runbook.md`: the target layout under
    /opt/mixpost, what each override file does, the five upload layers with their
    required values, and the check command for each layer. This is the document that
    replaces tribal knowledge held on a machine about to be switched off. Keep the
    secrets in the vault; the runbook names variables, never values.

    Everything with credential material — the `.env`, the `.bak` copies of it, the
    MySQL root password — goes to the vault only. `MIGRATION-EVIDENCE.md` records the
    inventory (which files were captured, their sizes, their SHA-256) and the image
    digests, which are not secret.
  </action>
  <verify>
    <automated>test -f docs/specs/nrs-mixpost-host-runbook.md &amp;&amp; grep -v '^#' docs/specs/nrs-mixpost-host-runbook.md | grep -c 'client_max_body_size'</automated>
    Expected: exit 0 and a count of at least 2 (host nginx layer and container nginx
    layer). Then confirm by listing the vault directory that it holds: docker-compose.yml,
    the resolved compose config, .env, three override files, the host nginx site file,
    and at least four .bak files. Confirm MIGRATION-EVIDENCE.md records two image digests
    in `sha256:` form.
  </verify>
  <done>Every configuration artefact that exists only on the withdrawn host is in the vault with a recorded SHA-256, both image digests are pinned in sha256 form, and the runbook documents the five upload layers with a check command each.</done>
</task>

<task type="auto" tdd="true">
  <name>T3: Lock the compliance gate and the reconciliation into a test before the host moves</name>
  <files>src/app/api/cron/publish-posts/publish-gate.test.ts</files>
  <behavior>
    - The scheduled publisher calls `checkPublishAllowed` before it calls the platform,
      and a blocked verdict marks the post failed with the gate's reason rather than
      publishing it.
    - An in-flight post whose remote state is still working is left alone rather than
      being marked failed — the reconciliation asks, it does not assume.
  </behavior>
  <action>
    RESEARCH.md's Wave 0 list asks for a test that asserts the compliance gate runs on
    the scheduled publisher. Write it now, before the host moves, so a later change to
    the publishing path cannot quietly remove the gate while everyone is looking at
    infrastructure.

    Use the repository's actual runner: Node's test runner via tsx, per `package.json`
    line 10. Import from `node:test` and `node:assert`, matching the style of the
    existing `src/lib/webhooks/mixpost-signature.test.ts`. Do not introduce Vitest.

    Assert two behaviours against `src/app/api/cron/publish-posts/route.ts`. The gate
    behaviour: `checkPublishAllowed` is invoked, and when it returns a disallowed
    verdict the post is written as failed carrying the gate's own reason, with no
    platform call made. The reconciliation behaviour: an in-flight post whose remote
    lookup reports still-working is left untouched for the next tick.

    Stub the Supabase admin client and the Mixpost client at module boundaries. Keep
    the test hermetic — it must not reach the network, and it must pass identically on
    the old host and the new one, because its whole purpose is to be indifferent to
    which host is serving.

    If mocking the route's module graph proves disproportionate, assert against the
    smallest extracted unit instead, but do not weaken the assertion to a smoke test —
    a test that passes when the gate is deleted is worse than no test.
  </action>
  <verify>
    <automated>npm test 2>&amp;1 | tail -20</automated>
    Expected: the new test file's assertions appear as passing. The suite's pre-existing
    `brand-portfolio` failure (documented in PROJECT.md) is expected and unrelated —
    confirm the failure count did not increase beyond that one.
  </verify>
  <done>`npm test` runs the new file and its assertions pass; deleting the `checkPublishAllowed` call from the publisher makes the test fail. The suite has no new failures beyond the one pre-existing brand-portfolio assertion.</done>
</task>

<task type="checkpoint:human-action" gate="blocking">
  <what-built>Nothing yet — this is a change only you can make, on a website Claude cannot log into.</what-built>
  <how-to-verify>
    Right now, if we ever need to undo the move, it takes about ten minutes for the
    internet to notice. Halving that costs one small change.

    1. Go to **godaddy.com** and sign in.
    2. Click **My Products**, find **notrealsmart.com.au**, and click **DNS** next to it.
    3. In the list of records, find the row where the **Name** column says `mixpost`.
       (Its Type will say `A` and its Value will be `203.29.242.68`.)
    4. Click the pencil / **Edit** icon on that row.
    5. Change **TTL** from `600 seconds` (it may display as "Custom" or "10 minutes")
       to `300 seconds` — choose "Custom" and type `300` if there is no 300 option.
    6. Click **Save**.
    7. **Do not change anything else on that row.** The Value must stay `203.29.242.68`
       for now. We change it later, and only when everything else is proven.

    Then tell Claude it is done.

    If GoDaddy will not accept 300, leave it at 600 and say so — the plan still works,
    the undo just takes ten minutes instead of five.
  </how-to-verify>
  <resume-signal>Type "TTL done" — or "TTL stayed at 600" if it would not accept the change.</resume-signal>
</task>

<task type="auto">
  <name>T5: Get the real Elestio price for a 4 vCPU / 8 GB Sydney target</name>
  <files>.planning/phases/phase-2/MIGRATION-EVIDENCE.md</files>
  <action>
    RESEARCH.md's ~$50–70/month is marked `[ASSUMED]` — Elestio does not publish a price
    for this size in this region, and assumption A1 says the recommendation reopens if
    it comes back materially higher. Get the real number before the owner is asked to
    approve anything.

    Use Elestio's public pricing configurator to price a **Custom Docker Compose**
    service at 4 vCPU / 8 GB RAM, on both Sydney-capable targets the research cites:
    AWS Lightsail `ap-southeast-2` and Linode Sydney. Record the monthly figure for each,
    what support level is included at that price, and whether backups and TLS are
    included or billed separately. Reach the configurator with the Browser Harness skill
    per the global crawling ladder — start with `new_tab`, not `goto_url`.

    While there, price the same shape at 2 vCPU / 4 GB as a fallback data point. Do not
    recommend it — the old 2 vCPU / 2 GB host took 382 seconds to transcode a 141 MB
    file and this phase's benchmark is 160 seconds for 492 MB. It exists so the owner
    sees the shape of the trade rather than a single take-it-or-leave-it number.

    Also price the Fly.io `syd` fallback: three machines (Mixpost, MySQL, Redis) with
    volumes, at equivalent total CPU and memory. The owner cannot choose a fallback he
    has not been shown a price for.

    Record all figures with the date fetched. Vendor pricing changes without notice and
    RESEARCH.md marks its vendor claims stale after 2026-08-13.
  </action>
  <verify>
    <automated>grep -c 'Elestio\|Lightsail\|Linode\|Fly.io' .planning/phases/phase-2/MIGRATION-EVIDENCE.md</automated>
    Expected: at least 4. Then read the section and confirm it carries a dated monthly
    figure for: Elestio 4 vCPU / 8 GB on Lightsail Sydney, the same on Linode Sydney,
    Elestio 2 vCPU / 4 GB, and Fly.io syd across three machines — each with what is
    included at that price.
  </verify>
  <done>MIGRATION-EVIDENCE.md carries four dated, real monthly prices with their inclusions. The ~$50–70 assumption is either confirmed or replaced with a measured figure.</done>
</task>

<task type="checkpoint:decision" gate="blocking">
  <decision>Which host runs your publishing, and what it costs each month</decision>
  <context>
    Your Mixpost — the thing that actually posts to Facebook, Instagram, LinkedIn and
    YouTube — currently runs on the server you said you no longer want to use. It costs
    about $15 a month and somebody has to keep patching it. That somebody has been you,
    indirectly, and that is the problem being solved.

    The seventeen signed-in accounts move with it. You will not sign in to anything again.

    [Claude fills in the real prices from T5 here before showing this to the owner.]
  </context>
  <options>
    <option id="managed-sydney">
      <name>Managed host in Sydney (recommended)</name>
      <pros>Nobody ever asks you to patch a server again — updates, backups, security certificates and monitoring are what you are buying. It sits in Sydney, so your big video uploads do not cross the Pacific twice. It runs the exact same setup you have now, so nothing gets rebuilt or lost.</pros>
      <cons>Costs more per month than the server you are leaving. That difference is the price of never administering a box again.</cons>
    </option>
    <option id="cheaper-platform">
      <name>The cheaper platform (Fly.io, Sydney)</name>
      <pros>Less per month, still in Sydney.</pros>
      <cons>Your setup has to be rebuilt as three separate pieces instead of one, which is more places for something to go wrong during the move. One of its limits — how long it will let a big video upload sit there processing — is not published anywhere, so we would have to test it before trusting it.</cons>
    </option>
    <option id="smaller-managed">
      <name>The same managed host, but smaller and cheaper</name>
      <pros>Closer to what you pay now.</pros>
      <cons>Likely slower on video. The old server took over six minutes on a 141 MB file; the target is under three minutes on a file three times that size. This option risks recreating the upload frustration this phase exists to fix.</cons>
    </option>
  </options>
  <resume-signal>Reply with one of: managed-sydney, cheaper-platform, smaller-managed — or ask for a different number.</resume-signal>
</task>

<task type="checkpoint:human-action" gate="blocking">
  <what-built>Nothing yet. Claude cannot create an account in your name or enter your card, so this one is yours. It is the last thing you need to do before the new host exists.</what-built>
  <how-to-verify>
    Two things, both short.

    **1. Create the hosting account.**
    - Go to the sign-up page for the host you chose in the last step (Claude will give
      you the exact link).
    - Sign up with your usual email and add a payment method.
    - Do **not** create a server or pick a plan — Claude does that part. You are only
      creating the account and the payment method.
    - Then give Claude access: on Elestio that is **Account → Team → Invite**, or
      generate an API key under **Account → API**. Claude will tell you which and paste
      the exact menu path.

    **2. Find your Mixpost licence key.**
    - Search your email for "Mixpost" or "Inovector" — the purchase confirmation has a
      licence key in it. It looks like a long string of letters and numbers.
    - Paste it to Claude, or say where to find it.
    - Your licence is lifetime and tied to the web address, not to the server, so moving
      is allowed and you are not buying anything again. The new installation may simply
      ask to see the key once, and we would rather have it ready than discover it is
      missing halfway through.

    Tell Claude when both are done.
  </how-to-verify>
  <resume-signal>Type "account ready" and paste the licence key (or tell Claude where it is).</resume-signal>
</task>

<!-- ══════════════════ WAVE 1 — TRACER: SAME DATA, NEW HOST ══════════════════ -->
<!-- The old host is still live and still serving. Nothing has been switched.  -->

<task type="tracer">
  <name>T8: New host serving the restored database — one path, proven at the layer that cannot lie</name>
  <files>docs/specs/nrs-mixpost-host-runbook.md, .planning/phases/phase-2/MIGRATION-EVIDENCE.md</files>
  <precondition>The owner has completed T7 (hosting account exists, Claude has access, licence key is to hand) and chosen a host in T6.</precondition>
  <reversibility rating="reversible">The new host is built alongside the old one and touches no live traffic. Nothing here is visible to the outside world until DNS moves in T18, and the old host is untouched throughout.</reversibility>
  <action>
    This is the thin end-to-end slice: provision, deploy, restore, prove. It touches
    every layer the phase will modify and answers the one question that, if answered
    wrong, ends the phase — does a database restored onto different hardware, decrypted
    by a copied APP_KEY, still hold seventeen usable OAuth grants?

    Provision the target chosen in T6, in Sydney, at 4 vCPU / 8 GB. Recreate
    `/opt/mixpost/` as the deployment path — every runbook, this plan and the
    upload-limits spec all reference it, and changing it costs nothing to avoid.

    Deploy the captured `docker-compose.yml` unchanged, with the three override files
    bind-mounted read-only exactly as captured, and the three named volumes (mysql,
    redis, storage). Publish `127.0.0.1:8585:80` and `127.0.0.1:8080:8080` as the old
    host does — 8080 is Reverb and the progress bar depends on it. **Pin both images by
    the sha256 digests recorded in T2.** Do not pull `:latest`; a newer image can ship a
    changed container nginx default or a restructured horizon config, both of which the
    override files replace wholesale and would therefore silently drop.

    Copy the captured `.env` verbatim, before the container's first boot. **APP_KEY
    above all else** — Laravel encrypts the account payloads with it, a fresh container
    generates its own, and the failure is silent: the UI lists 18 accounts and every
    single publish fails on decryption. Never run `php artisan key:generate` on this
    host. Confirm the Reverb block came across intact (`REVERB_APP_ID`, `REVERB_APP_KEY`,
    `REVERB_APP_SECRET`, `REVERB_HOST=mixpost.notrealsmart.com.au`, `REVERB_PORT=443`,
    `REVERB_SCHEME=https`, `REVERB_SERVER_HOST=0.0.0.0`, `REVERB_SERVER_PORT=8080`) —
    these are the fix for the progress bar that never moved, and they exist only on the
    machine being decommissioned.

    Keep the host unreachable from the public internet at this stage — firewall it, or
    leave it on its provider hostname only. A half-configured Mixpost holding seventeen
    live social-account credentials must not be exposed while it is being set up.

    Now move the data. On the old host, pause Horizon and let in-flight jobs settle
    before touching anything, so no transcode is writing into the volume mid-capture.
    Dump MySQL with a single-transaction consistent snapshot, quick mode, routines,
    triggers and events, utf8mb4 as the default character set, and **hex-blob encoding**
    — the OAuth payloads are binary and a non-hex dump can mangle them across character
    sets. Take the storage volume as a tar from a throwaway alpine container mounting
    the named volume. SHA-256 both artefacts on the old host.

    Transfer both over SSH into the vault and then to the new host, and **re-verify both
    SHA-256 sums on arrival**. A truncated dump that still restores cleanly is the
    nastiest failure available here.

    Restore into the new MySQL — the same major version pinned in T1. Untar the storage
    volume and confirm the ownership matches what the container's web user expects; the
    tar preserves numeric UIDs, so check they line up rather than assuming. Start Redis
    **empty** — it holds only the Horizon queue, and carrying a half-finished job onto a
    host with different container IDs and paths produces a job that fails forever.

    Then prove it, at the database layer, because the UI cannot be trusted for this: the
    account list renders from rows, not from live token validity, so eighteen rows on
    screen proves eighteen rows exist and nothing more. Re-run T1's two census queries
    against the new database using the same real column names, and compare row by row.
    Required: identical row count, identical authorised split, identical per-provider
    counts, and **identical payload length and CRC32 for every single row**. One CRC
    mismatch halts the migration — investigate, do not proceed and do not "fix" the row.

    Record the comparison in MIGRATION-EVIDENCE.md as two columns, old and new, so the
    match is legible rather than asserted.
  </action>
  <verify>
    <automated>grep -c 'sha256:' .planning/phases/phase-2/MIGRATION-EVIDENCE.md</automated>
    Expected: at least 2 (the two pinned image digests, plus the dump and tarball
    checksums). Then, the substantive check — run the per-row census query against the
    new host's database and diff its output against the T1 baseline recorded in
    MIGRATION-EVIDENCE.md. Required result: a zero-line diff. Every id, provider,
    authorisation flag, payload length and payload CRC32 identical.
  </verify>
  <done>The new host runs Mixpost from digest-pinned images with the copied APP_KEY, the restored database's account census diffs to zero lines against the old host's baseline, Redis started empty, and both transferred artefacts verified their SHA-256 on arrival. The old host is still serving live traffic, untouched.</done>
</task>

<!-- ═══════════ WAVE 2 — REPRODUCE THE CONFIGURATION (PUB-02) ═══════════ -->
<!-- Both upload faults are already fixed on the old host. They are        -->
<!-- configuration, on a machine being switched off. A clean install       -->
<!-- reproduces both faults. This wave stops that.                         -->

<task type="auto">
  <name>T9: Reproduce the host nginx layer — timeouts, body size, websocket, iframe headers</name>
  <files>docs/specs/nrs-mixpost-host-runbook.md, .planning/phases/phase-2/MIGRATION-EVIDENCE.md</files>
  <precondition>T8 completed — the new host is running and the database is restored. On Elestio the managed reverse proxy is editable at /opt/elestio/nginx/ over SSH; confirm that path exists on the provisioned instance before writing to it.</precondition>
  <action>
    The old host's nginx acquired four separate fixes today. All four are on a machine
    about to be decommissioned, and none of them arrive with a fresh install. Apply them
    from the measured values captured in T2 — day one, not as a follow-up.

    **The 504 at sixty seconds.** Host nginx had no read timeout, so it used the 60-second
    default and hung up while the container was still transcoding, for up to 1000 seconds.
    Set proxy_read_timeout, proxy_send_timeout and send_timeout to 1200 seconds — above the
    container's own 1000-second fastcgi timeout — with proxy_connect_timeout at 75 seconds.
    Turn proxy_request_buffering off so a large body streams through rather than spooling
    to disk first. Set client_max_body_size to 2048M, matching the container nginx and PHP
    layers; a mismatch at this layer rejects the upload before any of the others see it.

    **The progress bar that never moved.** Add the `/app` location proxying to
    127.0.0.1:8080 with proxy_http_version 1.1, the Upgrade and Connection "upgrade"
    headers, and 3600-second timeouts. Without the upgrade headers the websocket handshake
    fails and the symptom is indistinguishable from the original bug — a silent bar. The
    Reverb environment variables from T8 tell the browser where to connect; this location
    block is what lets the connection complete.

    **The iframe.** NRS embeds the Mixpost edit screen in the Review tab at 95vw × 92vh.
    Strip X-Frame-Options **and** set a frame-ancestors CSP naming 'self' plus both NRS
    hosts, in the same change. These two are one control, not two: stripping the header
    alone removes the clickjacking protection and puts nothing in its place, which would
    leave a publishing interface holding seventeen live credentials framable by anyone.
    Leave NRS's own X-Frame-Options SAMEORIGIN in `next.config.ts` alone — that is NRS
    protecting itself and is unrelated.

    Route TLS for mixpost.notrealsmart.com.au through the managed proxy. The certificate
    cannot be issued until DNS points here, so expect that step to complete at cutover;
    everything else in this task is configurable now.

    Validate the nginx configuration and reload. Record the applied values in the runbook
    and the verification output in MIGRATION-EVIDENCE.md.
  </action>
  <verify>
    <automated>ssh NEW_HOST "grep -rhv '^[[:space:]]*#' /opt/elestio/nginx/conf.d/*.conf | grep -cE 'proxy_read_timeout[[:space:]]+1200|client_max_body_size[[:space:]]+2048M|proxy_request_buffering[[:space:]]+off|Connection[[:space:]]+\"upgrade\"|frame-ancestors'"</automated>
    Expected: 5 or more — one match per directive, with comment lines filtered out so
    documentation prose cannot satisfy the check. Then run `nginx -t` on the new host and
    require "syntax is ok" and "test is successful". Record both outputs.
  </verify>
  <done>All five timeout and body-size directives, the /app websocket upgrade block, and both iframe directives are live in the new host's nginx with comments excluded from the count; `nginx -t` passes; the applied values are recorded in the runbook.</done>
</task>

<task type="auto">
  <name>T10: Confirm all five upload layers on the new host before anything is uploaded</name>
  <files>.planning/phases/phase-2/MIGRATION-EVIDENCE.md</files>
  <action>
    Any one of the five layers left at its default blocks uploads, and the failure
    messages point at the wrong layer — the Laravel validator in particular defaults to
    200 MB regardless of what nginx and PHP allow, and reports it with Mixpost's own
    typo in the message. Run the documented check for each layer and record the output.
    Do not infer a layer from the layer next to it.

    Layer one, host nginx: already verified in T9 — carry the recorded value forward.

    Layer two, container nginx: read client_max_body_size and fastcgi_read_timeout from
    the container's site config. Required 2048M and 1000. This file is a wholesale
    replacement of the image's default, so also diff it against the image's current
    default and record any directive the newer image added that the override drops —
    this is the concrete hazard behind pinning the digest.

    Layer three, PHP-FPM: read upload_max_filesize, post_max_size and memory_limit from
    the running PHP-FPM configuration inside the container. Required 2048M, 2048M and
    1024M. The override loads after the image's own ini by alphabetical ordering in
    conf.d, so confirm the effective value, not the file contents.

    Layer four, the Laravel validator: read the MIXPOST_MAX and MIXPOST_CHUNKED
    environment variables from inside the container. Required MIXPOST_MAX_VIDEO_FILE_SIZE
    2048, MIXPOST_MAX_IMAGE_FILE_SIZE 50, MIXPOST_MAX_GIF_FILE_SIZE 50,
    MIXPOST_CHUNKED_UPLOAD_THRESHOLD 50, MIXPOST_CHUNKED_UPLOAD_SIZE 50.

    Layer five, the Horizon supervisor: read the timeout and memory from the container's
    horizon config, and confirm the running workers actually carry the timeout — inspect
    the worker processes, because a config file value that never reached a respawned
    worker is the exact shape of the original bug. Required timeout 3600 and memory 1024.

    Record all five outputs verbatim in MIGRATION-EVIDENCE.md. A recorded value is
    evidence; "checked" is a claim.
  </action>
  <verify>
    <automated>grep -v '^[[:space:]]*#' .planning/phases/phase-2/MIGRATION-EVIDENCE.md | grep -cE '2048M|MIXPOST_MAX_VIDEO_FILE_SIZE=2048|3600|1024M'</automated>
    Expected: at least 5, one per layer. Then read the recorded section and confirm each
    of the five layers has its own verbatim command output — not a summary line. Confirm
    the container-nginx diff against the image default is recorded, even if empty.
  </verify>
  <done>All five upload layers are confirmed at their required values on the new host with verbatim command output recorded, the running Horizon workers carry the 3600-second timeout, and any directive drift between the image's nginx default and the override is documented.</done>
</task>

<!-- ════════ WAVE 3 — THE VERIFICATION GATE (PUB-01 AND PUB-02 PROOF) ════════ -->
<!-- Everything below happens BEFORE DNS moves. Nothing here may be skipped.   -->
<!-- The old host is still serving live traffic throughout this wave.          -->

<task type="auto">
  <name>T11: Prove the accounts, the API token and the workspace UUID over the real API</name>
  <files>.planning/phases/phase-2/MIGRATION-EVIDENCE.md</files>
  <action>
    T8 proved the rows arrived. This proves the API layer above them works, and it
    settles research assumption A3 — whether MIXPOST_API_TOKEN is a database-resident
    token that survived the restore, or something host-bound that must be reissued and
    pushed to Vercel. Thirty seconds of curl answers a question the whole cutover
    depends on.

    Add a hosts-file entry on the machine running the check, pinning
    mixpost.notrealsmart.com.au to the new host's IP. This is deliberate: it keeps the
    licensed domain in play, so TLS and the domain-bound Mixpost licence both still
    match, while the rest of the world continues resolving to the old host. Do not use
    a different hostname for this — a different hostname may present as unlicensed and
    would tell you nothing useful.

    Call the workspace-scoped accounts endpoint with the existing MIXPOST_API_TOKEN and
    MIXPOST_WORKSPACE_UUID, exactly as `src/lib/mixpost/client.ts` does. Require: 18
    accounts total, 17 with the authorisation flag true, and the provider split
    7 Facebook Page / 5 Instagram / 3 LinkedIn / 2 YouTube / 1 TikTok. The de-authorised
    TeleScribe Facebook Page must still read as de-authorised — that state is preserved,
    not repaired. Repairing it here would mask the very condition PUB-03 exists to
    surface in Phase 1.

    Note that `client.ts` falls back to an unscoped `/api` path when the workspace UUID
    is unset, so a missing UUID degrades silently rather than erroring. Confirm the
    scoped path returned the accounts, not the fallback.

    Remove the hosts entry as soon as the check completes — always, and immediately. A
    forgotten hosts entry on the machine doing the cutover verification is how someone
    later "confirms" the live site while looking at a host the world cannot reach.

    Record the response counts in MIGRATION-EVIDENCE.md. Never record the tokens.
  </action>
  <verify>
    <automated>grep -A6 'T11' .planning/phases/phase-2/MIGRATION-EVIDENCE.md | grep -cE '18|17'</automated>
    Expected: at least 1. Then read the recorded section and confirm it states, from the
    live API response against the new host: total 18, authorised 17, and the five
    per-provider counts. Confirm the hosts-file entry was removed — re-resolve the
    hostname and require the old IP, 203.29.242.68.
  </verify>
  <done>The new host's API returns 18 accounts / 17 authorised with the correct provider split using the unchanged token and workspace UUID; assumption A3 is closed — no NRS environment value needs reissuing. The hosts-file entry is removed and the hostname resolves to the old host again.</done>
</task>

<task type="auto">
  <name>T12: Prove the cached Mixpost pointers in Supabase still resolve</name>
  <files>.planning/phases/phase-2/MIGRATION-EVIDENCE.md</files>
  <action>
    Supabase caches Mixpost's own identifiers in two places: `media_items.mixpost_media_id`
    and `mixpost_media_uuid` (migration 031), and `scheduled_posts.metadata.mixpost.post_uuid`,
    which is the draft-sync idempotency key. Both are pointers into the Mixpost database
    that was just restored. They are valid only because the database was restored rather
    than rebuilt — and if they ever dangle, publishes fail on missing media while NRS
    looks, from every screen, like a working system.

    Select at least three `media_items` rows carrying a non-null `mixpost_media_id` and
    at least three `scheduled_posts` rows carrying a `metadata.mixpost.post_uuid`,
    preferring recent ones. For each, confirm the corresponding row exists in the
    restored Mixpost database. Query the restored database directly rather than through
    the API — this is a referential check, and the database is the layer that answers it.

    If any pointer fails to resolve, stop. A dangling pointer means the restore was
    partial, which the exit code of a restore will not tell you.

    Record which rows were checked, by id, and the result for each.
  </action>
  <verify>
    <automated>grep -A10 'T12' .planning/phases/phase-2/MIGRATION-EVIDENCE.md | grep -ciE 'resolved|media_id'</automated>
    Expected: at least 3. Then read the recorded section and confirm at least six
    pointers were checked by id — three media, three posts — and that every one resolved
    in the restored database.
  </verify>
  <done>At least three cached media pointers and three cached post pointers from Supabase resolve against the restored Mixpost database, each recorded by id. The restore is proven referentially intact, not merely row-complete.</done>
</task>

<task type="auto">
  <name>T13: The video benchmark — 490 MB in 160 seconds, with the progress bar moving</name>
  <files>.planning/phases/phase-2/MIGRATION-EVIDENCE.md</files>
  <precondition>T9 and T10 completed — all five upload layers and the host nginx timeouts are live on the new host, otherwise this benchmark measures the wrong thing.</precondition>
  <action>
    This is PUB-02's proof and the single test that eliminated three candidate hosts.
    Mixpost transcodes a browser upload synchronously inside the HTTP request, so this
    measures whether the new host will hold one silent HTTP response open long enough
    for a two-pass ffmpeg run.

    Pin the licensed hostname to the new host with a hosts-file entry again, so the
    upload traverses the real domain, the real TLS and the real licence binding.

    Upload a `.mov` of at least 490 MB through the Mixpost UI — ideally the same
    492 MB ProRes file benchmarked on the old host today, which is the only way the
    comparison is like for like. Time it wall-clock from the moment the upload starts
    to the moment the media is ready.

    Three requirements, all of which must hold:

    (a) It completes. No 504, no rejection at any of the five layers, no
    MaxAttemptsExceeded from a Horizon worker.

    (b) The progress indicator moves during the upload. This proves Reverb is reachable
    over the websocket — the environment variables from T8 and the `/app` upgrade block
    from T9 working together. A completed upload with a frozen bar means the websocket
    handshake failed, which looks identical to the original bug and must be fixed before
    cutover, not after.

    (c) Wall-clock time of 160 seconds or less — the benchmark measured on the old
    2 vCPU / 2 GB host after today's fixes. Slower on 4 vCPU / 8 GB means something is
    wrong, not merely slow: check whether ffmpeg is actually using the available cores
    and whether the container has the memory it was given. Fix it before cutover.
    RESEARCH.md flags (assumption A9) that the hardware the 160-second figure was
    measured on is not independently confirmed — record the new host's specification
    alongside the timing so the comparison is auditable either way.

    Remove the hosts entry immediately afterwards. Record the file size, the file codec,
    the wall-clock seconds, whether the bar moved, and the host specification.
  </action>
  <verify>
    <automated>grep -A12 'T13' .planning/phases/phase-2/MIGRATION-EVIDENCE.md | grep -ciE 'seconds|MB'</automated>
    Expected: at least 2. Then read the recorded section and require: a file size of
    490 MB or more, a wall-clock figure of 160 seconds or less, an explicit statement
    that the progress indicator moved, and the new host's vCPU and RAM. Any of the three
    requirements unmet blocks the cutover.
  </verify>
  <done>A video of at least 490 MB uploaded and transcoded on the new host in 160 seconds or less with a moving progress indicator, and the measurement is recorded next to the host specification. PUB-02 is proven before anything is switched.</done>
</task>

<task type="auto">
  <name>T14: Prove the publisher's reconciliation and compliance gate still work against the new host</name>
  <files>.planning/phases/phase-2/MIGRATION-EVIDENCE.md</files>
  <action>
    Two mechanisms in NRS were changed in this repository today and both must be shown
    to still work against the new host — before the cutover, not discovered afterwards.

    **The reconciliation.** The scheduled publisher no longer waits for a webhook. For
    each post stuck in `publishing`, it asks Mixpost for that post's real state via
    `fetchMixpostPost` (`route.ts:48-89`) and only marks a post failed when the publisher
    itself reports failure, or when twenty minutes pass with no usable post id. This was
    built because MIXPOST_WEBHOOK_SECRET had never been set and seven posts that
    published perfectly were recorded as failures. Prove it against the new host: with
    the hosts-file entry in place, create a throwaway draft through the normal NRS draft
    path so a `post_uuid` is written, then exercise the reconciliation lookup against the
    new host and confirm it returns that post's real state rather than nothing. Delete
    the throwaway afterwards.

    **The webhook, separately.** The webhook registration and its HMAC secret live in
    Mixpost's own database and came across with the restore. Trigger a webhook by
    creating and deleting a throwaway draft and confirm NRS's `/api/webhooks/mixpost`
    logged a 200. A 403 means the secret drifted; a 404 means the path drifted. Note the
    publisher no longer depends on this, so a failure here is a defect to record and fix,
    not a cutover blocker — the reconciliation covers it either way. Record which of the
    two is true.

    **The compliance gate.** `checkPublishAllowed` runs immediately before every platform
    call (`route.ts:148`) and this phase must neither add it nor lose it. T3's test
    already asserts this in code. Here, confirm it at runtime: exercise the publisher
    against the new host and confirm the gate executed on the path taken. Record the
    evidence.

    Also confirm no NRS environment value changed. Diff the MIXPOST_* and
    NEXT_PUBLIC_MIXPOST_* names referenced in the source against the pre-migration set,
    and record that the values are untouched. Success criterion 3 — "nothing in NRS had
    to change beyond configuration" — is met more strongly than it asks: if the domain is
    preserved, no NRS value changes at all.
  </action>
  <verify>
    <automated>npm test 2>&amp;1 | tail -20 &amp;&amp; grep -rn "MIXPOST_" src/ --include=*.ts -l | wc -l</automated>
    Expected: the suite passes with only the one pre-existing brand-portfolio failure,
    and the count of files referencing MIXPOST_* matches the pre-migration count.
    Then read MIGRATION-EVIDENCE.md and confirm it records: the reconciliation lookup
    returned a real state from the new host; the webhook delivery status code; and that
    the compliance gate executed.
  </verify>
  <done>The reconciliation returns real post state from the new host, the webhook's status code is recorded with its meaning, the compliance gate is confirmed firing at runtime as well as in T3's test, and no NRS environment value or source reference changed.</done>
</task>

<!-- ═══════════════════════ WAVE 4 — CUTOVER ═══════════════════════ -->
<!-- Only reached when every gate in Wave 3 passed with recorded evidence. -->

<task type="auto">
  <name>T15: HARD GATE — re-verify the quiet window and the account census immediately before DNS moves</name>
  <files>.planning/phases/phase-2/MIGRATION-EVIDENCE.md</files>
  <precondition>Every task T8 through T14 completed with its evidence recorded in MIGRATION-EVIDENCE.md. This gate is the last thing that runs before the owner is asked to change DNS.</precondition>
  <action>
    Two checks, both re-run now regardless of when they last passed, because both
    describe a moment rather than a state.

    **The quiet window.** The cutover must land when no post is due. The publisher's
    in-flight sweep is now safe — it asks rather than assumes — but the **due-post** path
    is not: when Mixpost is configured and unreachable, `route.ts:322` throws and the
    catch at `route.ts:340` writes the post as failed. The comment says it will retry;
    the code does not retry, and nothing drains the failure. A post that falls due during
    the DNS propagation window is permanently failed and the owner's real content does
    not go out.

    Query Supabase for `scheduled_posts` rows with status in ('scheduled','publishing')
    and `scheduled_at` inside the next four hours. **Require zero rows.** The window was
    open at planning time; it is not assumed to still be open now.

    If rows exist, do not proceed and do not improvise. Two options, in order: wait for
    the next genuinely empty window, or temporarily disable the publish cron in
    `vercel.json` for the duration — which delays genuinely-due posts, a smaller harm
    than marking them permanently failed. Take the choice to the owner if the wait is
    more than a few hours.

    **The census, once more.** Re-run T1's per-row query on both hosts and diff. If more
    than a few hours have elapsed since T8's restore, the old host has continued serving
    and its database has moved on — in that case, re-dump and re-restore the delta now,
    then diff again. A stale restore silently loses whatever published in between, and
    the loss is invisible until someone looks for a post that is not there.

    Then stop the old host's Horizon workers, so nothing new is written to a database
    about to be abandoned and the two databases cannot diverge during the window. Leave
    the old host otherwise running — it is the rollback.

    Record: the quiet-window row count, the timestamp, the census diff result, and
    confirmation that the old workers are stopped.
  </action>
  <verify>
    <automated>grep -A8 'T15' .planning/phases/phase-2/MIGRATION-EVIDENCE.md | grep -ciE 'zero rows|0 rows|census'</automated>
    Expected: at least 1. The substantive gate: the recorded Supabase query returns zero
    rows, timestamped within the hour, and the re-run per-row census diffs to zero lines
    between the two hosts. Either failing halts the cutover — do not proceed to T16.
  </verify>
  <done>Zero posts are due in the next four hours as of a timestamp within the hour, the account census still diffs to zero lines between the two hosts, and the old host's Horizon workers are stopped. The cutover is cleared to proceed.</done>
</task>

<task type="checkpoint:human-action" gate="blocking">
  <what-built>
    Everything is ready and tested. Your new server in Sydney is running your Mixpost,
    with all seventeen signed-in accounts already in place — checked account by account
    against the old one, and they match exactly. A large video has already been uploaded
    to it successfully, with the progress bar working.

    The only thing left is to tell the internet where to find it. That is one line on the
    GoDaddy page you edited earlier, and Claude cannot log in as you to change it.
  </what-built>
  <how-to-verify>
    1. Go to **godaddy.com** and sign in.
    2. Click **My Products**, find **notrealsmart.com.au**, click **DNS**.
    3. Find the row where **Name** is `mixpost` — the same row you edited before.
    4. Click the pencil / **Edit** icon.
    5. Change **Value** from `203.29.242.68` to the new address Claude gives you.
       Change nothing else — leave Name, Type and TTL exactly as they are.
    6. Click **Save**.
    7. Tell Claude immediately that you have saved it, so it can start watching.

    **If anything looks wrong afterwards, say so straight away.** Undoing this is the
    same six steps with the old address `203.29.242.68` typed back in, and it takes
    about five minutes to take effect. The old server is still running and untouched
    for exactly this reason — nothing has been switched off.

    You do not need to do anything else. Claude watches the next hour.
  </how-to-verify>
  <resume-signal>Type "DNS changed" — or "rollback" at any point in the next week if something is wrong.</resume-signal>
</task>

<task type="auto">
  <name>T17: Watch the cutover — TLS, accounts, the publisher, the gate and the iframe</name>
  <files>.planning/phases/phase-2/MIGRATION-EVIDENCE.md</files>
  <precondition>The owner has confirmed the DNS record now points at the new host's IP.</precondition>
  <reversibility rating="reversible">Rollback is a single DNS edit back to 203.29.242.68, effective within one TTL — 300 seconds if T4 succeeded, 600 otherwise, plus resolver caching slop. This remains true only while the old host stays running and DNS-detached, which T19 enforces for seven days.</reversibility>
  <action>
    Confirm propagation first: resolve mixpost.notrealsmart.com.au from more than one
    resolver and require the new IP. Do not start the checks below against a stale answer.

    Then watch, in this order, recording each:

    TLS issues cleanly on the new host for the licensed domain. There is a brief window
    while the certificate is obtained — the managed host's automatic TLS needs DNS
    pointing at it first. If it does not complete within a few minutes, that is a
    rollback trigger, not a thing to wait out.

    The accounts endpoint returns 18 with 17 authorised — now over real DNS, with no
    hosts-file entry anywhere. This is the same check as T11 but against the world's
    view rather than a pinned one.

    The next `/api/cron/publish-posts` tick logs no failures, and specifically no post
    carries an error containing the unreachable-accounts message or a publishing timeout
    with a timestamp inside the cutover window. Query `scheduled_posts` for any row whose
    error is non-null and whose updated_at falls in the window — require none. This is
    the direct check for the Pitfall-1 failure mode.

    Mixpost's admin surface requires login and is not left open. It now holds seventeen
    live social-account credentials on a public domain; confirm an unauthenticated
    request does not reach an authenticated surface.

    The Review tab's "Preview in Mixpost" iframe renders the Mixpost edit screen rather
    than a blank frame — which proves T9's header work survived the certificate issuance
    and the managed proxy's own defaults did not reassert X-Frame-Options.

    If any check fails: roll back. Tell the owner in one plain sentence that you are
    putting it back, then give him the same six GoDaddy steps with 203.29.242.68 as the
    value. Do not attempt a fix-forward during the window — the old host is intact and
    the cost of returning to it is five minutes.
  </action>
  <verify>
    <automated>dig +short mixpost.notrealsmart.com.au</automated>
    Expected: the new host's IP, and not 203.29.242.68. Then confirm each recorded check:
    TLS valid for the licensed domain; accounts endpoint 18/17 over public DNS; zero
    `scheduled_posts` rows with a non-null error inside the cutover window; the admin
    surface requires authentication; the Review iframe renders content.
  </verify>
  <done>Public DNS resolves to the new host, TLS is valid, the accounts endpoint returns 18/17 with no hosts-file entry in play, no scheduled post recorded an error during the window, the admin surface is authenticated, and the Review iframe renders.</done>
</task>

<!-- ═══════════════════════ WAVE 5 — SETTLE ═══════════════════════ -->

<task type="checkpoint:human-verify" gate="blocking">
  <what-built>
    Your publishing has moved to a new server in Sydney. Nothing about how you use NRS
    has changed — same screens, same accounts, same drafts. Two things are worth you
    seeing with your own eyes, because they are the two things this whole move was for.
  </what-built>
  <how-to-verify>
    **1. Post something real.** In NRS, schedule or publish one genuine post to Facebook,
    Instagram and LinkedIn — whichever brand you like. Then open those three apps and
    confirm it is actually there.

    That is the test. Not a green tick in NRS — content visible on three platforms. You
    did not sign in to anything to make that happen, and that is the point.

    **2. Upload a big video.** Open the Studio, go to the Review tab, and drop in a large
    video — the bigger the better, ideally the one that used to fail.

    Watch the progress bar. It should move. Before today it either sat frozen or the
    upload died with an error after about a minute. It should now finish in under three
    minutes for a half-gigabyte file.

    Tell Claude what you saw for both. If the post did not appear on a platform, or the
    bar did not move, say exactly which one — that is a real result, not a complaint,
    and the old server is still sitting there ready to take over.
  </how-to-verify>
  <resume-signal>Describe what happened — or type "approved" if the post appeared on all three platforms and the video uploaded with the bar moving.</resume-signal>
</task>

<task type="auto">
  <name>T19: Settle — backups running, TTL restored, evidence recorded, old host preserved</name>
  <files>.planning/phases/phase-2/MIGRATION-EVIDENCE.md, docs/specs/nrs-mixpost-host-runbook.md</files>
  <precondition>The owner confirmed in T18 that a real post reached Facebook, Instagram and LinkedIn and that a large video uploaded with a moving progress bar.</precondition>
  <action>
    Close the phase properly rather than declaring it closed.

    Confirm the managed host's automated backups are actually running and have produced
    at least one restorable snapshot — not that the feature is enabled, but that a
    snapshot exists with a timestamp. The entire argument for paying more than the old
    host's fifteen dollars is that this is somebody else's job now; confirm it is being
    done.

    Restore the DNS TTL to its normal value if T4 lowered it. The migration is settled
    and a 300-second TTL is a small ongoing cost for no remaining benefit.

    **Do not decommission the old host.** Leave 203.29.242.68 running and DNS-detached
    for a minimum of seven days. It is the rollback, and until the `.bak` files are
    confirmed present in the vault it is also the only copy of the original upload
    configuration. Set a reminder for the owner rather than a task for him. After seven
    days, destroy the volume through the provider rather than deleting files — the disk
    holds seventeen social-account credentials.

    Delete the MySQL dump and the storage tarball from both hosts now that the migration
    is proven. They are seventeen live credentials in a file. The vault copy stays under
    the secrets handling rules above until the seven days elapse.

    Finish the runbook: the new host's address, its provider and region, its
    specification, where nginx lives on it, where the override files live, and the five
    check commands. Anyone reading it in six months should be able to change the upload
    limit without reading this plan.

    Record in MIGRATION-EVIDENCE.md the final state and the two figures that matter for
    Phase 5's decision to retire this host entirely: the real monthly cost and the
    measured transcode benchmark.

    Update ROADMAP.md's progress table for Phase 2 and note in STATE.md that the
    withdrawn VPS is DNS-detached but retained until the seven days elapse — so a later
    session does not helpfully delete it.
  </action>
  <verify>
    <automated>grep -v '^[[:space:]]*#' docs/specs/nrs-mixpost-host-runbook.md | grep -cE 'MIXPOST_MAX_VIDEO_FILE_SIZE|client_max_body_size|3600'</automated>
    Expected: at least 3. Then confirm: a backup snapshot exists on the managed host with
    a timestamp; the dump and tarball are gone from both hosts; the old host is still
    running and DNS-detached; MIGRATION-EVIDENCE.md records the real monthly cost and the
    measured benchmark; ROADMAP.md and STATE.md are updated.
  </verify>
  <done>A timestamped backup snapshot exists on the new host, the TTL is restored, the dump and tarball are deleted from both hosts, the old host is running and detached with a seven-day retention note in STATE.md, and the runbook is complete enough to change the upload limit without this plan.</done>
</task>

</tasks>

<rollback>
## Rollback

**Rollback is one DNS edit. Nothing else.** Every ordering decision in this plan exists
to keep that true.

| Question | Answer |
|---|---|
| **Trigger** | Any of: the accounts endpoint returns fewer than 18; a publish fails with an authorisation error; the video benchmark regresses past 160 seconds; TLS fails to issue on the new host; the Review iframe renders blank; a scheduled post records an error inside the cutover window. |
| **Action** | The owner changes the `mixpost` A record back to `203.29.242.68` at GoDaddy — the same six steps as T16, with the old value typed in. |
| **How long** | One TTL plus resolver slop: **under five minutes** if T4 lowered the TTL to 300, under ten at the recorded 600. Both are short only because the record was already at 600 rather than the registrar default. |
| **What is lost** | Anything published through the new host between cutover and rollback, if the old database is then treated as authoritative. Keep the window short and check `scheduled_posts` for rows that flipped to `published` during it. |
| **What makes rollback impossible** | Decommissioning the old host — hence the seven-day retention in T19. Also: leaving the old host's Horizon workers running after cutover, which lets the two databases diverge. T15 stops them for exactly this reason. |
| **Non-DNS rollback** | None worth having. There is no floating IP in play and introducing one is a second migration. |

**TTL note, measured not assumed.** `dig` returns a 600-second TTL on the current
record and GoDaddy nameservers. The old TTL must fully expire after any lowering before
the cutover, or resolvers holding the previous value keep it for its full duration
regardless of what the new record says. At 600 seconds that wait is ten minutes.
</rollback>

<fallback_host>
## Documented fallback — Fly.io `syd`

Taken only if T5's real price is unacceptable to the owner at T6. Two things must be
verified **before** adopting it, not after:

1. **`http_service.http_options.idle_timeout` accepts a value of 1200 seconds or more.**
   Fly's documented example uses 600 and the maximum is unpublished; the default is 60
   and historically a longer value meant contacting support. Mixpost holds one silent
   HTTP response open for the whole transcode, so an unverified ceiling here is the same
   failure this phase exists to fix, at a new address. Prove it with a deliberately slow
   endpoint before any data moves (research assumption A8).
2. **The compose topology must be rebuilt as three machines.** Fly volumes bind to a
   single machine, so Mixpost, MySQL and Redis each become a separate machine with its
   own volume. This is a genuine redesign and it cuts against this phase's principle —
   reproduce, do not redesign. Budget for it explicitly rather than discovering it.

Everything else in this plan is host-agnostic: the truth capture, the census gates, the
five upload layers, the quiet window, the DNS cutover and the rollback all apply
unchanged. Only T8's provisioning step and T9's nginx location change shape.

**Hosts that are disqualified and must not be substituted in quietly:** DigitalOcean App
Platform (hard 100-second request cap, no volumes at all), Railway (closes a silent
request at 5 minutes, and no Oceania region), Render and Hetzner and Sliplane (no
Oceania region). A raw Droplet in Sydney is technically perfect and violates the owner's
instruction — it recreates the withdrawn box at a different IP address.
</fallback_host>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Old host → transfer → new host | Seventeen live social-account credentials, encrypted with APP_KEY, cross the public internet as a dump file. |
| Public internet → Mixpost admin UI | A publishing interface holding those credentials sits on a public domain. |
| NRS browser → Mixpost iframe | X-Frame-Options is deliberately stripped so NRS can embed Mixpost. |
| Container image registry → new host | An unpinned image would execute unreviewed code on a host holding live credentials. |
| Mixpost → NRS webhook | HMAC-signed inbound POST; secret restored from the database. |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-P2-01 | Information disclosure | MySQL dump + storage tarball in transit and at rest | critical | mitigate | Transfer over SSH only (T8). Hold in an out-of-git vault, never `.planning/`, never committed. Delete from both hosts at T19. SHA-256 verified on arrival to detect tampering or truncation. |
| T-P2-02 | Information disclosure | `APP_KEY` in the copied `.env` | critical | mitigate | Copied host-to-host over SSH, never echoed to a transcript, never committed (T8, secrets_handling). Its loss also destroys availability — see T-P2-06. |
| T-P2-03 | Elevation of privilege | Mixpost admin UI reachable while half-configured | high | mitigate | New host firewalled or provider-hostname-only until cutover (T8). Authenticated-surface check after cutover (T17). |
| T-P2-04 | Tampering (clickjacking) | X-Frame-Options stripped for the NRS iframe | high | mitigate | `frame-ancestors` CSP naming 'self' and both NRS hosts, applied in the **same** nginx change as the stripping (T9). Stripping without the CSP is treated as a defect, not a partial success. |
| T-P2-05 | Tampering (supply chain) | `inovector/mixpost-pro-team:latest` and the MySQL image | high | mitigate | Both pinned by sha256 digest recorded from the running old host (T2) and deployed by digest (T8). No package-manager installs occur in this phase, so no legitimacy audit table is required. Image upgrades are a separate, later, deliberate change. |
| T-P2-06 | Denial of service | Regenerated `APP_KEY` or a partial restore | critical | mitigate | Per-row payload CRC32 comparison halts the migration on a single mismatch (T8). `php artisan key:generate` is prohibited on the new host. |
| T-P2-07 | Denial of service | A post falling due during the DNS window is permanently failed | high | mitigate | Zero-row quiet-window gate re-run within the hour before DNS moves (T15); post-cutover sweep for errored rows inside the window (T17). |
| T-P2-08 | Repudiation | "We checked" with no evidence | medium | mitigate | Every gate records verbatim command output in `MIGRATION-EVIDENCE.md`; counts, checksums and timings only — never payloads. |
| T-P2-09 | Information disclosure | Old host destroyed with disks unwiped, or retained too long | medium | mitigate | Retained seven days for rollback (T19), then the volume destroyed through the provider rather than by deleting files. |
| T-P2-10 | Spoofing | A forgotten `/etc/hosts` entry makes a later check read the wrong host | medium | mitigate | Every hosts-file use is removed immediately in the same task, and T11 re-resolves the hostname to confirm removal. |
| T-P2-11 | Tampering | The compliance gate silently removed during infrastructure work | high | mitigate | T3's test asserts `checkPublishAllowed` runs before the platform call and fails if it is deleted; T14 confirms it at runtime post-migration. |
</threat_model>

<verification>
## Phase-level checks

Run after T19, with the results recorded in `MIGRATION-EVIDENCE.md`:

1. `dig +short mixpost.notrealsmart.com.au` returns the new host's IP.
2. The workspace-scoped accounts endpoint returns 18 accounts, 17 authorised, split
   7 Facebook Page / 5 Instagram / 3 LinkedIn / 2 YouTube / 1 TikTok — over public DNS,
   with no hosts-file entry anywhere.
3. `npm test` passes with only the one pre-existing `brand-portfolio` failure documented
   in PROJECT.md, and includes T3's new gate assertions.
4. `git diff` across the phase shows no change to any `MIXPOST_*` or
   `NEXT_PUBLIC_MIXPOST_*` value and no change to publishing code — only the new test,
   the runbook, the evidence file and planning documents.
5. All five upload layers report their required values on the new host.
6. Zero `scheduled_posts` rows carry an error timestamped inside the cutover window.
7. The old host is running, DNS-detached, and recorded in STATE.md with its retention
   date.
</verification>

<success_criteria>
Measured against the ROADMAP's three criteria for Phase 2:

1. **A post scheduled through NRS publishes to Facebook, Instagram and LinkedIn from the
   new host, with no account re-authorised and no content re-created.** Proven by the
   owner's own observation at T18 — content visible in three apps, not a green tick —
   backed by the zero-line census diff at T8 and T15 showing the seventeen grants were
   never touched.
2. **The video that previously failed uploads and publishes, and the owner can watch its
   progress.** Proven twice: measured at T13 before cutover (≥490 MB, ≤160 s, bar moving)
   and observed by the owner at T18 afterwards.
3. **Nothing in NRS had to change to point at the new host beyond configuration.**
   Proven at T14 and phase check 4 — and met more strongly than stated: with the domain
   preserved, no NRS environment value changes at all, and the only repository changes
   are one new test, one runbook, and the evidence record.

Plus, from PUB-01 and PUB-02 directly: the seventeen authorised accounts are on a host
the owner has not withdrawn, and the two diagnosed upload faults arrived as day-one
configuration rather than being rediscovered as bugs.
</success_criteria>

<output>
Create `.planning/phases/phase-2/02-01-SUMMARY.md` when done.
</output>

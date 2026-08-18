# Design System — NotRealSmart Agency

This file locks the approved mockup system. It is not a new aesthetic. Do not invent one. Do not generate AI mockups to "improve" it. Visual source of truth: `.mockups/dept-*.html` (open `dept-social.html` first). Retint math source of truth: `src/components/agency/shell/brand-theme.ts`. Settled product rules: `docs/ARCHITECTURE.md` → "The interface architecture (settled 2026-08-17)".

The marketing homepage (`src/app/page.tsx`, WaterRippleHero) is out of scope. This document is the **agency desk**.

---

## Product Context

**Product.** NotRealSmart Agency — a self-owned agentic AI marketing agency. One Director plus fourteen invisible departments. The user is a non-technical clinic or business owner, not a developer. They do not know Mixpost, Zernio, OAuth, or department names, and must never see those words.

**Project type.** Web app / agency desk. Conversation is optional. Buttons do the work.

**Memorable thing.** *It looks like THEIR business, and they drive it with buttons.*

Selecting a business retints the chrome from that business's colour. Every screen is complete with the Director rail collapsed. Every primary action is a control a person clicks. AI proposals are secondary, quieter, dismissable, and never the only way to start anything.

**Consultation (2026-08-17).** D1 lock this mockup set as DESIGN.md (no Mixpost landscape research). D2 memorable thing as above. D3 no outside design voices. D4 skip generating new preview mockups; write this file now.

---

## Aesthetic Direction

Quiet silver/chrome furniture. The only colour that moves is the selected business.

The desk is a three-column instrument panel: a flat always-expanded sidebar, a department of work with inner tabs, and a persistent Director rail. Surfaces are paper-white (or near-black in dark), hairline silver borders, a small shadow on cards and the Create post button. No purple gradients. No three-column icon grids. No blob decoration. No Inter. No Mixpost chrome copied as Mixpost chrome — Mixpost's *navigational clarity* is the thing that was adopted; NRS is the product around it.

The house hue is **240** (cool silver). Chroma on furniture is tiny (0.002–0.015) so the page reads as metal, not as a colour someone picked. When a business has set a colour, `--brand` / `--brand-deep` / `--brand-wash` carry *that* hue at *system* lightness. A pale brand still gets a readable button; a fluoro brand still gets a wash that can carry body text. That is the whole trick, and it is why lightness is never taken from the stored colour.

Healthcare is a separate language. Warm red, hue **25**, only when that business's health/compliance flag is on. It is never derived from the brand hue. A compliance row that picked up teal would look like furniture.

Dark mode is a class on `<html>` (`next-themes`, `defaultTheme="dark"`, `enableSystem={false}`), not `prefers-color-scheme`. Light and dark are **separate ramps**, not one ramp inverted: `--brand-deep` is the high-contrast fill in *both* themes (dark L in light, light L in dark).

Australian English throughout (colour, behaviour, organisation).

---

## Typography

**Product typeface (code, already shipping).** IBM Plex Sans and IBM Plex Mono, loaded in `src/app/layout.tsx`.

```
IBM Plex Sans  — weights 100, 200, 300, 400, 500, 600, 700  →  --font-sans
IBM Plex Mono  — weights 400, 500, 600                     →  --font-mono
```

Body: `var(--font-sans), system-ui, sans-serif`. `html lang="en-AU"`. `-webkit-font-smoothing: antialiased`. Line-height **1.5**. Base size **14px**.

The mockups used a system stack (`ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto`) as a stand-in so the HTML files would render without webfonts. That stack is **not** the product typeface. IBM Plex was already the house face; locking the mockups does not replace it. **Never Inter.** Never a second display face.

**Mockup weights that IBM Plex does not have.** The mockups write `font-weight: 560` (section rows) and `650` (active rows, Create post, group labels, h1). Map to the nearest real IBM Plex cut; do not synthesise 560/650:

| Mockup | Use |
|---|---|
| 400 | 400 |
| 560 | 600 |
| 600 | 600 |
| 650 | 600 on chrome (nav, buttons, labels); 700 on stat values (`27px`) |
| 700 | 700 |

**Scale (from `.mockups/dept-social.html`, locked).**

| Role | Size | Weight (mockup → Plex) | Tracking | Notes |
|---|---|---|---|---|
| Page title `h1` | 19px | 650 → 600 | −0.015em | Department header |
| Stat value | 27px | 700 | −0.02em | Colour `--brand-deep` |
| Composer body | 14.5px | 400 | 0 | Line-height 1.55 |
| Body | 14px | 400 | 0 | Line-height 1.5 |
| Section row | 13.5px | 560 → 600; 650 → 600 when active | 0 | |
| Inner department tab | 13.5px | 400; 650 → 600 when on | 0 | |
| Create post, business name, rail body, fields, footer | 13px | 650 → 600 (CTA); 600 (name) | CTA +0.02em; name −0.01em | |
| Button, card header, sub-item, muted body | 12.5px | 600 / 400 | 0 | Sub-item line-height 1.4 |
| Preview caption, some labels | 12px | 400–600 | 0 | |
| Eyebrow, business subtitle | 11px | 650 → 600 (eyebrow); 400 (subtitle) | eyebrow +0.08em uppercase | |
| Care indicator, small button | 11.5px | 600 | 0 | Line-height 1.35 on care |
| Group label (`CONTENT`, `THIS BUSINESS`) | 10.5px | 650 → 600 | +0.09em uppercase | |
| Count badge, tab badge | 10px | 650 → 600 | 0 | Tabular nums on counts |
| Logo chip initials | 10px | 600 | 0 | |

Monospace for character counts, times, and anything the owner is meant to compare as a number (`font-variant-numeric: tabular-nums`).

---

## Color

oklch only. Never hex in new UI code. Never `color-mix()` in oklch — it interpolates through pink and has been rejected twice. Darker and paler steps are derived numerically (fixed L, C scaled) or written as literals. Never mix.

### House chrome (surfaces and ink)

House hue `--h: 240`. These do **not** retint with the business. They are the silver furniture. Canonical values from `.mockups/dept-social.html` (identical across every `dept-*.html` light block).

**Light**

| Token | Value | Role |
|---|---|---|
| `--bg` | `oklch(0.985 0.002 240)` | Page |
| `--panel` | `oklch(1 0 0)` | Sidebar, rail, cards |
| `--panel-2` | `oklch(0.975 0.004 240)` | Recessed strip (business block, hover, fields) |
| `--line` | `oklch(0.915 0.007 240)` | Hairline |
| `--line-soft` | `oklch(0.950 0.005 240)` | Quieter hairline |
| `--ink` | `oklch(0.20 0.014 240)` | Primary text |
| `--ink-2` | `oklch(0.46 0.012 240)` | Secondary text |
| `--ink-3` | `oklch(0.615 0.011 240)` | Tertiary, labels, icons at rest |

**Dark**

| Token | Value | Role |
|---|---|---|
| `--bg` | `oklch(0.175 0.010 240)` | Page |
| `--panel` | `oklch(0.215 0.012 240)` | Sidebar, rail, cards |
| `--panel-2` | `oklch(0.245 0.013 240)` | Recessed |
| `--line` | `oklch(0.315 0.015 240)` | Hairline |
| `--line-soft` | `oklch(0.275 0.013 240)` | Quieter hairline |
| `--ink` | `oklch(0.960 0.005 240)` | Primary text |
| `--ink-2` | `oklch(0.795 0.011 240)` | Secondary |
| `--ink-3` | `oklch(0.640 0.013 240)` | Tertiary |

`src/app/globals.css` still holds shadcn near-achromatic tokens (`--background: oklch(1 0 0)`, `--foreground: oklch(0.145 0 0)`, `--muted-foreground: oklch(0.556 0.012 240)`). Those are leftover shadcn greys. **Agency shell chrome uses the mockup tokens above**, not the shadcn set. Do not "fix" a department screen by reaching for `--primary`.

**Shadow (mockup + sidebar).**

- Light: `0 1px 2px oklch(0.2 0.02 240 / .05), 0 8px 24px -16px oklch(0.2 0.02 240 / .28)`
- Dark: `0 1px 2px oklch(0 0 0 / .5), 0 10px 30px -18px oklch(0 0 0 / .75)`

### Business retint (mandatory)

The chrome always takes colour from the selected business. One variable set. Not per-component theming.

**The business supplies HUE. The system supplies LIGHTNESS.**

Passing a pale brand's own lightness through would make `--brand-deep` buttons unreadable, and nobody would find out until it was live. A fully saturated brand passed through would push `--brand-wash` — a background that carries body text — past the point where it is a wash. So:

1. Read the stored colour (`brand_colours.primary`, else `accent`, else `secondary`). Hex, `rgb()`/`rgba()`, and `oklch()` are all accepted. Alpha is discarded — a half-transparent `--brand` would let the page behind it change the tint.
2. Keep **H**. Cap **C** at `0.115` (the mockup's `--brand` chroma). Throw **L** away.
3. If nothing usable is stored, or chroma is below `0.01` (black, white, grey — `atan2` on near-zero a/b is noise): house silver, hue **240**, chroma **0.03**, flagged `isFallback`. **Never write that fallback into the database.** Display-only.
4. Paint four tokens from the ramp below.

Code: `src/components/agency/shell/brand-theme.ts` (`RAMPS`, `resolveAccent`, `brandThemeVars`). The server layout (`src/app/agency/layout.tsx`) emits the same ramp as CSS, scoped to `[data-nrs-shell][data-brand-id="…"]`, so the first paint is already the right business. Do not invent a third copy.

**Reference chroma** `0.115` — the approved mockup's light `--brand` (`oklch(0.545 0.115 205)` on Downscale). Every other step's chroma is a fraction of it, so the whole ramp scales together.

**Light ramp** (L fixed, C = resolved chroma × fraction)

| Token | L | C at reference (Downscale hue 205) | Fraction of 0.115 | Why this L |
|---|---|---|---|---|
| `--brand` | 0.545 | `oklch(0.545 0.115 205)` | 1 | Mid accent: links, active hairlines, hover fill on Create post |
| `--brand-deep` | 0.33 | `oklch(0.33 0.080 205)` | 0.08 / 0.115 | High-contrast fill. White (or `--brand-ink`) sits on it. Pale brand lightness would fail here. |
| `--brand-wash` | 0.966 | `oklch(0.966 0.026 205)` | 0.026 / 0.115 | Selected-row background. Must stay a wash. |
| `--brand-ink` | 1 | `oklch(1 0 0)` | 0 | Text on a brand fill. White in light. |

**Dark ramp** (not the light ramp inverted)

| Token | L | C at reference (Downscale hue 205) | Fraction of 0.115 | Why this L |
|---|---|---|---|---|
| `--brand` | 0.74 | `oklch(0.74 0.11 205)` | 0.11 / 0.115 | Lighter, not darker — dark UI needs a brighter accent |
| `--brand-deep` | 0.87 | `oklch(0.87 0.08 205)` | 0.08 / 0.115 | Still the high-contrast fill, now a *light* fill |
| `--brand-wash` | 0.272 | `oklch(0.272 0.038 205)` | 0.038 / 0.115 | Selected-row background on dark panel |
| `--brand-ink` | 0.17 | `oklch(0.17 0.02 H)` | 0.02 / 0.115 | Dark ink on a light fill. White on `--brand-deep` in dark is nearly invisible. The mockup patched this per-button (`.side .cta{color:oklch(0.17 0.020 205)}`); `--brand-ink` means no future button has to remember. |

Worked fallback (no colour chosen), from the same fractions at C `0.03` H `240`:

| Token | Light | Dark |
|---|---|---|
| `--brand` | `oklch(0.545 0.03 240)` | `oklch(0.74 0.0287 240)` |
| `--brand-deep` | `oklch(0.33 0.0209 240)` | `oklch(0.87 0.0209 240)` |
| `--brand-wash` | `oklch(0.966 0.0068 240)` | `oklch(0.272 0.0099 240)` |
| `--brand-ink` | `oklch(1 0 0)` | `oklch(0.17 0.0052 240)` |

Quiet on purpose. The fallback has to read as chrome — the absence of a choice — not as a colour someone picked. It sits just above the `0.012` the house palette already carries on `--muted-foreground`.

**Do not** use the AgencySidebar local fallbacks `oklch(0.545 0.115 240)` as the unset colour. Those are the Downscale *chroma* at the house *hue*, which is a saturated blue-violet, not quiet chrome. They only fire if `--brand` is missing; the shell always emits `--brand`. If you touch those aliases, point them at the 0.03 fallback above.

### Healthcare `--care` (never from brand hue)

Warm red, hue **25**. Only when `brands.compliance_flags.ahpra` or `.tga` is on. Never derived from `--brand`. Never shown on an unregulated business (Scent Sell must not see an AHPRA row).

Canonical from `.mockups/dept-social.html` + the sidebar normaliser that every `dept-*.html` pins at the bottom, matching `AgencySidebar.tsx`:

| Token | Light | Dark |
|---|---|---|
| `--care` | `oklch(0.52 0.150 25)` | `oklch(0.77 0.13 25)` |
| `--care-wash` | `oklch(0.965 0.028 25)` | `oklch(0.285 0.045 25)` |
| `--care-line` | `oklch(0.89 0.050 25)` | `oklch(0.42 0.070 25)` |
| `--nrs-knob` (switch thumb) | `oklch(1 0 0)` | `oklch(0.20 0.040 25)` |

The sidebar healthcare row is an **indicator, not a toggle**. AHPRA/TGA applicability is a fact about the business. A control that appears to switch it off would appear to switch off a $60,000-per-offence obligation. It reports; it does not decide. A `[care]` nav row keeps its warm red even when selected — it is not the same kind of thing as "Templates".

`--care-deep` appears in some department mockups (`oklch(0.42 0.14 25)` light / `oklch(0.86 0.10 25)`–`0.11` dark) for filled care buttons. It is not on the shared sidebar. If a department needs a filled care control, use those values; do not invent a third red.

### Semantic status (Social mockup)

Not brand. Not care. Each state owns its own colour so a plain circle can be honest.

| Token | Light | Dark |
|---|---|---|
| `--ok` | `oklch(0.55 0.13 155)` | `oklch(0.74 0.13 155)` |
| `--ok-wash` | `oklch(0.962 0.032 155)` | `oklch(0.268 0.040 155)` |
| `--warn` | `oklch(0.63 0.13 75)` | `oklch(0.80 0.13 78)` |
| `--warn-wash` | `oklch(0.964 0.052 80)` | `oklch(0.288 0.045 75)` |
| `--stop` | `oklch(0.55 0.17 27)` | `oklch(0.70 0.16 27)` *(from dashboard/google-ai dark; social light has `--stop`, social dark uses `--st-fail`)* |
| `--st-draft` | `oklch(0.62 0.012 240)` | `oklch(0.66 0.012 240)` |
| `--st-sending` | `oklch(0.72 0.15 70)` | `oklch(0.80 0.14 72)` |
| `--st-sched` | `oklch(0.62 0.10 220)` | `oklch(0.74 0.11 220)` |
| `--st-pub` | `oklch(0.58 0.14 152)` | `oklch(0.74 0.14 152)` |
| `--st-fail` | `oklch(0.58 0.17 27)` | `oklch(0.70 0.16 27)` |

Attention count badges (queues — "Waiting on you") use `--brand-deep` + `--brand-ink`, not `--ok`. A 59 that reads like "59 templates" is a 59 nobody clears. Inventory counts use the quiet badge (border `--line`, fill `--panel-2`, ink `--ink-3`). Never badge `0`. Absent means unmeasured; zero means empty; both render bare.

---

## Spacing

The mockups are pixel-authored, not a Tailwind spacing scale. Repeat these, do not round them to the nearest `p-4`.

| Use | Value |
|---|---|
| Sidebar / business block padding | 13px (block), 8×10px (selector), 7×9px (care row) |
| Create post | margin 12px; padding 11×14px |
| Section row | padding 7×9px; gap 9px; radius 8px; icon 16px |
| Sub-item indent | 34px from the section's left; padding 3.5–4×8px; gap 1px between rows |
| Group label | padding-top 14px, padding-bottom 5px, horizontal 9px |
| Department header | 20px 26px 0 |
| Inner tabs | margin-top 14px; tab padding 9×12px 10px |
| Scrolling pane | 18px 26px 26px |
| Card header | 11×15px |
| Card / composer gaps | 12px |
| Rail body | 14px; message gap 12px |
| Rail input | 11×12px 12px |
| Footer chip | 12px 16px; gap 9px |
| Common gap | **9px** (selector, nav icon, rail message) |

Radii (locked from the mockup, not `--radius: 0.625rem` from shadcn):

| Radius | Where |
|---|---|
| 5px | Count badges, tab badges |
| 6px | Sub-items, tiny pills |
| 7px | Logo chip, 26×26 icon buttons in the rail header |
| 8px | Section rows, default buttons, fields, inner-tab hover, collapsed-rail open control |
| 9px | Care indicator |
| 10px | Business selector, Create post, account rows, proposals, day cells |
| 11px | Phone preview, care callout, ask box |
| 12px | Cards |
| 99px / 50% | Switches / avatars |

Logo chip and owner avatar: **26×26**. Care switch track: **28×16** (sidebar) with a **12×12** thumb. Create post icon 15px at stroke 2.5; section icons 16px at stroke 1.9.

---

## Layout

```
┌──────────────┬───────────────────────────────────┬──────────────────┐
│  SIDEBAR     │            THE WORK               │  DIRECTOR RAIL   │
│  236px       │                                   │  380px           │
│              │  Department header + inner tabs   │  tabs            │
│ [business ▾] │  Panel scrolls                    │  conversation    │
│ [health ⏻ ]  │  Action bar pinned on Compose     │  previous chats  │
│              │                                   │  suggested       │
│ + Create post│  Every primary action is a        │  ───────────     │
│              │  MANUAL control.                  │  input (pinned)  │
│ 12 sections, │                                   │                  │
│ flat, always │                                   │  collapsible     │
│ expanded     │                                   │  → 52px          │
└──────────────┴───────────────────────────────────┴──────────────────┘
```

Grid (from the mockup `body` and `src/app/agency/layout.tsx`):

- `lg` and up: `236px minmax(0,1fr) auto`. The rail column is `auto` so it can be 380px or 52px without the layout subscribing to collapse state.
- Below `lg`: sidebar leaves the flow (off-canvas drawer, `#nrs-nav:target`). Work + rail: `minmax(0,1fr) auto`.
- Below `md`: Director is **not a column**. Pill (bottom-right) opens a sheet. Nothing of the 380px rail sits in the grid.

Collapsed rail: **52px** strip, visible control to bring it back. Collapsing removes nothing from the work column. That is the test of every screen.

**The composer is the one documented exception to the single work column.** `/agency/social/compose` splits into the form and a fixed **750px** right pane carrying two tabs, Preview and Activity — the owner chose Mixpost's shape over the single-column mockup on 19 Aug 2026. Below 1280px the pane leaves the flow, the form takes the full width and the preview opens as a sheet from one button; the open/closed choice is remembered. Nothing else in any department gets a second column. See `src/components/agency/studio/post/ComposerLayout.tsx`.

### Twelve sections, in order

Source: `src/components/agency/shell/nav-sections.ts` `NAV_SECTIONS`, matching the mockup sidebar. Flat. Always expanded. Sub-items visible without a click. Labels are what a non-technical owner would say out loud.

1. **Dashboard**
2. **Business analysis** — What the business is · Who buys from you · What makes you different · Goals & targets
3. **Branding & voice** — Logo, colours, fonts · How you sound · Words to use & avoid · What you talk about
4. **Connections** — Social accounts · Your website · Canva · Google · Code & hosting · Email
5. **Competitors** — Who they are · What they post · What they rank for · Where you are behind
6. **Google searchability** — What you rank for · What people search · Your Google listing · Local & maps
7. **AI searchability** — Can AI find you · How AI describes you · What to fix
8. **Website** — Speed on phone & desktop · Pages · Structure & sitemap · What to fix
9. **Blogging** — Your posts · What to write next · Search terms · Images · *Checked before you publish* `[care]`
10. **Social media** — *Content:* Posts · **Waiting on you** · Calendar · Media library · Templates — *Setup:* Social accounts · Posting schedule — *Results:* Analytics
11. **Advertising** — Campaigns · What you are spending · What it is returning · Audiences · *Ad rules for health* `[care]`
12. **Engagement** — Comments · Messages · Mentions · Reviews

**This business → Settings** is not one of the twelve. It sits under a **THIS BUSINESS** heading after them: People & access · What it costs · *Compliance record* `[care]`.

Google searchability and AI searchability are **separate sections**. They are not "SEO".

**Waiting on you** is not a thirteenth section. It is Posts with `?status=waiting`. Same pathname, different filter. The old Review room was two lists of the same posts that could disagree.

**Create post** is the one primary manual action in the sidebar. It opens the Social media department at Compose (`/agency/social/compose`), not a modal. Social is the whole Mixpost-like posting desk, with inner tabs:

**Compose · Posts · Calendar · Media library · Templates · Schedule · Analytics**

Header + inner tabs are fixed; the panel scrolls; the Compose action bar is pinned so it is never hunted for.

Almost every subscriber has **one** business. With one, the selector is a label, not a switcher. Justin's fourteen is the exception.

`[care]` rows are hidden unless the selected business is regulated. Blogging never publishes to their site — NRS drafts, checks, and hands over. Unfinished states stay visible ("not set up", "Nothing has gone out yet"). A design pass will want to tidy them away; they are the difference between this product and one that lies.

Never show Mixpost, Zernio, OAuth, or department names to the user.

### Director rail

On every `/agency` screen. Persistent. Input pinned to the bottom.

**Tabs (mockup):** Director · Preview · Activity · Analytics.

**Also in the rail (settled, not a thirteenth sidebar):** previous chats, a context line that *states* what is remembered, and explicit clear-context controls (conversation vs everything learnt about this business — two scopes, never one button). History belongs with the talking.

The rail owns **no action of its own** on the owner's work. Nothing in it publishes, saves, schedules, or connects. Suggestions are dismissable. Collapse control is always visible.

Collapsed: 52px, vertical "Director" label, avatar chip, open control. Mobile (`< md`): pill + sheet.

---

## Motion

The mockups are essentially static. Keep it that way.

- Sidebar drawer: `transition-transform duration-200` (already in `layout.tsx`). No bounce.
- Colour on hover (Create post `--brand-deep` → `--brand`, borders picking up `--brand`): colour only, ~150–200ms, no movement.
- Inner tabs, selected rows: instant background / hairline change, no slide.
- Rail collapse: the grid track follows width; do not animate the work column's contents.
- Mobile Director pill: the existing `hover:scale-105 active:scale-95` is the only scale in the shell. Do not spread scale to desktop chrome.
- No page-load fades, no staggered card reveals, no gradient animation, no blob motion.

If it looks like a marketing site, it is wrong.

---

## Components (that must match across every department)

These are the shared chrome. A new department copies them; it does not restyle them.

**Business selector.** 26×26 rounded-7 logo chip on `--brand` with `--brand-ink` initials (two letters max). Name 13px semibold `--ink`. Subtitle 11px `--ink-3` ("3 accounts") — omit if uncounted. Chevron only when there is more than one business. Resting: border `--line`, fill `--panel`, sitting on `--panel-2` strip.

**Healthcare indicator.** Care-wash fill, care-line border, 28×16 track, 12×12 knob. Copy: "Healthcare business — {AHPRA and/or TGA} rules on". Names only the regulators that apply. Not a toggle.

**Create post.** Full-width in the 236px column. Fill `--brand-deep`, text `--brand-ink`, radius 10px, 13px/650, tracking 0.02em, plus icon. Hover fill `--brand`. Dark mode *must* use `--brand-ink`, not white.

**Section row.** Icon + label + optional quiet count. Resting `--ink` / icon `--ink-3`. Active: fill `--brand-wash`, text and icon `--brand-deep`, weight up. Hover (inactive): `--panel-2`.

**Sub-item.** 3px bullet. Resting `--ink-2`, bullet `--ink-3` at 55%. Active: `--brand-wash` / `--brand-deep`, bullet solid. Care variant: `--care` text and bullet, `--care-wash` when active. Never let a care row pick up the brand wash.

**Count badge.** Quiet = inventory. Attention = queue (`--brand-deep` / `--brand-ink`). No zero.

**Inner department tabs.** 13.5px, bottom hairline. On: `--brand-deep` text, 2px `--brand` underline. Badge on the tab follows the same quiet/active pair as nav badges.

**Card.** `--panel`, border `--line`, radius 12px, mockup shadow. Header 12.5px/650, hairline `--line-soft` under it.

**Button.** Default: border `--line`, fill `--panel`, 12.5px/600, radius 8px, padding 7×12px. Hover: border `--brand`, text `--brand-deep`. Primary: fill `--brand-deep`, text `--brand-ink`, no border. Primary hover: fill `--brand`. Small: padding 5×9px, 11.5px. Link-as-button: no chrome, `--brand-deep`, 12.5px/600.

**Field.** Border `--line`, radius 8px, padding 8×11px, 13px `--ink`.

**Eyebrow.** 11px, 0.08em, uppercase, `--ink-3`, weight 650→600.

**Care callout.** Card with 3px left bar `--care` (status callouts in the rail use `--ok` / `--warn` / `--care` the same way).

**Phone preview.** Radius 11px, `--panel-2` well, 26px avatar on `--brand`.

**Director message.** 22×22 rounded-6 avatar on `--brand`. Owner messages reverse, avatar `--ink-3`, bubble `--brand-wash`.

**Director proposal.** Bordered `--panel-2`, dismiss `×`, secondary actions — never the only way to do the thing.

**Director input.** Pinned. `--panel-2` well, radius 11px, 27×27 send on `--brand-deep` with `--brand-ink`. Footer: "Director" pill, context line, optional live dot `--ok`.

**Post state dot.** 9px circle in `--st-*`. Never a coloured pill for draft/scheduled/published/failed — the mockup is explicit: "a plain circle, never a pill — honest states need their own colour each."

**Pinned action bar (Compose).** State on the left (dot + "Draft" + "Saved … Nothing has gone out."). Buttons on the right: Save draft · Add to next free time · Choose a time · Post now (primary). Healthcare gate copy sits above the buttons when the business is regulated.

---

## Anti-patterns / never

- Do not invent a new aesthetic, generate AI mockups, or "improve" the mockup set.
- Do not touch the homepage / WaterRippleHero / add Three.js to the desk.
- Do not use Inter, purple gradients, three-column icon grids, or blob decoration.
- Do not `color-mix()` in oklch.
- Do not take lightness from the stored brand colour. Hue from them, lightness from us.
- Do not write a default colour into `brand_colours`. Unset stays unset; fallback is display-only and flagged `isFallback`.
- Do not derive `--care` from the brand hue. Do not show care chrome on an unregulated business.
- Do not make the healthcare row a working toggle.
- Do not collapse the twelve sections. Do not add a thirteenth (Review, Inbox, and "Waiting on you" as a place are all wrong).
- Do not put Analytics, Media library, or Calendar in the top-level sidebar — they nest under Social.
- Do not merge Google searchability and AI searchability.
- Do not let Blogging publish to their site, or imply that it can.
- Do not name Mixpost, Zernio, OAuth, or departments in the UI.
- Do not make the Director the only way to start work. Collapse the rail; the screen must still be whole.
- Do not put publishing, saving, scheduling, or connecting controls in the rail.
- Do not badge `0`. Do not use an attention badge for inventory.
- Do not put white text on `--brand-deep` in dark mode — use `--brand-ink`.
- Do not use shadcn `--primary` / `--sidebar-*` as the agency accent. Use `--brand*`.
- Do not round mockup pixels to a Tailwind scale "because it is cleaner".
- Do not tidy away empty states. "Nothing has gone out yet" is the product being honest.

---

## Token drift unified here

Six `dept-*.html` files plus `nav-map.html` were authored in parallel. This file locks **one** set. Later work follows this table, not the drifting file.

| Token | Locked (this file) | Drift found | Why this one |
|---|---|---|---|
| Light `--brand*` | `0.545 0.115` / `0.33 0.080` / `0.966 0.026` at business H | `nav-map.html` used `0.52 0.10` / `0.32 0.075` / `0.964 0.026` | `dept-social.html` + `brand-theme.ts` |
| Dark `--brand*` | `0.74 0.11` / `0.87 0.08` / `0.272 0.038` | `dept-dashboard.html` and `dept-google-ai.html` used `0.76 0.14` / `0.88 0.10` / `0.275 0.045`; `dept-business.html` wash `0.275 0.038` | `dept-social.html` + `brand-theme.ts` RAMPS. Higher chroma on dashboard/google-ai is not the shared ramp. |
| Light house `--panel-2` / `--line` / `--ink-2` | `0.975 0.004` / `0.915 0.007` / `0.46 0.012` | `nav-map.html` `0.972` / `0.912` / `0.45` | Every `dept-*.html` agrees; nav-map is older. |
| `--care` light | `0.52 0.150 25` | `nav-map.html` `0.50 0.13 25` | Social + sidebar. |
| `--care` dark | `0.77 0.13 25` | dashboard `0.76 0.15`; blogging `0.76 0.13`; google-ai `0.72 0.16`; connections `0.78 0.13`; business `0.68 0.15` | Social + `AgencySidebar.tsx` `dark:[--nrs-care:…0.77_0.13_25]` |
| `--care-line` | `0.89 0.050 25` / dark `0.42 0.070 25` | dashboard `0.88 0.06` / `0.40 0.09`; business `0.90 0.045` / `0.38 0.075`; connections `0.885 0.055` / `0.395 0.070` | The **sidebar normaliser** at the bottom of every `dept-*.html` (`:root{--nrs-care-line:oklch(0.89 0.050 25)}`) plus `AgencySidebar.tsx`. Department-local `:root --care-line` lost. |
| Unset `--brand` chroma | **0.03** at hue 240 | `AgencySidebar.tsx` local fallback `oklch(0.545 0.115 240)` | `brand-theme.ts` `FALLBACK_CHROMA`. 0.115 at 240 is Downscale chroma wearing house hue — not chrome. |
| Typeface | IBM Plex Sans + Mono | Mockups `--sans: ui-sans-serif, system-ui, …` | Mockup stand-in so HTML files render offline. Product already loads Plex (`src/app/layout.tsx`). Not a new face. |
| Dark `--stop` | `oklch(0.70 0.16 27)` | `dept-social.html` dark block omits `--stop` (uses `--st-fail`) | Dashboard/google-ai dark; same L/C as `--st-fail`. |

`--ok` / `--warn` washes also wobble slightly across files (e.g. blogging light `--ok: 0.50 0.12 155` vs social `0.55 0.13 155`). Locked to **social**.

Nothing in this file is an agent-default palette. Where a number is not in the mockups, it is called out: IBM Plex (existing product face, mockups used system-ui); `--brand-ink` as a variable (mockup inlined `oklch(0.17 0.020 205)` on `.side .cta` in dark); fallback chroma 0.03 (in `brand-theme.ts`, not painted in the Downscale mockups because those mockups always show a colour). shadcn `--radius: 0.625rem` and the globals greys are **not** adopted.

---

## Source of truth

| Kind | Path |
|---|---|
| Visual | `.mockups/dept-social.html` (start here), `dept-dashboard.html`, `dept-business.html`, `dept-connections.html`, `dept-google-ai.html`, `dept-blogging.html` |
| Navigation map | `.mockups/nav-map.html` (structure; tokens drifted — do not copy its `:root`) |
| Retint math | `src/components/agency/shell/brand-theme.ts` |
| CSS emission / no-flash tint | `src/app/agency/layout.tsx` |
| Twelve sections | `src/components/agency/shell/nav-sections.ts` |
| Sidebar chrome | `src/components/agency/shell/AgencySidebar.tsx` |
| Director rail | `src/components/agency/shell/DirectorRail.tsx` |
| Product typeface | `src/app/layout.tsx` (IBM Plex) |
| Settled interface rules | `docs/ARCHITECTURE.md` (end) |

---

## Decisions Log

| Date | Decision | Rationale |
|---|---|---|
| 2026-08-17 | Locked mockup set as DESIGN.md | /design-consultation D1–D4; memorable thing; business retint |
| 2026-08-17 | Memorable thing: looks like THEIR business, and they drive it with buttons | D2; human drives, AI optional; collapse-the-rail test |
| 2026-08-17 | No outside design voices | D3; five prior attempts already rejected |
| 2026-08-17 | Skip generating new preview mockups | D4; the six `dept-*.html` files are the visual target |
| 2026-08-17 | Business supplies hue, system supplies lightness; `--care` is healthcare-only; never `color-mix` in oklch | Pale-brand buttons would be unreadable; mix interpolates through pink; care must not look like furniture |
| 2026-08-17 | Unify token drift onto `dept-social.html` + `brand-theme.ts` | Parallel mockup authoring; dashboard/google-ai dark chroma and nav-map older ramps are not the product |

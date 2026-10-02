# The Lost Explorer — v1

## TL;DR

> **Quick Summary**: Build the first playable version of a daily geography deduction game where one mystery city is revealed through five escalating clues ("Days"), presented as an explorer's physical field journal. Next.js App Router + TypeScript + Tailwind on Vercel, with per-Day clues served from a date-gated route handler so future clues are structurally unreachable from the client.
>
> **Deliverables**:
> - Playable daily game: 5 clue Days, one guess per Day, GUESS / CONTINUE, final guess on Day 5
> - City autocomplete over ~25k GeoNames cities with alias + diacritic matching
> - Server-gated clue delivery (HMAC-selected, server-pinned, future dates rejected)
> - Streak + statistics derived from localStorage, zod-versioned
> - Spoiler-free emoji share string
> - End-of-game journal spread: antique vector world map with great-circle arcs to every wrong guess
> - 6 hand-verified puzzles + `puzzle-lint` that mechanically enforces spec §17
> - Full "field journal" visual identity: woodtype stamps, washi tape, torn flag cloth, aged paper
>
> **Estimated Effort**: Large
> **Parallel Execution**: YES — 5 waves + final verification wave
> **Critical Path**: Task 1 → Task 3 → Task 11 → Task 20 → Task 23 → Task 27 → F1–F4 → user approval

---

## Context

### Original Request
User supplied `initial.txt` — a 955-line design spec for "The Lost Explorer", a daily web-based geography deduction game. Request: *"Read it, analyze and suggest, then make a plan to create a first version for this web game. The design style should be adventure/traveller/diary theme, be creative and bold."*

Repo was greenfield — only `initial.txt` existed.

### Interview Summary

**12 problems identified in the spec, and their resolutions:**

| # | Problem | Resolution (user-confirmed) |
|---|---|---|
| P1 | **Critical design bug**: §4 makes a wrong guess advance you to the next Day, so GUESS and CONTINUE cost identically — CONTINUE is strictly dominated and the game's core tension does not exist | One guess per Day (5 max), wrong-guess count recorded and displayed ("Solved Day 3 · 2 wrong guesses"), used as leaderboard tiebreaker before time. CONTINUE now buys a clean record. "Average Day solved" remains the hero metric per §10 |
| P2 | Day 3 flag colour conveys almost nothing — red is on ~75% of flags, white ~70%, and §3's "least revealing colour" rule guarantees red/white nearly every time, failing §17's own "does each clue materially narrow?" test | Reveal the full colour **set** without layout ("red and white — and no other colours"), rendered as a torn cloth swatch of the real flag. Eliminates all tricolours while staying ambiguous |
| P3 | Day 2 reference city is the highest-variance clue — near-solving if you know the reference, worthless if you don't; Day1+Day2 often collapses to a single candidate, making Days 3–5 decorative | Prefer distant + globally famous references, target ≥800 km. Constrains a ring rather than a point. `recognisability` tier stored per reference and enforced by `puzzle-lint` |
| P4 | Exact wrong-guess distances permit trilateration — 3 guesses pin a unique point, letting players brute-force without reading clues | Distance **bands** per §8 (<250 / <750 / <2000 / >2000), behind a config flag so exact-vs-bands stays playtestable |
| P5 | Daily reset timezone unspecified; "same puzzle for every player" (§2) and local-midnight are mutually exclusive across the dateline | 00:00 UTC, expressed as a single `EPOCH_UTC` + `DAY_MS` constant pair |
| P6 | Same-day forward-clue leakage — if all five clues ship in the bundle, Day 5 is readable on Day 1, defeating the entire mechanic | Server-gated per-Day clue delivery via Next.js route handler |
| P7 | Autocomplete must hold thousands of cities or the dropdown *is* the answer key | GeoNames `cities15000` (~25k) guess pool, lazy-loaded |
| P8 | §17's QC checklist is mechanically checkable and will be skipped if it stays a human ritual | Executable `puzzle-lint` script, wired into CI |
| P9 | Metro-vs-admin population mismatch is the top source of "your clue is wrong" complaints | Hand-curate metro population for the 6 answer cities with `source` + `asOfYear` fields, surfaced in the post-game reveal |
| P10 | Day 4 historical claims are politically sensitive and script-unverifiable | Required `source_url` per Day-4 claim; neutral wording per §18; human review stays mandatory |
| P11 | Unversioned localStorage means a shape change silently destroys a user's streak | zod discriminated-union versioning + migration, plus export/import escape hatch |
| P12 | Spec never states mobile-first, which it overwhelmingly is | Mobile-first is a hard requirement, not a polish pass |

**User decisions**: Next.js + TS + Tailwind on Vercel (bun toolchain) · TDD on pure logic only · 6 hand-verified cities with schema/pipeline/lint built for 20+ · 00:00 UTC reset.

### Research Findings

Three parallel librarian investigations, all verified against real repositories and official docs.

**Daily-puzzle architecture**
- Original Wordle shipped **2,315 answers pre-ordered covering 2021-06-19 → 2027-10-20** — every future answer readable from devtools on day one. This is the documented trust-killer ([HN 29891222](https://news.ycombinator.com/item?id=29891222), [HN 46853740](https://news.ycombinator.com/item?id=46853740)).
- Proven fix, in production: [Framemoji's daily route](https://github.com/sainsw/framemoji/blob/c1029cb11008a286ead7fa6c582eabd108edc7b5/src/app/api/daily/route.ts#L1-L98) — HMAC-SHA256 permutation keyed by a server secret, server-pinned once chosen, hard 400 on `?date=future`, `Cache-Control: s-maxage=${secondsUntilUtcMidnight()}`. Performs like a static CDN asset while remaining a real per-request check.
- `output: 'export'` is fundamentally incompatible with this. Standard Next.js on Vercel is required.
- **Named bug to design out**: *"the puzzle has rolled over but the streak still thinks it is yesterday"* — caused by two separate day-boundary calculations. Worldle uses **local** midnight and carries a hardcoded `forcedCountries` override map in-repo to patch days its algorithm got wrong.
- localStorage pattern verified across Worldle, Tradle and Globle: `guesses` as `Record<dayString, Guess[]>` retained forever; stats **derived** by folding that dict, never separately mutated ([Tradle stats.ts](https://github.com/alexandersimoes/tradle/blob/89255f7b6795f3a37ba6eccf0aed4cf44b1caa5a/src/domain/stats.ts#L13-L57)).
- SSR: date-derived values are safe during SSR (deterministic, server == client). localStorage reads must live in `useEffect` only, centralized in one hook.
- iOS Safari: `clipboard.writeText()` must run **synchronously inside the user-gesture callstack** or it throws `NotAllowedError`.

**City data**
- GeoNames `cities15000.zip` — 3.2 MB, ~25k records, **CC BY 4.0, attribution required**.
- `alternateNamesV2.zip` is **195 MB** — must stream-filter by geonameid, and drop pseudo-languages `post`/`iata`/`icao`/`faac`/`link`/`wkdt` (airport and postal codes, not name variants).
- GeoNames population is **city-proper/admin, confirmed — not metro**. Metro figures come from UN World Urbanization Prospects (CC BY 4.0, bulk CSV) or citypopulation.de (CC BY 3.0; population only — coordinates may not be redistributed).
- **NFD diacritic-stripping silently fails** on `ø Ø ł Ł đ ß æ þ ı İ` — these have no canonical decomposition. København needs an explicit fold map.
- `@leeoniya/ufuzzy` 7.6 KB vs fuse.js 24.2 KB and **~78x slower** on the same benchmark.
- Haversine is 10 lines, `R = 6371`, 0.3–0.5% error vs Vincenty — imperceptible here.

**Map and visual identity**
- **Do not use react-simple-maps**: React 19 peer-dep friction ([#388](https://github.com/zcreativelabs/react-simple-maps/issues/388)), [#375](https://github.com/zcreativelabs/react-simple-maps/issues/375) contains *"I think this library is dead"*, and it is **33.07 KB gzip** dragging in d3-zoom/d3-drag/d3-transition — all unused on a static reveal. Raw `d3-geo` + `topojson-client` is **~3.2 KB gzip**.
- `world-atlas@2.0.2` → `countries-110m.json` ~108 KB, ISC, Natural Earth derived. Serve from `public/`, never `import` (importing inlines 108 KB into the JS bundle).
- `geoPath` **already adaptively samples** a 2-point LineString into a curved great-circle arc. Use `geoInterpolate` for custom sampling — never a linear lerp on longitude. Set `projection.preclip(geoClipAntimeridian)` or dateline-crossing routes smear across the whole map.
- **`feTurbulence` is not GPU-accelerated** — 6–15 ms/frame for a 600×400 element, worse on mobile; [open Firefox perf bug](https://bugzilla.mozilla.org/show_bug.cgi?id=1879590) and iOS Safari crash reports. Pre-bake full-bleed paper grain to WebP; live filters only on small static accents with a fixed `seed`.
- **`mix-blend-mode: multiply` breaks silently** if any ancestor has `transform`/`filter`/`opacity<1`/`will-change`/`position+z-index` ([WebKit 129154](https://bugs.webkit.org/show_bug.cgi?id=129154)). Requires an `isolation: isolate` wrapper.
- **Caveat covers Latin + Cyrillic only — no Georgian, Japanese, Arabic or Devanagari**, which are exactly the Day 5 scripts. Needs a per-script Noto fallback stack, code-split per language, or Tbilisi renders as tofu boxes.

### Self-Review Gap Analysis

Metis delegation was unavailable (plan-family agents cannot delegate to one another), so gap analysis was performed directly. Nine additional problems were found beyond the original twelve:

| # | Gap | Resolution |
|---|---|---|
| G1 | **6 puzzles with `index % 6` means players see a repeat on day 7** | Puzzles are assigned to **explicit calendar dates**. Past the last date the route returns 404 and the UI shows a designed "the explorer is resting" state. No modulo wrap, ever |
| G2 | Answer city might not exist in the guess pool → literally untypeable | `puzzle-lint` hard-fails unless every answer city resolves to a guess-pool `geonameid` |
| G3 | Aliases mean one city has many names — "München" and "Munich" could be spent as two separate guesses | All guess identity, dedupe and correctness checks key on **`geonameid`**, never on a display string |
| G4 | Empty stats on first-ever play produce `NaN` win rate and `NaN` average Day | Explicit zero-state acceptance criteria on the stats panel |
| G5 | Clue text baked into artefact images would be invisible to screen readers and unselectable | All clue text is **real DOM text** styled to look like a sign/napkin. Artefacts are CSS/SVG decoration only |
| G6 | `population_description` authored independently of the number will contradict it | Description is **derived** from the number by a pure, unit-tested function using §5's bands |
| G7 | Flag asset licensing unaddressed | `flag-icons` (MIT) for flag SVGs; hand-authored colour sets; lint checks declared colours against a per-country allowlist |
| G8 | Timer semantics undefined — a tab left open for 3 hours would record a 3-hour solve | Elapsed time recorded from first clue view, persisted across reloads, no pause. **No visible ticking clock** — §10 explicitly does not want speed to dominate. Shown in the result, used only as a tiebreaker |
| G9 | Two-page journal spread is a desktop metaphor and breaks at 390 px | Spread collapses to a single scrolling column on mobile — specified, not improvised |

---

## Work Objectives

### Core Objective
Ship a genuinely playable, mobile-first daily geography deduction game that proves the five-clue ladder is fun, wrapped in a distinctive "explorer's field journal" visual identity, with future clues structurally unreachable from the client.

### Concrete Deliverables
- Next.js app at repo root, deployable to Vercel, `bun run build` clean
- `GET /api/daily?stage=N` — HMAC-selected, server-pinned, date-gated clue delivery
- Five clue artefact components (horizon sketch, road sign, flag cloth, map fragment, napkin phrase)
- City autocomplete over ~25k cities with alias + diacritic + geonameid-keyed matching
- `scripts/build-city-pool.ts` — GeoNames pipeline producing the trimmed guess pool
- `scripts/puzzle-lint.ts` — executable enforcement of spec §17
- 6 hand-verified puzzle JSON files with sources
- End-of-game journal spread with d3-geo antique world map and great-circle arcs
- Stats panel, streak, spoiler-free emoji share string
- Unit tests for all pure logic; Playwright QA evidence for every task

### Definition of Done
- [ ] `bun run build` exits 0 with no TypeScript errors
- [ ] `bun test` passes with zero failures
- [ ] `bun run puzzle-lint` passes for all 6 puzzles
- [ ] `curl "localhost:3000/api/daily?date=2099-01-01"` returns HTTP 400
- [ ] A full playthrough solving on Day 3 is captured as Playwright evidence
- [ ] A full playthrough losing on Day 5 is captured as Playwright evidence
- [ ] Day 5's clue text is absent from all network responses until Day 5 is unlocked
- [ ] Share string contains no city or country name, asserted by a unit test
- [ ] Lighthouse mobile accessibility score ≥ 90

### Must Have
- One mystery city per day, identical for all players, resetting at 00:00 UTC
- Exactly five clue Days in the fixed order: geography → relative geography → national identity → historical geography → language
- One guess per Day, maximum five; wrong-guess count recorded
- GUESS and CONTINUE on Days 1–4; **FINAL GUESS only on Day 5, no CONTINUE**
- Wrong-guess feedback as distance bands, behind a config flag
- A single `getPuzzleDayKey()` used by **both** puzzle selection and streak logic
- All guess identity keyed on `geonameid`
- Clue text as real DOM text, never baked into images
- Mobile-first; `prefers-reduced-motion` honoured
- GeoNames CC BY 4.0 attribution visible in the app

### Must NOT Have (Guardrails)
Spec sections an executor may wrongly pull into v1 — all are explicitly **out**, per §20:
- Leaderboards of any kind (§14), daily/weekly/monthly/friends/global
- User accounts, authentication, friends system, any backend database for players
- Achievements, badges, XP
- Audio pronunciation of the Day 5 phrase (§22.11)
- Multiple game modes or difficulty selection (§9's Easy/Standard/Hard classification)
- Playing previous missed puzzles / an archive (§22.9)
- Animated route-drawing between guesses on the map (§22.10) — static arcs only
- Admin UI or CMS for puzzle authoring — hand-edited JSON only
- Internationalization of the UI itself (Day 5 clue text is native-script; the UI is English)
- Dark mode in v1 (build with CSS custom properties so it is a later variable swap)
- Generated share **image** in v1 (emoji text share only)

AI-slop patterns explicitly forbidden:
- No plugin architecture, registry, or generic "puzzle engine" abstraction for five fixed clue types
- No `types.ts` god-file — types live beside their domain
- No procedural/generative art system for the Day 1 horizon; a small fixed set of hand-made SVG motifs keyed to the landscape enum
- No animation library (framer-motion, GSAP) — CSS keyframes and transitions only
- No `lodash`, no `moment`, no `luxon` (UTC arithmetic needs none), no haversine package
- No PWA, service worker, offline manifest, or analytics
- No JSDoc on self-evident functions; no comments restating the code
- No defensive validation beyond what the data contract requires
- No component library build-out — build only the components the screens need
- No `as any`, no `@ts-ignore`, no empty catch blocks

---

## Verification Strategy

> **ZERO HUMAN INTERVENTION** — all verification is agent-executed. Acceptance criteria requiring "the user manually confirms" are forbidden.

### Test Decision
- **Infrastructure exists**: NO — created in Task 1
- **Automated tests**: TDD on pure logic only
- **Framework**: `bun test`
- **TDD scope** (RED → GREEN → REFACTOR mandatory): haversine + distance bands, daily clock / puzzle index, text normalization + fold map, population and distance formatting, population-description derivation, game state reducer, stats + streak folding, share-string generation, `puzzle-lint` rules
- **TDD explicitly NOT applied to**: presentational components, layout, CSS, artefact visuals — Playwright QA covers these at lower maintenance cost

### QA Policy
Every task carries agent-executed QA scenarios. Evidence written to `.sisyphus/evidence/task-{N}-{slug}.{ext}`.

- **UI**: Playwright — navigate, interact, assert DOM, screenshot
- **CLI / scripts**: `Bash` — run, assert stdout and exit code
- **API**: `Bash` + `curl` — assert status codes and JSON fields
- **Pure modules**: `bun test` — assert pass counts

---

## Execution Strategy

### Parallel Execution Waves

```
Wave 1 (start immediately — foundation, zero dependencies):
├── Task 1:  Repo init + Next.js scaffold + toolchain        [quick]
├── Task 2:  Design tokens + fonts + paper texture           [visual-engineering]
├── Task 3:  Domain types + zod schemas                      [quick]
├── Task 4:  Geo maths — haversine + distance bands (TDD)    [quick]
├── Task 5:  Daily clock — epoch, day key, index (TDD)       [ultrabrain]
├── Task 6:  Text normalization + diacritic fold map (TDD)   [unspecified-high]
├── Task 7:  Clue formatting + population bands (TDD)        [quick]
└── Task 8:  GeoNames city-pool pipeline script              [deep]

Wave 2 (after Wave 1 — core modules):
├── Task 9:  6 curated puzzle data files + sources           [deep]
├── Task 10: Flag colour data + flag-icons integration       [quick]
├── Task 11: Server daily route handler (HMAC + date gate)   [ultrabrain]
├── Task 12: localStorage persistence + stats/streak fold    [ultrabrain]
├── Task 13: City autocomplete engine (uFuzzy + geonameid)   [unspecified-high]
├── Task 14: Game state reducer (TDD)                        [ultrabrain]
├── Task 15: Journal shell layout + paper stage              [visual-engineering]
└── Task 16: Stamp + artefact primitives                     [visual-engineering]

Wave 3 (after Wave 2 — features):
├── Task 17: puzzle-lint script + CI wiring                  [deep]
├── Task 18: Clue artefacts, Days 1–3                        [visual-engineering]
├── Task 19: Clue artefacts, Days 4–5 + Noto fallbacks       [visual-engineering]
├── Task 20: Guess input UI + autocomplete dropdown          [visual-engineering]
├── Task 21: Antique world map component (d3-geo)            [artistry]
└── Task 22: Game screen wiring — full playable loop         [deep]

Wave 4 (after Wave 3 — surrounding experience):
├── Task 23: Endgame journal spread + reveal                 [visual-engineering]
├── Task 24: Stats panel + distribution bars                 [visual-engineering]
├── Task 25: Share string + clipboard triple-fallback        [unspecified-high]
├── Task 26: Countdown + "explorer is resting" empty state   [quick]
└── Task 27: Accessibility + reduced-motion + mobile pass    [unspecified-high]

Wave 5 (after Wave 4 — ship):
├── Task 28: README + licence attribution + env docs         [writing]
└── Task 29: Vercel deploy config + prod secret hardening    [quick]

Wave FINAL (after ALL tasks — 4 parallel reviews, then explicit user approval):
├── Task F1: Plan compliance audit          (oracle)
├── Task F2: Code quality review            (unspecified-high)
├── Task F3: Real manual QA                 (unspecified-high)
└── Task F4: Scope fidelity check           (deep)
-> Present consolidated results -> WAIT for explicit user "okay"

Critical Path: 1 → 3 → 11 → 22 → 23 → 27 → F1-F4 → user approval
Max Concurrent: 8 (Waves 1 and 2)
Parallel Speedup: ~65% vs sequential
```

### Dependency Matrix

| Task | Depends On | Blocks |
|---|---|---|
| 1 | — | 2, 11, 15, 29 |
| 2 | 1 | 15, 16, 18, 19, 21 |
| 3 | — | 9, 11, 12, 14, 17 |
| 4 | — | 14, 17, 21, 22 |
| 5 | — | 11, 12, 26 |
| 6 | — | 13, 17 |
| 7 | — | 17, 18 |
| 8 | — | 10, 13, 17 |
| 9 | 3 | 17, 18, 19 |
| 10 | 8 | 19 |
| 11 | 1, 3, 5, 9 | 22, 26 |
| 12 | 3, 5 | 22, 24, 25 |
| 13 | 6, 8 | 20 |
| 14 | 3, 4 | 22, 25 |
| 15 | 1, 2 | 22, 24 |
| 16 | 2 | 18, 19, 20 |
| 17 | 3, 4, 6, 7, 8, 9 | 29 |
| 18 | 2, 7, 9, 16 | 22 |
| 19 | 2, 9, 10, 16 | 22 |
| 20 | 13, 16 | 22 |
| 21 | 2, 4 | 23 |
| 22 | 11, 12, 14, 15, 18, 19, 20 | 23, 25, 27 |
| 23 | 21, 22 | 27 |
| 24 | 12, 15 | 27 |
| 25 | 12, 14, 22 | 27 |
| 26 | 5, 11 | 27 |
| 27 | 22, 23, 24, 25, 26 | 28, 29 |
| 28 | 27 | — |
| 29 | 1, 17, 27 | — |

### Agent Dispatch Summary

| Wave | Count | Dispatch |
|---|---|---|
| 1 | 8 | T1 `quick` · T2 `visual-engineering` · T3 `quick` · T4 `quick` · T5 `ultrabrain` · T6 `unspecified-high` · T7 `quick` · T8 `deep` |
| 2 | 8 | T9 `deep` · T10 `quick` · T11 `ultrabrain` · T12 `ultrabrain` · T13 `unspecified-high` · T14 `ultrabrain` · T15 `visual-engineering` · T16 `visual-engineering` |
| 3 | 6 | T17 `deep` · T18 `visual-engineering` · T19 `visual-engineering` · T20 `visual-engineering` · T21 `artistry` · T22 `deep` |
| 4 | 5 | T23 `visual-engineering` · T24 `visual-engineering` · T25 `unspecified-high` · T26 `quick` · T27 `unspecified-high` |
| 5 | 2 | T28 `writing` · T29 `quick` |
| FINAL | 4 | F1 `oracle` · F2 `unspecified-high` · F3 `unspecified-high` · F4 `deep` |

---

## TODOs

- [ ] 1. Repo init + Next.js scaffold + toolchain

  **What to do**:
  - `git init` inside `/home/juanitolillig/LostExplorer`. This directory currently sits inside a git repo rooted at `$HOME` containing unrelated Shopify "Matrix Theme" work — the new repo must be independent.
  - Scaffold a Next.js App Router app with TypeScript and Tailwind at the repo root, using bun as package manager and runner.
  - `tsconfig.json`: `strict: true`, `noUncheckedIndexedAccess: true`.
  - Add `.gitignore` covering `node_modules`, `.next`, `.env*.local`, `.sisyphus/evidence`, and the raw GeoNames downloads directory.
  - Add `package.json` scripts: `dev`, `build`, `start`, `test`, `lint`, `typecheck` (`tsc --noEmit`), plus placeholders `build-city-pool` and `puzzle-lint` that currently exit 0.
  - Create `.env.example` documenting `LOST_EXPLORER_DAILY_SECRET` with a comment explaining that its absence enables dev mode.
  - Verify `bun test` runs (bun has a built-in test runner — no vitest or jest needed).
  - Keep `initial.txt` in the repo as the design reference.

  **Must NOT do**:
  - Do not use `output: 'export'` — it is incompatible with the date-gated route handler in Task 11.
  - Do not install vitest, jest, framer-motion, gsap, lodash, luxon, moment, or any map library.
  - Do not scaffold example pages, boilerplate components, or a component library.
  - Do not add a PWA manifest, service worker, or analytics.
  - Do not add an ESLint config with custom rules beyond the Next.js default.

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Mechanical scaffolding with a well-known toolchain; no design judgement or hard logic.
  - **Skills**: none
  - **Skills Evaluated but Omitted**:
    - `test-driven-development`: no application logic is written here, only config.

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 2–8)
  - **Blocks**: 2, 11, 15, 29
  - **Blocked By**: None — can start immediately

  **References**:

  **External References**:
  - Next.js App Router setup: `https://nextjs.org/docs/app/getting-started/installation` — canonical scaffold, and the `src/app` directory convention.
  - Tailwind with Next.js: `https://tailwindcss.com/docs/installation/framework-guides/nextjs` — correct PostCSS wiring for the App Router.
  - bun test runner: `https://bun.sh/docs/cli/test` — confirms zero-config test support; this is why no test framework is installed.
  - `https://nextjs.org/docs/app/api-reference/config/next-config-js/output` — read specifically to confirm why `output: 'export'` must be avoided.

  **WHY Each Reference Matters**:
  - The `output: 'export'` doc is included so the executor understands the constraint is architectural, not stylistic — static export removes the server that Task 11 depends on.

  **Acceptance Criteria**:
  - [ ] `git -C /home/juanitolillig/LostExplorer rev-parse --show-toplevel` prints `/home/juanitolillig/LostExplorer`, NOT `/home/juanitolillig`
  - [ ] `bun run build` exits 0
  - [ ] `bunx tsc --noEmit` exits 0
  - [ ] `bun test` exits 0 (zero tests is acceptable at this stage)
  - [ ] `.env.example` exists and contains `LOST_EXPLORER_DAILY_SECRET`
  - [ ] `grep -r "output.*export" next.config.*` returns no match

  **QA Scenarios**:

  ```
  Scenario: Dev server boots and serves a page
    Tool: Bash + Playwright
    Preconditions: Dependencies installed via `bun install`
    Steps:
      1. Run `bun run dev` in the background; wait for stdout to contain "Ready" (timeout: 30s)
      2. Playwright: navigate to http://localhost:3000
      3. Assert HTTP response status is 200
      4. Assert document.title is a non-empty string
      5. Screenshot the viewport at 390x844 (mobile)
    Expected Result: Page loads with status 200, no console errors of level "error"
    Failure Indicators: Port already in use, build error overlay visible, 500 response
    Evidence: .sisyphus/evidence/task-1-dev-server-boots.png

  Scenario: Repo is independent of the home-directory git repo
    Tool: Bash
    Preconditions: git init has been run
    Steps:
      1. Run `git -C /home/juanitolillig/LostExplorer rev-parse --show-toplevel`
      2. Assert stdout is exactly `/home/juanitolillig/LostExplorer`
      3. Run `git -C /home/juanitolillig/LostExplorer status --short` and assert no "Matrix Theme" paths appear
    Expected Result: toplevel is the LostExplorer directory; no unrelated home-directory files are tracked or listed
    Failure Indicators: toplevel prints /home/juanitolillig, or status lists Shopify theme files
    Evidence: .sisyphus/evidence/task-1-git-isolation.txt
  ```

  **Evidence to Capture**:
  - [ ] `task-1-dev-server-boots.png`
  - [ ] `task-1-git-isolation.txt`

  **Commit**: YES
  - Message: `chore: scaffold Next.js app with bun and tailwind`
  - Files: `package.json`, `tsconfig.json`, `next.config.ts`, `postcss.config.mjs`, `.gitignore`, `.env.example`, `src/app/**`
  - Pre-commit: `bun run build`

- [ ] 2. Design tokens + fonts + paper texture

  **What to do**:
  - Define the full "field journal" token set as CSS custom properties in the global stylesheet, scoped under a single `:root` block so a future dark mode is a variable swap only.
  - Palette tokens: `--paper` (aged cream), `--ink` (near-black india ink), `--stamp-red` (oxblood — the single hot accent), `--brass` (ochre), `--map-teal` (faded water). Plus derived tokens for borders, muted text, and the artefact tape colour.
  - Wire fonts via `next/font/google` (self-hosted at build time, zero runtime requests to Google). `subsets` must be stated explicitly or the build errors:
    - `Rye` (OFL) → `--font-display`, for the logo and DAY/FOUND/LOST stamps
    - `Special Elite` (Apache-2.0) → `--font-stamp`, for date-stamp metadata
    - `Caveat` (OFL) → `--font-journal`, for explorer narration; subsets `['latin','latin-ext','cyrillic']`
    - `Geist` or `Inter` (OFL) → `--font-ui`, for UI, numbers and stats
  - Produce the full-bleed paper texture as a **pre-baked tileable WebP** (target 5–20 KB) in `public/textures/`, applied via `background-image`. Do **not** use a live `feTurbulence` filter for the full-bleed background.
  - Define a `.stage { isolation: isolate }` utility. Document in a brief comment that `mix-blend-mode: multiply` ink layers must live inside it, and that no intermediate ancestor may carry `transform`, `filter`, `opacity < 1`, or `will-change`.
  - Set a minimum legible size for `--font-journal` on mobile (handwriting faces degrade badly below ~17px) and encode it as a token.
  - Add a global `@media (prefers-reduced-motion: reduce)` block that disables animations and drops decorative SVG filters.

  **Must NOT do**:
  - Do not build a component library, Storybook, or a theme-provider abstraction.
  - Do not implement dark mode in v1 — only make it *possible* via the variable structure.
  - Do not use live `feTurbulence` on any full-bleed or large surface.
  - Do not load fonts from a Google CDN URL at runtime.
  - Do not add the Noto script fallbacks here — those are Task 19, code-split per clue language.

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
    - Reason: This is the aesthetic foundation every other visual task inherits; it needs genuine design judgement on palette, type scale, and texture weight.
  - **Skills**: none
  - **Skills Evaluated but Omitted**:
    - `frontend-ui-ux`: the design direction is already specified in detail below; the task is execution of a defined identity, not discovery.

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 1, 3–8)
  - **Blocks**: 15, 16, 18, 19, 21
  - **Blocked By**: 1

  **References**:

  **External References**:
  - `https://nextjs.org/docs/app/getting-started/fonts` — the `next/font/google` API, including that `subsets` is mandatory and that fonts are self-hosted at build time.
  - `https://fonts.google.com/specimen/Rye` — confirm OFL licence and that it ships a single 400 weight.
  - `https://fonts.google.com/specimen/Caveat` — confirm OFL, and that coverage is Latin + Latin-Ext + Cyrillic only. **Georgian, Japanese, Arabic and Devanagari are NOT covered** — do not assume otherwise; Task 19 handles those.
  - `https://developer.mozilla.org/en-US/docs/Web/CSS/mix-blend-mode` — the stacking-context rule that makes `isolation: isolate` necessary.
  - `https://bugs.webkit.org/show_bug.cgi?id=129154` — the concrete WebKit bug where blend modes silently fail; read to understand why intermediate `transform` is forbidden.
  - `https://bugzilla.mozilla.org/show_bug.cgi?id=1879590` — open Firefox perf regression on animated `feTurbulence`; the reason the paper texture is pre-baked.

  **Design Direction** (this is the identity every later visual task inherits):
  - The UI is a physical object, not a web page with a paper background.
  - Limited palette is the "bold" lever — one hot accent (`--stamp-red`) against cream and ink. Resist adding more hues.
  - Bold scale contrast: the display face should be used at genuinely large sizes against small clean UI text.

  **WHY Each Reference Matters**:
  - The Caveat specimen is listed specifically so the executor sees the script-coverage gap first-hand rather than discovering it when Tbilisi renders as tofu boxes.
  - The WebKit and Firefox bug links justify two non-obvious constraints (`isolation: isolate`, pre-baked texture) that would otherwise look like arbitrary restrictions and get "simplified away".

  **Acceptance Criteria**:
  - [ ] `bun run build` exits 0
  - [ ] All five palette tokens and all four font tokens are defined in `:root`
  - [ ] Paper texture file exists in `public/textures/` and is under 25 KB (`ls -la`)
  - [ ] `grep -r "fonts.googleapis.com" src/` returns no match (fonts are self-hosted)
  - [ ] A `prefers-reduced-motion` media block exists in the global stylesheet

  **QA Scenarios**:

  ```
  Scenario: Tokens and fonts resolve in the browser
    Tool: Playwright
    Preconditions: Dev server running
    Steps:
      1. Navigate to http://localhost:3000
      2. Evaluate getComputedStyle(document.documentElement).getPropertyValue('--paper') and assert it is a non-empty colour value
      3. Repeat for --ink, --stamp-red, --brass, --map-teal — assert all five non-empty
      4. Evaluate getComputedStyle(document.documentElement).getPropertyValue('--font-display') and assert the string contains "Rye"
      5. Assert document.fonts.check('1em Rye') returns true after document.fonts.ready
      6. Screenshot at 1280x800 and at 390x844
    Expected Result: All five colour tokens and all four font tokens resolve; Rye and Caveat are loaded per document.fonts.check
    Failure Indicators: Any token resolves to empty string; document.fonts.check returns false; fallback serif visibly rendering in the screenshot
    Evidence: .sisyphus/evidence/task-2-tokens-resolve.png

  Scenario: No external font requests are made at runtime
    Tool: Playwright
    Preconditions: Dev server running
    Steps:
      1. Start network interception, recording all request URLs
      2. Navigate to http://localhost:3000 and wait for networkidle
      3. Assert zero recorded request URLs contain "fonts.googleapis.com" or "fonts.gstatic.com"
      4. Write the full request URL list to the evidence file
    Expected Result: Zero requests to Google font domains — all fonts served from the app's own origin
    Failure Indicators: Any gstatic/googleapis font request present
    Evidence: .sisyphus/evidence/task-2-no-external-fonts.txt
  ```

  **Evidence to Capture**:
  - [ ] `task-2-tokens-resolve.png`
  - [ ] `task-2-no-external-fonts.txt`

  **Commit**: YES
  - Message: `feat(ui): add journal design tokens and font system`
  - Files: `src/app/globals.css`, `src/app/layout.tsx`, `src/styles/fonts.ts`, `public/textures/paper.webp`
  - Pre-commit: `bun run build`

- [ ] 3. Domain types + zod schemas

  **What to do**:
  - Define the puzzle schema with zod, modelling all five clue Days plus provenance. Derive TypeScript types with `z.infer` — do not hand-write parallel interfaces.
  - Puzzle fields: `id`, `city`, `country`, `countryCode`, `geonameId`, `coordinates {lat,lng}`, `publishDate` (ISO `YYYY-MM-DD`).
  - Day 1: `landscape` (enum drawn from §5's list — flat, hilly, mountainous, mountains-visible, mountains-surrounding, coastal, lakeside, river, dry, tropical, green-hills, desert, high-altitude), `metroPopulationMillions` (number), `populationSource` (object with `name`, `url`, `asOfYear`). **Do not** store a `populationDescription` field — it is derived at render time by Task 7's pure function, so the two can never contradict (gap G6).
  - Day 2: `referenceCity`, `referenceCityCountry`, `referenceCityCoordinates`, `distanceKm`, `recognisability` (enum: `global` | `regional`). Store the reference coordinates so `puzzle-lint` can verify the stated distance against haversine.
  - Day 3: `flagColours` (array of colour enum — the **full** palette, per decision P2), and the reveal policy is "all of them".
  - Day 4: `mapYear` (number), `historicalEntity` (string, neutral wording per §18), `historicalSourceUrl` (required — gap P10 means no script can fact-check this, so provenance is mandatory).
  - Day 5: `language`, `languageCode`, `helpPhrase`, `helpPhraseTranslation` (revealed only post-game).
  - Define the game-state schema: `GuessRecord` (`geonameId`, `displayName`, `country`, `distanceKm`, `band`, `dayGuessed`), `DailyGameState` (`dayKey`, `currentDay` 1–5, `guesses`, `status`: `in_progress` | `won` | `lost`, `startedAtMs`).
  - Define the **versioned** persistence schema (gap P11): a discriminated union on a `_v` literal, with a `transform` migrating older versions forward. Export a single `parsePersisted(raw: unknown)` that returns valid state or a documented default — never throws.
  - All guess identity is keyed on `geonameId`, never on a display string (gap G3). Encode this in the types so a `string` city name cannot be passed where an identity is expected.

  **Must NOT do**:
  - Do not create a single `types.ts` god-file — co-locate schemas with their domain (`src/domain/puzzle.ts`, `src/domain/game.ts`, `src/domain/persistence.ts`).
  - Do not hand-write interfaces that duplicate a zod schema; use `z.infer`.
  - Do not add fields for deferred features: no difficulty rating, no leaderboard fields, no user id, no audio URL.
  - Do not add a `populationDescription` field (see above).
  - Do not build a generic/pluggable clue abstraction — five fixed, explicitly-typed Days.

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Schema definition is mechanical once the field list is specified, and the field list is fully specified above.
  - **Skills**: none
  - **Skills Evaluated but Omitted**:
    - `test-driven-development`: schemas are declarative; the meaningful tests belong to the parsers and reducers that consume them (Tasks 12, 14).

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 1, 2, 4–8)
  - **Blocks**: 9, 11, 12, 14, 17
  - **Blocked By**: None — can start immediately

  **References**:

  **Pattern References**:
  - `initial.txt:645-665` — the spec's own proposed JSON data model. Use it as the starting shape, then apply the documented divergences: no `population_description` (derived), full `flagColours` array instead of a single colour, added `recognisability`, added `historicalSourceUrl`, added `populationSource`.
  - `initial.txt:160-177` — the authoritative list of Day 1 environment observations; the `landscape` enum must cover these.
  - `initial.txt:667-678` — the spec's list of fields to add "later"; implement only `source`, population year, and country code. Difficulty estimate and time zone are out of scope.

  **External References**:
  - `https://zod.dev/?id=discriminated-unions` — the versioning pattern for the persistence schema.
  - `https://zod.dev/?id=safeparse` — `safeParse` + fallback-to-default; `parsePersisted` must never throw on malformed localStorage.
  - `https://github.com/SebastianJarsve/zod-persist` — reference implementation of versioned localStorage with a migration map. Read for the shape of the approach; do **not** install it.
  - `https://github.com/AndrewBastin/verzod` — second reference implementation; its `versionMap` + auto-migrating `safeParse` is the closest analogue to what is needed here.

  **WHY Each Reference Matters**:
  - `initial.txt:645-665` is the user's own data model, so matching its field naming where possible keeps the plan legible against the source spec; the divergences are deliberate fixes to P2/P9/P10 and must not be silently reverted to the original shape.
  - zod-persist and verzod are cited as *reference reading only* — the migration logic here is ~20 lines and a dependency is not warranted.

  **Acceptance Criteria**:
  - [ ] `bunx tsc --noEmit` exits 0
  - [ ] `bun test` exits 0
  - [ ] No file named `types.ts` exists under `src/` (`find src -name types.ts` returns empty)
  - [ ] `grep -rn "populationDescription\|population_description" src/domain/` returns no match
  - [ ] `parsePersisted(undefined)`, `parsePersisted("{}")` and `parsePersisted('{"_v":999}')` each return the default state without throwing

  **QA Scenarios**:

  ```
  Scenario: Schemas accept a valid puzzle and reject a malformed one
    Tool: Bash (bun)
    Preconditions: Schemas implemented
    Steps:
      1. Write a scratch script that imports the puzzle schema and calls safeParse on a complete, valid Tbilisi-shaped object (all Day 1-5 fields, valid coordinates, required historicalSourceUrl)
      2. Assert result.success === true
      3. Call safeParse on the same object with historicalSourceUrl deleted; assert result.success === false
      4. Call safeParse with landscape set to "banana"; assert result.success === false
      5. Call safeParse with coordinates.lat set to 200; assert result.success === false
      6. Print each outcome and exit non-zero if any assertion fails
    Expected Result: Valid object parses; each of the three malformed variants is rejected. Script exits 0.
    Failure Indicators: A malformed object parses successfully, meaning the schema is too permissive
    Evidence: .sisyphus/evidence/task-3-schema-validation.txt

  Scenario: Corrupt localStorage never throws and never loses the default
    Tool: Bash (bun)
    Preconditions: parsePersisted implemented
    Steps:
      1. Call parsePersisted(undefined) — assert it returns the documented default, does not throw
      2. Call parsePersisted("not json at all") — assert default returned, no throw
      3. Call parsePersisted('{"_v":1,"streak":5}') — assert it migrates forward to the current version and preserves streak 5
      4. Call parsePersisted('{"_v":999,"garbage":true}') — assert default returned, no throw
    Expected Result: All four inputs return a valid current-version state object; zero exceptions thrown; the v1 input's streak value survives migration
    Failure Indicators: Any call throws; migration drops the streak value
    Evidence: .sisyphus/evidence/task-3-persistence-migration.txt
  ```

  **Evidence to Capture**:
  - [ ] `task-3-schema-validation.txt`
  - [ ] `task-3-persistence-migration.txt`

  **Commit**: YES
  - Message: `feat(domain): add puzzle and game zod schemas`
  - Files: `src/domain/puzzle.ts`, `src/domain/game.ts`, `src/domain/persistence.ts`
  - Pre-commit: `bun test`

- [ ] 4. Geo maths — haversine + distance bands (TDD)

  **What to do**:
  - **RED first**: write failing tests before any implementation.
  - Implement `haversineKm(lat1, lng1, lat2, lng2): number` — ~10 lines, `R = 6371`, no dependency.
  - Implement `distanceBand(km): 'very-close' | 'close' | 'far' | 'very-far'` using §8's thresholds: `<250` very close, `<750` close, `<2000` far, `>=2000` very far.
  - Implement `formatBand(band)` returning the player-facing phrasing in the explorer's voice.
  - Implement a single config flag `FEEDBACK_MODE: 'bands' | 'exact'` (decision P4) and `formatGuessFeedback(km, mode)` that routes on it. Default `'bands'`.
  - Tests must cover: a known-distance pair verified against an independent source (London↔Paris ≈ 344 km, tolerance ±5 km), identical points returning 0, antipodal points returning ≈20015 km, both hemispheres, a dateline-crossing pair (Anchorage↔Petropavlovsk-Kamchatsky) returning a plausible short distance rather than a near-circumference value, and **exact boundary values** 249/250/749/750/1999/2000 for band classification.

  **Must NOT do**:
  - Do not install a haversine or geolib package — this is 10 lines.
  - Do not implement Vincenty; 0.3–0.5% error is imperceptible at this game's scale.
  - Do not add bearing/direction calculation — §8 explicitly excludes direction from wrong-guess feedback, and adding it would overpower the clue ladder.

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Small, well-specified pure function with a canonical reference implementation.
  - **Skills**: [`test-driven-development`]
    - `test-driven-development`: TDD is mandated for this module; the skill enforces strict RED-GREEN-REFACTOR ordering.

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 1–3, 5–8)
  - **Blocks**: 14, 17, 21, 22
  - **Blocked By**: None — can start immediately

  **References**:

  **External References**:
  - `https://www.movable-type.co.uk/scripts/latlong.html` — the canonical haversine reference implementation cited across the ecosystem, including the `atan2` form and the `R = 6371` constant.
  - `initial.txt:430-436` — the four distance bands and their exact thresholds. These are the authoritative numbers; do not invent different cut-offs.
  - `initial.txt:426-428` — the explicit instruction that direction must NOT be provided, and why (it would make the game resemble existing city-direction games and overpower the clue progression).

  **WHY Each Reference Matters**:
  - `initial.txt:426-428` is included because adding a compass bearing is an obvious-seeming "improvement" that the spec explicitly forbids for sound design reasons.

  **Acceptance Criteria**:
  - [ ] Test file exists at `src/domain/geo.test.ts` and was committed in a failing state first (verifiable in `git log -p`)
  - [ ] `bun test src/domain/geo.test.ts` → PASS, at least 12 assertions, 0 failures
  - [ ] `haversineKm(51.5074,-0.1278,48.8566,2.3522)` returns 344 ± 5
  - [ ] `haversineKm(0,0,0,0)` returns exactly 0
  - [ ] `distanceBand(249)` is `'very-close'` and `distanceBand(250)` is `'close'`
  - [ ] `distanceBand(1999)` is `'far'` and `distanceBand(2000)` is `'very-far'`
  - [ ] `grep -rn "bearing\|azimuth" src/domain/geo.ts` returns no match

  **QA Scenarios**:

  ```
  Scenario: Distances match independently-known real-world values
    Tool: Bash (bun test)
    Preconditions: Implementation complete
    Steps:
      1. Run `bun test src/domain/geo.test.ts --reporter=verbose` and capture full output
      2. Assert the output reports 0 failures
      3. Assert the London-Paris case (344km +/-5) is present and passing by name in the output
      4. Assert the antipodal case (~20015km) is present and passing
      5. Assert the dateline case (Anchorage-Petropavlovsk) is present and passing, and that its asserted value is under 4000km (NOT a near-circumference value, which would indicate a longitude-wrapping bug)
    Expected Result: All tests pass; the dateline case proves longitude wrapping is handled correctly
    Failure Indicators: Dateline case asserts a value above 15000km, meaning the formula took the long way round
    Evidence: .sisyphus/evidence/task-4-haversine-tests.txt

  Scenario: Band boundaries are exact, not approximate
    Tool: Bash (bun)
    Preconditions: distanceBand implemented
    Steps:
      1. Write a scratch script iterating the values [0, 249, 250, 749, 750, 1999, 2000, 20000]
      2. Print distanceBand(v) for each
      3. Assert the exact sequence: very-close, very-close, close, close, far, far, very-far, very-far
      4. Exit non-zero on any mismatch
    Expected Result: Boundary values classify exactly as specified; 250 is 'close' not 'very-close' (thresholds are exclusive upper bounds)
    Failure Indicators: Off-by-one at any boundary, indicating <= vs < confusion
    Evidence: .sisyphus/evidence/task-4-band-boundaries.txt
  ```

  **Evidence to Capture**:
  - [ ] `task-4-haversine-tests.txt`
  - [ ] `task-4-band-boundaries.txt`

  **Commit**: YES
  - Message: `feat(geo): add haversine distance and bands`
  - Files: `src/domain/geo.ts`, `src/domain/geo.test.ts`
  - Pre-commit: `bun test`

- [ ] 5. Daily clock — epoch, day key, puzzle index (TDD)

  **What to do**:
  - **RED first.** This module is the single most bug-prone piece of the system; research identified a named production bug caused by duplicating this logic.
  - Create `src/domain/dailyClock.ts` exporting:
    - `EPOCH_UTC` — a single `Date.UTC(...)` constant at 00:00:00.000 UTC (decision: 00:00 UTC)
    - `DAY_MS = 86_400_000`
    - `daysSinceEpoch(nowMs = Date.now()): number`
    - `getPuzzleDayKey(nowMs = Date.now()): string` → `YYYY-MM-DD` in **UTC**
    - `secondsUntilNextUtcMidnight(nowMs = Date.now()): number`
    - `nextUtcMidnightMs(nowMs = Date.now()): number`
  - **HARD CONSTRAINT**: this is the *only* module in the codebase permitted to compute a day boundary. Tasks 11, 12 and 26 must import from here. Research named the exact failure mode of violating this: *"the puzzle has rolled over but the streak still thinks it is yesterday."*
  - All functions take an injectable `nowMs` so tests control time without mocking globals.
  - Tests must cover: `getPuzzleDayKey` at exactly 00:00:00.000 UTC, at 23:59:59.999 UTC, and one millisecond either side of a boundary; that `daysSinceEpoch` increments by exactly 1 across a boundary; that a timestamp in a `UTC+13` local context still yields the UTC day key (verifying no local-time leakage); `secondsUntilNextUtcMidnight` at 23:59:59 returning 1; and that no function's result varies with the host `TZ` environment variable.

  **Must NOT do**:
  - Do not install luxon, date-fns, dayjs or moment — UTC arithmetic needs none.
  - Do not use `new Date().getDate()`, `getMonth()`, `getFullYear()`, `toLocaleDateString()` or any other local-time accessor. Use `Date.UTC`, `getUTC*`, and `toISOString()` only.
  - Do not add a per-puzzle override/forcing map. Worldle carries one as a patch for its own broken algorithm; correct date assignment (Task 9/11) makes it unnecessary.
  - Do not implement puzzle *selection* here — that is Task 11. This module provides only the clock.

  **Recommended Agent Profile**:
  - **Category**: `ultrabrain`
    - Reason: Off-by-one and timezone-leakage errors here silently corrupt both puzzle delivery and every user's streak. The surface is small but the correctness bar is absolute.
  - **Skills**: [`test-driven-development`]
    - `test-driven-development`: boundary conditions are the entire substance of this module; tests must be written first to define them.

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 1–4, 6–8)
  - **Blocks**: 11, 12, 26
  - **Blocked By**: None — can start immediately

  **References**:

  **External References**:
  - `https://dev.to/horushe/the-date-is-your-database-building-a-daily-puzzle-game-with-no-backend-2c56` — the production postmortem that names the bug this module exists to prevent, and supplies the `EPOCH_UTC` + `DAY_MS` + `daysSinceEpoch` pattern verbatim. Read the section on reusing one day-key function for both selection and streaks.
  - `https://github.com/markgalassi/worldle/blob/001ec783bd3203b241aeba8e53370a2cae0fe54a/src/components/Game.tsx#L19-L21` — Worldle's `getDayString()` using **local** midnight. This is the anti-pattern: read it to understand precisely what not to do.
  - `https://github.com/markgalassi/worldle/blob/001ec783bd3203b241aeba8e53370a2cae0fe54a/src/hooks/useCountry.ts#L10-L26` — Worldle's `forcedCountries` override map, the in-repo patch for days its algorithm got wrong. Evidence of what duplicated/incorrect date logic costs.
  - `initial.txt:66-98` — the gameplay loop this clock drives, confirming one puzzle per day.
  - `initial.txt:22-29` — "the same puzzle for every player", the requirement that forces UTC over local midnight.

  **WHY Each Reference Matters**:
  - The two Worldle links are deliberately included as *negative* examples with exact line ranges — the executor should see a real shipped game's local-midnight bug and its override-map workaround, so the UTC constraint reads as a lesson rather than a preference.

  **Acceptance Criteria**:
  - [ ] Test file committed in a failing state first (verifiable in `git log -p`)
  - [ ] `bun test src/domain/dailyClock.test.ts` → PASS, at least 10 assertions, 0 failures
  - [ ] `TZ=Pacific/Kiritimati bun test src/domain/dailyClock.test.ts` → PASS (UTC+14)
  - [ ] `TZ=Pacific/Niue bun test src/domain/dailyClock.test.ts` → PASS (UTC-11)
  - [ ] `TZ=America/New_York bun test src/domain/dailyClock.test.ts` → PASS
  - [ ] `grep -rn "getMonth\|getDate()\|getFullYear\|toLocaleDateString" src/domain/dailyClock.ts` returns no match
  - [ ] `grep -rn "luxon\|date-fns\|dayjs\|moment" package.json` returns no match

  **QA Scenarios**:

  ```
  Scenario: Day key is identical under hostile timezones
    Tool: Bash
    Preconditions: Implementation complete
    Steps:
      1. Write a scratch script that prints getPuzzleDayKey(Date.UTC(2026,5,15,12,0,0)) and daysSinceEpoch for the same instant
      2. Run it under TZ=UTC, capture stdout
      3. Run it under TZ=Pacific/Kiritimati (UTC+14), capture stdout
      4. Run it under TZ=Pacific/Niue (UTC-11), capture stdout
      5. Run it under TZ=Asia/Kathmandu (UTC+05:45, a non-hour offset), capture stdout
      6. Assert all four stdout values are byte-identical
    Expected Result: All four runs print the same day key and the same index. Any divergence proves local-time leakage.
    Failure Indicators: Kiritimati or Niue output differs by one day from UTC
    Evidence: .sisyphus/evidence/task-5-timezone-invariance.txt

  Scenario: Boundary transition is exact to the millisecond
    Tool: Bash (bun)
    Preconditions: Implementation complete
    Steps:
      1. Let B = Date.UTC(2026,5,15,0,0,0,0)
      2. Assert getPuzzleDayKey(B - 1) === "2026-06-14"
      3. Assert getPuzzleDayKey(B) === "2026-06-15"
      4. Assert daysSinceEpoch(B) - daysSinceEpoch(B - 1) === 1
      5. Assert secondsUntilNextUtcMidnight(B - 1000) === 1
      6. Assert secondsUntilNextUtcMidnight(B) === 86400
      7. Exit non-zero on any mismatch
    Expected Result: The boundary flips at exactly B, not B-1ms or B+1ms; countdown reads 1 second before rollover
    Failure Indicators: Any off-by-one; secondsUntilNextUtcMidnight returning 0 or 86401 at the boundary
    Evidence: .sisyphus/evidence/task-5-boundary-exactness.txt
  ```

  **Evidence to Capture**:
  - [ ] `task-5-timezone-invariance.txt`
  - [ ] `task-5-boundary-exactness.txt`

  **Commit**: YES
  - Message: `feat(daily): add UTC epoch clock and puzzle index`
  - Files: `src/domain/dailyClock.ts`, `src/domain/dailyClock.test.ts`
  - Pre-commit: `bun test`

- [ ] 6. Text normalization + diacritic fold map (TDD)

  **What to do**:
  - **RED first.**
  - Implement `toSearchKey(s: string): string` — lowercase, then `normalize('NFD')`, then strip `\p{Diacritic}` (or `\p{M}`), then apply an explicit fold map, then collapse whitespace and strip punctuation (hyphens, apostrophes, periods).
  - **The explicit fold map is mandatory and is the whole point of this task.** NFD decomposition **silently does nothing** for letters with no canonical decomposition. Confirmed failing set: `ø Ø` → `o`, `ł Ł` → `l`, `đ Đ` → `d`, `ß` → `ss`, `æ Æ` → `ae`, `œ Œ` → `oe`, `þ Þ` → `th`, `ð Ð` → `d`, `ı` → `i`, `İ` → `i`, `ħ` → `h`, `ŋ` → `n`.
  - Tests must assert the full round trip for real city names: `København` → `kobenhavn`, `Łódź` → `lodz`, `Reykjavík` → `reykjavik`, `München` → `munchen`, `Malmö` → `malmo`, `Tromsø` → `tromso`, `Đà Nẵng` → `da nang`, `İzmir` → `izmir`, `Kraków` → `krakow`, `Mỹ Tho` → `my tho`.
  - Also test that `toSearchKey` is idempotent (`f(f(x)) === f(x)`) and that it never returns an empty string for a non-empty input of letters.
  - Use plain `toLowerCase()`, **not** `toLocaleLowerCase('tr')` — Turkish locale lowercasing maps `I` to `ı` and would break cross-locale key comparison.
  - Separately implement `matchesAnyAlias(searchKey, aliasSearchKeys): boolean`. Note explicitly in a short comment that Kyiv/Kiev is an **alias** problem solved by the GeoNames alternate-names join (Task 8), *not* a normalization problem — so nobody later tries to "fix" it in the fold map.

  **Must NOT do**:
  - Do not rely on NFD alone — that is the specific bug this task exists to prevent.
  - Do not use `toLocaleLowerCase` with any locale argument.
  - Do not install a slugify, unidecode, or transliteration package — the fold map is ~15 entries.
  - Do not implement fuzzy matching here; that is Task 13's uFuzzy layer. This module is exact normalization only.

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: Unicode normalization has non-obvious silent-failure modes; the work is small but demands care and broad test coverage across scripts.
  - **Skills**: [`test-driven-development`]
    - `test-driven-development`: the test table *is* the specification here — each city name is a named failure mode.

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 1–5, 7, 8)
  - **Blocks**: 13, 17
  - **Blocked By**: None — can start immediately

  **References**:

  **External References**:
  - `https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/normalize` — what NFD does and, critically, what it does not decompose.
  - `https://github.com/signalapp/Signal-Desktop/blob/main/ts/util/removeDiacritics.std.ts` — a production implementation of exactly this pattern, including its own supplementary fold handling. Best single reference for the shape of the solution.
  - `https://github.com/mantinedev/mantine/blob/master/packages/%40mantine/core/src/components/Highlight/highlighter/highlighter.ts` — second production example of the NFD + strip approach in a search/highlight context.
  - `initial.txt:399-411` — the spec's own normalization requirement, naming München→Munich, Firenze→Florence, København→Copenhagen as must-work cases. Note that two of those three are *alias* mappings, not diacritic strips — only København is solved by this task.

  **WHY Each Reference Matters**:
  - Signal-Desktop's implementation is the primary reference because it is a real shipped product that hit these exact edge cases; copying its structure avoids rediscovering the fold-map requirement the hard way.
  - `initial.txt:399-411` is cited to make the division of labour explicit: this task handles København; Task 8's alias join handles München→Munich and Firenze→Florence.

  **Acceptance Criteria**:
  - [ ] Test file committed in a failing state first (verifiable in `git log -p`)
  - [ ] `bun test src/domain/normalize.test.ts` → PASS, at least 15 assertions, 0 failures
  - [ ] `toSearchKey('København')` === `'kobenhavn'`
  - [ ] `toSearchKey('Łódź')` === `'lodz'`
  - [ ] `toSearchKey('İzmir')` === `'izmir'`
  - [ ] `toSearchKey('Đà Nẵng')` === `'da nang'`
  - [ ] `toSearchKey(toSearchKey(x)) === toSearchKey(x)` holds for every test input
  - [ ] `grep -n "toLocaleLowerCase" src/domain/normalize.ts` returns no match

  **QA Scenarios**:

  ```
  Scenario: Non-decomposing letters are actually folded
    Tool: Bash (bun)
    Preconditions: Implementation complete
    Steps:
      1. Write a scratch script covering the table: Kobenhavn/Lodz/Reykjavik/Munchen/Malmo/Tromso/DaNang/Izmir/Krakow/MyTho
      2. For each, print `input -> output -> expected -> PASS|FAIL`
      3. Additionally assert that the naive NFD-only approach FAILS for København (prove the fold map is doing real work, not decoration)
      4. Exit non-zero if any row is FAIL, or if the naive-NFD control case unexpectedly passes
    Expected Result: All ten rows PASS. The naive-NFD control for København produces "københavn" (ø untouched), proving the explicit fold map is load-bearing.
    Failure Indicators: Any row FAIL; or the control case passing, which would mean the test is not actually exercising the fold map
    Evidence: .sisyphus/evidence/task-6-fold-map.txt

  Scenario: Locale environment cannot change the search key
    Tool: Bash
    Preconditions: Implementation complete
    Steps:
      1. Write a scratch script printing toSearchKey('İzmir') and toSearchKey('IZMIR')
      2. Run under LANG=en_US.UTF-8, capture stdout
      3. Run under LANG=tr_TR.UTF-8, capture stdout
      4. Assert both runs are byte-identical
    Expected Result: Identical output under both locales; Turkish locale does not alter the key
    Failure Indicators: tr_TR output differs, indicating toLocaleLowerCase leaked in somewhere
    Evidence: .sisyphus/evidence/task-6-locale-invariance.txt
  ```

  **Evidence to Capture**:
  - [ ] `task-6-fold-map.txt`
  - [ ] `task-6-locale-invariance.txt`

  **Commit**: YES
  - Message: `feat(search): add text normalization and fold map`
  - Files: `src/domain/normalize.ts`, `src/domain/normalize.test.ts`
  - Pre-commit: `bun test`

- [ ] 7. Clue formatting + population bands (TDD)

  **What to do**:
  - **RED first.**
  - `populationDescription(millions): string` — derive §5's bands: `<0.2` small · `0.2–0.5` fairly small · `0.5–1` medium-sized · `1–2` fairly busy · `2–5` big · `5–10` huge · `>=10` enormous. This is **derived, never stored** (gap G6) so the number and the adjective can never contradict.
  - `formatPopulation(millions): string` — §5's rounding: `0.18` → `"0.2 million"`, `0.74` → `"0.7 million"`, `1.26` → `"1.3 million"`, `4.7` → `"approximately 5 million"`, `13.8` → `"approximately 14 million"`. Values `>= 2` switch to the `"approximately N million"` whole-number form; below that, one decimal place.
  - `formatDistance(km): string` — round per §6 to a sensible magnitude-dependent precision (nearest 10 under 500, nearest 50 under 2000, nearest 100 above). Never emit false precision like `173.4 km`.
  - `renderDay1(puzzle)` / `renderDay2` / `renderDay3` / `renderDay4` / `renderDay5` — pure functions returning the clue **strings** from the fixed templates in §5. Keep them as plain template interpolation.
  - Day 3 wording must render a colour **set** (decision P2): two colours → `"red and white"`, three → `"red, white and blue"`, one → `"red"`. Append the closing `" — and no other colours."`
  - Tests must cover every band boundary exactly (0.19/0.2/0.49/0.5/0.99/1/1.99/2/4.99/5/9.99/10), each rounding example from §5 verbatim, and the one/two/three-colour list joining.

  **Must NOT do**:
  - Do not store or accept a pre-written population adjective — always derive it.
  - Do not emit unrounded distances or populations.
  - Do not build a template engine or i18n layer; these are five fixed English templates.
  - Do not include the Day 5 translation in `renderDay5` — the translation is post-game only (§5).

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Pure string formatting against a fully-specified table of examples.
  - **Skills**: [`test-driven-development`]
    - `test-driven-development`: the §5 examples are a ready-made test table; writing them first pins the rounding rules.

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 1–6, 8)
  - **Blocks**: 17, 18
  - **Blocked By**: None — can start immediately

  **References**:

  **Pattern References**:
  - `initial.txt:132-158` — authoritative population band table and the exact rounding examples. Copy these verbatim into tests.
  - `initial.txt:114-130` — Day 1 template and two worked examples showing the expected sentence shape.
  - `initial.txt:186-207` — Day 2 template and distance rounding guidance, including the explicit "avoid 173.4 km" instruction.
  - `initial.txt:265-289` — Day 4 template and four worked examples (Tbilisi, Sarajevo, Prague, Hanoi).
  - `initial.txt:312-352` — Day 5 template, and the rule that no English translation is shown before the guess.
  - `initial.txt:826-842` — tone guidance: conversational, lightly humorous, scannable in a few seconds. Do not write elaborate prose.

  **WHY Each Reference Matters**:
  - `initial.txt:132-158` is the single most important reference — it is a literal input/output table, so the tests should mirror it line for line rather than inventing cases.
  - The tone section matters because an agent writing clue templates will be tempted to embellish; §19 explicitly forbids it.

  **Acceptance Criteria**:
  - [ ] Test file committed failing first (verifiable in `git log -p`)
  - [ ] `bun test src/domain/clueText.test.ts` → PASS, at least 20 assertions, 0 failures
  - [ ] `populationDescription(1.99)` is `'fairly busy'` and `populationDescription(2)` is `'big'`
  - [ ] `formatPopulation(0.18)` === `'0.2 million'`
  - [ ] `formatPopulation(13.8)` === `'approximately 14 million'`
  - [ ] `formatDistance(173.4)` contains no `'.'`
  - [ ] Day 3 three-colour output reads `'red, white and blue'` (serial comma absent, "and" before last)
  - [ ] `renderDay5` output does not contain the translation field's value

  **QA Scenarios**:

  ```
  Scenario: Every §5 rounding example reproduces exactly
    Tool: Bash (bun)
    Preconditions: Implementation complete
    Steps:
      1. Write a scratch script with the table from initial.txt:152-158 as [input, expected] pairs
      2. For each, print `formatPopulation(input) -> actual -> expected -> PASS|FAIL`
      3. Add the full band table from initial.txt:138-146 as [millions, expectedAdjective] pairs and print the same
      4. Exit non-zero on any FAIL
    Expected Result: Every row from both tables PASSes, reproducing the spec's examples verbatim
    Failure Indicators: Any row FAIL; particularly 4.7 producing "4.7 million" instead of "approximately 5 million"
    Evidence: .sisyphus/evidence/task-7-population-formatting.txt

  Scenario: Day 5 clue never leaks its own translation
    Tool: Bash (bun)
    Preconditions: renderDay5 implemented
    Steps:
      1. Build a puzzle fixture with helpPhrase "დახმარება ხომ არ გჭირდება?" and helpPhraseTranslation "Do you need help?"
      2. Call renderDay5(fixture) and capture the output string
      3. Assert the output CONTAINS the Georgian phrase
      4. Assert the output does NOT contain "Do you need help" (case-insensitive)
      5. Assert the output does not contain "Georgia" or "Tbilisi"
    Expected Result: Native-script phrase present; English translation and all place names absent
    Failure Indicators: Translation appears in the pre-guess clue, destroying Day 5's difficulty
    Evidence: .sisyphus/evidence/task-7-day5-no-translation-leak.txt
  ```

  **Evidence to Capture**:
  - [ ] `task-7-population-formatting.txt`
  - [ ] `task-7-day5-no-translation-leak.txt`

  **Commit**: YES
  - Message: `feat(clues): add population and distance formatting`
  - Files: `src/domain/clueText.ts`, `src/domain/clueText.test.ts`
  - Pre-commit: `bun test`

- [ ] 8. GeoNames city-pool pipeline script

  **What to do**:
  - Write `scripts/build-city-pool.ts`, run via `bun run build-city-pool`, producing `public/data/city-pool.json`.
  - Download (or read from a gitignored cache dir) `cities15000.zip` and `alternateNamesV2.zip` from `https://download.geonames.org/export/dump/`.
  - Parse `cities15000.txt` (tab-delimited, no header) extracting: `geonameid`, `name`, `asciiname`, `latitude`, `longitude`, `country code`, `population`.
  - **Stream-filter** `alternateNamesV2.txt` — it is **195 MB**, so it must be processed as a line stream, never `JSON.parse`d or read whole into memory. Keep only rows whose `geonameid` is in the cities set.
  - Filter `isolanguage`: keep `en`, the country's native language(s), and major exonym languages (`de`, `fr`, `es`, `it`, `pt`, `ru`). Keep rows flagged `isHistoric=1` (this is what supplies Kiev→Kyiv — GeoNames' own readme example). **Drop pseudo-language values** `post`, `iata`, `icao`, `faac`, `link`, `wkdt`, `unlc` — these are postal and airport codes, not name variants, and would pollute autocomplete with junk.
  - Cap aliases per city (e.g. 8) to bound output size; prefer `isPreferredName`, then `isShortName`, then `isHistoric`.
  - For each record emit: `{ id: geonameid, name, country (resolved to a display name via countryInfo.txt), cc, lat, lng, keys: [searchKey...] }` where `keys` are produced by Task 6's `toSearchKey` applied to the primary name plus every retained alias.
  - Resolve country display names from `countryInfo.txt` — do not hardcode a country map.
  - Emit minified JSON. Log final record count and gzipped size.
  - Add the required attribution string to a constant the UI will consume: `"City data © GeoNames.org, licensed under CC BY 4.0"`.

  **Must NOT do**:
  - Do not read `alternateNamesV2.txt` into memory at once — it is 195 MB and will OOM.
  - Do not commit the raw GeoNames archives; gitignore the cache directory. The *output* `city-pool.json` IS committed so builds are reproducible without network access.
  - Do not include population in the output — the guess pool needs coordinates only. Metro population is hand-curated per answer city in Task 9.
  - Do not `import` the resulting JSON anywhere in app code; it is fetched from `public/` and lazy-loaded (Task 13).
  - Do not use SimpleMaps, Natural Earth populated places, or a Wikidata SPARQL query for this — GeoNames is the chosen source.

  **Recommended Agent Profile**:
  - **Category**: `deep`
    - Reason: A multi-stage data pipeline over a 195 MB file with streaming, filtering and join logic; needs autonomous problem-solving if the dump format surprises.
  - **Skills**: none
  - **Skills Evaluated but Omitted**:
    - `test-driven-development`: this is a one-shot build script whose correctness is verified by asserting properties of its output, not by unit tests.

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 1–7)
  - **Blocks**: 10, 13, 17
  - **Blocked By**: None — can start immediately (imports `toSearchKey` from Task 6; if Task 6 is not yet merged, implement against its documented signature and the import will resolve on merge)

  **References**:

  **External References**:
  - `https://download.geonames.org/export/dump/readme.txt` — authoritative column order for both `cities15000.txt` and `alternateNamesV2.txt`, the meaning of `isPreferredName`/`isShortName`/`isHistoric`, and the Kiev/Kyiv worked example. Read this before writing any parsing code; the files have no header rows.
  - `https://download.geonames.org/export/dump/` — the dump index, confirming file names and sizes.
  - `https://creativecommons.org/licenses/by/4.0/` — the licence whose attribution requirement Task 28 must satisfy.
  - `initial.txt:399-411` — the alias requirement this pipeline exists to satisfy (München→Munich, Firenze→Florence).

  **API/Type References**:
  - `src/domain/normalize.ts:toSearchKey` (Task 6) — must be used to generate the `keys` array, so that runtime queries and build-time keys are normalized by identical logic. Do not reimplement normalization in the script.

  **WHY Each Reference Matters**:
  - The GeoNames readme is non-negotiable reading: the dumps are headerless tab-delimited files and guessing column positions produces silently wrong data (e.g. swapping lat/lng).
  - Reusing `toSearchKey` rather than reimplementing it is the whole reason Task 6 exists — divergence between build-time and query-time normalization makes matching fail unpredictably.

  **Acceptance Criteria**:
  - [ ] `bun run build-city-pool` exits 0
  - [ ] `public/data/city-pool.json` exists and parses as valid JSON
  - [ ] Record count is between 20,000 and 30,000
  - [ ] Gzipped size is under 900 KB (`gzip -c public/data/city-pool.json | wc -c`)
  - [ ] Every record has non-null `id`, `name`, `cc`, `lat`, `lng`, and a `keys` array of length >= 1
  - [ ] No record contains a `keys` entry matching `/^[0-9]{4,}$/` (proves postal codes were excluded)
  - [ ] All `lat` values are within -90..90 and all `lng` within -180..180
  - [ ] Peak RSS during the run stays under 1.5 GB (proves streaming, not whole-file reads)

  **QA Scenarios**:

  ```
  Scenario: Known alias and diacritic cases resolve to the right city
    Tool: Bash (bun)
    Preconditions: city-pool.json generated
    Steps:
      1. Load public/data/city-pool.json
      2. Find the record whose keys include "munich"; assert its name or keys also include "munchen" and its cc is "DE"
      3. Find the record whose keys include "florence"; assert keys also include "firenze" and cc is "IT"
      4. Find the record whose keys include "kobenhavn"; assert keys also include "copenhagen" and cc is "DK"
      5. Find the record whose keys include "kyiv"; assert keys also include "kiev" and cc is "UA"
      6. Assert all four are single records (one geonameid each), not duplicated entries
      7. Print each resolved record
    Expected Result: All four alias pairs resolve to exactly one record each with the correct country code, proving the alternateNames join and the fold map both work end to end
    Failure Indicators: Munich and München appearing as two separate geonameids; Kiev missing entirely (would mean isHistoric rows were dropped)
    Evidence: .sisyphus/evidence/task-8-alias-resolution.txt

  Scenario: Pipeline streams rather than loading 195MB into memory
    Tool: Bash
    Preconditions: GeoNames archives cached locally
    Steps:
      1. Run `/usr/bin/time -v bun run build-city-pool 2>&1 | tee /tmp/pool-build.log` (or `-l` on systems without GNU time)
      2. Extract "Maximum resident set size" from the output
      3. Assert the value is under 1.5 GB
      4. Assert the script's own stdout reports a final record count and a gzipped size
      5. Assert exit code 0
    Expected Result: Peak RSS well under 1.5GB despite a 195MB input, confirming line-streaming; script self-reports record count and size
    Failure Indicators: RSS above 2GB or an OOM kill, indicating the alternateNames file was read whole
    Evidence: .sisyphus/evidence/task-8-streaming-memory.txt
  ```

  **Evidence to Capture**:
  - [ ] `task-8-alias-resolution.txt`
  - [ ] `task-8-streaming-memory.txt`

  **Commit**: YES
  - Message: `feat(data): add GeoNames city pool pipeline`
  - Files: `scripts/build-city-pool.ts`, `public/data/city-pool.json`, `.gitignore`
  - Pre-commit: `bun run build-city-pool`

- [ ] 9. Six curated puzzle data files + sources

  **What to do**:
  - Author six puzzle JSON files under `content/puzzles/`, each validating against Task 3's schema.
  - Chosen cities — geographically and culturally varied, drawn from §21's suggested set, deliberately mixing capitals with non-capitals per §9: **Tbilisi** (Georgia), **Barcelona** (Spain, non-capital), **Hanoi** (Vietnam), **Cusco** (Peru, non-capital), **Reykjavík** (Iceland), **Sarajevo** (Bosnia and Herzegovina).
  - Assign each an explicit consecutive `publishDate` starting from a launch date constant (gap G1 — **no modulo wrapping**, so no repeats).
  - Per city, hand-verify and cite:
    - **Metro population** from UN World Urbanization Prospects (CC BY 4.0) or citypopulation.de (CC BY 3.0). Record `name`, `url`, `asOfYear`. Note citypopulation.de permits population figures but **not** coordinate redistribution — take coordinates from GeoNames instead.
    - **Landscape** — one enum value that is factually accurate and broad enough that a Day 1 solve is impressive (§5).
    - **Day 2 reference** — distant and globally famous, target **≥800 km** (decision P3), with `recognisability: 'global'`. Store the reference's coordinates so lint can verify the distance.
    - **Flag colours** — the complete palette of the national flag (decision P2).
    - **Day 4** — year plus historical entity in neutral wording (§18: "this place was part of [entity] at the time"), with a mandatory `historicalSourceUrl`.
    - **Day 5** — the local-language phrase meaning "do you need help?", plus its English translation in a separate field for post-game reveal. For Barcelona, consciously choose between Catalan and Spanish and record the rationale in a sibling `NOTES.md` (§18 flags Barcelona as a multilingual city needing manual review).
  - Verify each answer city's `geonameId` exists in `public/data/city-pool.json` (gap G2 — otherwise the city is untypeable).
  - Write `content/puzzles/NOTES.md` recording, per city, the language choice rationale and any judgement calls.

  **Must NOT do**:
  - Do not invent, estimate or guess any fact. Every population, distance, historical claim and phrase must trace to a cited source.
  - Do not use machine-translated Day 5 phrases without verification — a grammatically unnatural phrase breaks §17's quality bar.
  - Do not let any Day 5 phrase contain the city or country name (§17).
  - Do not add a difficulty rating, time zone, or any field outside Task 3's schema.
  - Do not use modulo-based date assignment; dates are explicit and consecutive.
  - Do not author more than six puzzles — the schema and lint support 20+, but v1 ships six by decision.

  **Recommended Agent Profile**:
  - **Category**: `deep`
    - Reason: Research-heavy fact verification across six countries and five fact categories each, with genuine judgement calls (Barcelona's language, which historical year produces a useful clue).
  - **Skills**: none
  - **Skills Evaluated but Omitted**:
    - `test-driven-development`: this is curated content, not logic. `puzzle-lint` (Task 17) is its automated gate.

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 10–16)
  - **Blocks**: 17, 18, 19
  - **Blocked By**: 3

  **References**:

  **Pattern References**:
  - `src/domain/puzzle.ts` (Task 3) — the schema every file must satisfy. Read it first; the schema is the contract.
  - `initial.txt:645-665` — the spec's worked Tbilisi example, useful as a shape reference (note the documented divergences: no stored population description, full colour array, added source fields).

  **Content Rules** (must be read before authoring):
  - `initial.txt:209-221` — Day 2 reference-city selection requirements.
  - `initial.txt:253-259` — flag colour selection rule.
  - `initial.txt:291-308` — Day 4 historical clue rules: prefer historical states, empires, former federations, colonial territories; avoid obscure individual events.
  - `initial.txt:346-356` — Day 5 phrase must mean approximately "do you need help?" and should be standardized in meaning across languages.
  - `initial.txt:722-757` — the full §17 quality-control checklist. Every item applies to every one of the six puzzles.
  - `initial.txt:761-822` — edge cases: multilingual cities (Barcelona explicitly named), population definitions, historic borders, flag ambiguity.
  - `initial.txt:441-471` — city selection guidance: do not make every answer a capital.

  **External References**:
  - `https://population.un.org/wup/downloads` — UN World Urbanization Prospects, bulk CSV/Excel, CC BY 4.0. Preferred metro population source.
  - `https://www.citypopulation.de/` — CC BY 3.0, requires attribution `Thomas Brinkhoff: City Population`. Population figures only; coordinates may NOT be redistributed.

  **WHY Each Reference Matters**:
  - `initial.txt:722-757` is the acceptance bar the content is judged against, and Task 17 automates the mechanical subset of it — reading it while authoring prevents writing content that lint will reject.
  - The citypopulation.de coordinate restriction is called out explicitly because taking both population and coordinates from the same convenient page would breach its terms.

  **Acceptance Criteria**:
  - [ ] Six files exist under `content/puzzles/`
  - [ ] Every file parses against the Task 3 schema (verified by a scratch script, exit 0)
  - [ ] Every file has a non-empty `historicalSourceUrl` and a `populationSource` with `name`, `url`, `asOfYear`
  - [ ] Every `distanceKm` is >= 800
  - [ ] Every `recognisability` is `'global'`
  - [ ] Every `geonameId` is present in `public/data/city-pool.json`
  - [ ] No `helpPhrase` contains its own city or country name (case- and diacritic-insensitive)
  - [ ] Six distinct consecutive `publishDate` values, no duplicates
  - [ ] At least two of the six are non-capitals (Barcelona, Cusco)
  - [ ] `content/puzzles/NOTES.md` documents the Barcelona language decision

  **QA Scenarios**:

  ```
  Scenario: Every stated distance matches the real great-circle distance
    Tool: Bash (bun)
    Preconditions: All six puzzle files authored; haversineKm available from Task 4
    Steps:
      1. Write a scratch script loading all six puzzle files
      2. For each, compute haversineKm(coordinates, referenceCityCoordinates)
      3. Compare against the file's stated distanceKm; assert the difference is within 5% OR within 50km, whichever is larger (accounting for deliberate rounding)
      4. Print `city -> reference -> stated -> computed -> delta -> PASS|FAIL` per row
      5. Assert every stated distance is >= 800
      6. Exit non-zero on any FAIL
    Expected Result: All six rows PASS — stated distances are rounded versions of real computed distances, and all are >= 800km per decision P3
    Failure Indicators: Any delta beyond tolerance (indicates a transcription or coordinate error); any distance under 800km (violates P3)
    Evidence: .sisyphus/evidence/task-9-distance-accuracy.txt

  Scenario: Answer cities are actually typeable by a player
    Tool: Bash (bun)
    Preconditions: city-pool.json exists; six puzzles authored
    Steps:
      1. Load city-pool.json and build a Set of geonameids
      2. For each of the six puzzles, assert its geonameId is in the Set
      3. For each, additionally assert at least one of that pool record's keys equals toSearchKey(puzzle.city)
      4. Print `city -> geonameId -> inPool -> keyMatch` per row
      5. Exit non-zero if any row fails either check
    Expected Result: All six answer cities exist in the guess pool AND are reachable by typing their display name — the player can actually submit the correct answer
    Failure Indicators: Any geonameId absent (city is untypeable, puzzle unwinnable); key mismatch (player must guess an unexpected spelling)
    Evidence: .sisyphus/evidence/task-9-answers-typeable.txt
  ```

  **Evidence to Capture**:
  - [ ] `task-9-distance-accuracy.txt`
  - [ ] `task-9-answers-typeable.txt`

  **Commit**: YES
  - Message: `feat(content): add six curated puzzles`
  - Files: `content/puzzles/*.json`, `content/puzzles/NOTES.md`
  - Pre-commit: `bun run puzzle-lint`

- [ ] 10. Flag colour data + flag-icons integration

  **What to do**:
  - Install `flag-icons` (MIT) for flag SVG assets, resolving gap G7's licensing question.
  - Create `src/domain/flagColours.ts` with a per-country-code colour allowlist covering the six v1 countries (GE, ES, VN, PE, IS, BA), each as the complete palette. This is the data `puzzle-lint` validates declared colours against.
  - Define the colour enum (`red`, `white`, `blue`, `green`, `yellow`, `black`, `orange`) and a token map to the actual hex values used when rendering the torn cloth swatch.
  - Export `flagAssetPath(cc)` resolving to the local `flag-icons` SVG — no remote fetching.

  **Must NOT do**:
  - Do not fetch flag SVGs from Wikipedia or any remote URL at runtime (licensing + availability risk).
  - Do not build an allowlist for all ~200 countries — six are needed; extending it is trivial later.
  - Do not render anything here; Task 19 builds the swatch component.

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Small, bounded data file plus one dependency install.
  - **Skills**: none
  - **Skills Evaluated but Omitted**:
    - `test-driven-development`: static data, validated by Task 17's lint rather than unit tests.

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 9, 11–16)
  - **Blocks**: 19
  - **Blocked By**: 8

  **References**:
  - `https://github.com/lipis/flag-icons` — MIT-licensed flag SVG set; confirm the licence and the `flags/4x3/{cc}.svg` path convention.
  - `initial.txt:253-259` and `initial.txt:818-822` — flag colour selection rules and the ambiguity edge case. Under decision P2 the full set is revealed, so the "least revealing colour" rule no longer applies, but the ambiguity concern still informs which countries make good puzzles.
  - `src/domain/puzzle.ts` (Task 3) — the `flagColours` enum must match the schema's enum exactly.

  **WHY Each Reference Matters**:
  - The flag-icons licence check is the concrete resolution of gap G7; using Wikipedia SVGs instead would introduce unverified per-file licensing.

  **Acceptance Criteria**:
  - [ ] `flag-icons` present in `package.json` dependencies
  - [ ] Allowlist covers all six country codes: GE, ES, VN, PE, IS, BA
  - [ ] `bunx tsc --noEmit` exits 0
  - [ ] `flagAssetPath('ge')` resolves to a file that exists on disk
  - [ ] `grep -rn "wikipedia\|wikimedia" src/domain/flagColours.ts` returns no match

  **QA Scenarios**:
  ```
  Scenario: Every v1 country's flag asset exists locally and its palette is correct
    Tool: Bash (bun)
    Preconditions: flag-icons installed, allowlist authored
    Steps:
      1. For each cc in [ge, es, vn, pe, is, ba], resolve flagAssetPath(cc) and assert the file exists via fs.existsSync
      2. Assert each file is non-empty and its first 200 bytes contain "<svg"
      3. Print the allowlist palette for each cc
      4. Spot-assert known-correct palettes: GE includes red and white; VN includes red and yellow; IS includes blue, white, red
      5. Exit non-zero on any failure
    Expected Result: Six local SVG files present and valid; palettes match the real national flags
    Failure Indicators: Missing file (wrong path convention); a palette missing a colour actually on the flag
    Evidence: .sisyphus/evidence/task-10-flag-assets.txt

  Scenario: No remote flag requests occur at runtime
    Tool: Playwright
    Preconditions: Dev server running, a page rendering a flag
    Steps:
      1. Record all network request URLs
      2. Navigate to a page that renders a flag swatch and wait for networkidle
      3. Assert zero requests to any host other than localhost
      4. Write the URL list to evidence
    Expected Result: All flag assets served from the app origin
    Failure Indicators: Any wikimedia.org or external CDN request
    Evidence: .sisyphus/evidence/task-10-no-remote-flags.txt
  ```

  **Evidence to Capture**:
  - [ ] `task-10-flag-assets.txt`
  - [ ] `task-10-no-remote-flags.txt`

  **Commit**: YES
  - Message: `feat(content): add flag colour data and swatch assets`
  - Files: `src/domain/flagColours.ts`, `package.json`
  - Pre-commit: `bun run build`

- [ ] 11. Server daily route handler — HMAC selection + date gate

  **What to do**:
  - Implement `GET /api/daily` as a Next.js App Router route handler. **This is the task that fixes P6** — the documented Wordle failure where all future answers shipped in the client bundle.
  - Accept `?stage=N` (1–5) and optional `?date=YYYY-MM-DD`.
  - Resolve the day key via Task 5's `getPuzzleDayKey()` — **import it, do not recompute**. Research named the exact bug caused by duplicating day-boundary logic.
  - **Hard-reject future dates**: if `date > today`, return HTTP **400** with `{ error: "Cannot access future puzzles." }`.
  - Select the puzzle by explicit `publishDate` match against the six files (gap G1 — no modulo). If no puzzle matches the requested date, return **404** so Task 26 can render the "explorer is resting" state.
  - **Progressive disclosure is the core requirement**: the response for `?stage=N` must contain clue data for Days 1..N **only**. Days N+1..5 must be entirely absent from the payload — not nulled, not empty-stringed, *absent*. The answer city name, coordinates, and `helpPhraseTranslation` must never appear in any response unless the game is resolved.
  - Implement HMAC-SHA256 ordering (`selectDailyIndex`) as a hedge for when the pool grows past explicit date assignment, keyed by `LOST_EXPLORER_DAILY_SECRET`.
  - **Production secret hardening** (improves on the reference implementation): if `NODE_ENV === 'production'` and the secret is missing, return 500 and log loudly. Only in non-production may the absent secret enable dev mode (answer included, `Cache-Control: no-store`). Forgetting the secret in prod must fail loudly, never silently expose answers.
  - `Cache-Control`: today → `public, s-maxage=${secondsUntilNextUtcMidnight()}, stale-while-revalidate=60`; past dates → `public, max-age=3600, s-maxage=86400`; dev mode → `no-store`.
  - Add a separate `GET /api/answer` returning the answer only when the client proves the game is resolved — or simpler and preferred for v1: include the answer in the `stage=5` response **only after** a `resolved=true` query flag, and validate server-side that stage 5 was reached. Choose the simpler option and document it.

  **Must NOT do**:
  - Do not compute any day boundary in this file — import from `src/domain/dailyClock.ts`.
  - Do not trust a client-supplied date for *which* puzzle is current; the client may only request a past date.
  - Do not include Day N+1 clue fields in a stage-N response under any circumstances.
  - Do not use `output: 'export'` or attempt to pre-render this route statically.
  - Do not add rate limiting, bot detection, or server-side guess validation — research confirms these are not worth building for a no-accounts daily game.
  - Do not add a database; the six puzzles are files and the day-pin can be derived from the date.

  **Recommended Agent Profile**:
  - **Category**: `ultrabrain`
    - Reason: This route is the single security/integrity boundary of the product. A mistake in progressive disclosure silently destroys the game's core mechanic without any visible symptom.
  - **Skills**: none
  - **Skills Evaluated but Omitted**:
    - `test-driven-development`: TDD applies to pure logic; this handler is verified by curl-based QA scenarios asserting actual HTTP responses, which is stronger evidence here.

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 9, 10, 12–16)
  - **Blocks**: 22, 26
  - **Blocked By**: 1, 3, 5, 9

  **References**:
  - `https://github.com/sainsw/framemoji/blob/c1029cb11008a286ead7fa6c582eabd108edc7b5/src/app/api/daily/route.ts#L1-L98` — **the primary reference.** A production route handler implementing HMAC selection, server pinning, the future-date 400, the dev-mode secret fallback, and the exact `Cache-Control` strategy. Read the whole file before writing any code.
  - `https://blog.haideralipunjabi.com/posts/creating-a-secure-wordle-using-next.js-api-routes-and-vercel-serverless-functions` — the simpler precursor pattern (server-only answer list + date-indexed route), useful for understanding why the server boundary exists at all.
  - `https://news.ycombinator.com/item?id=29891222` — the original Wordle leak thread. Read for the concrete consequence being avoided: 2,315 answers pre-ordered through 2027, readable from devtools.
  - `https://nextjs.org/docs/app/api-reference/file-conventions/route` — route handler API, `NextResponse`, and header setting.
  - `src/domain/dailyClock.ts` (Task 5) — `getPuzzleDayKey` and `secondsUntilNextUtcMidnight`. Mandatory import, not reimplementation.

  **WHY Each Reference Matters**:
  - Framemoji is a live app solving this exact problem; its dev-mode fallback and cache strategy are both subtle and correct, and reinventing them will produce something worse.
  - The HN thread is included so the executor understands progressive disclosure is the product's integrity guarantee, not a nice-to-have to be simplified away under time pressure.

  **Acceptance Criteria**:
  - [ ] `curl -s -o /dev/null -w "%{http_code}" "localhost:3000/api/daily?date=2099-01-01"` → `400`
  - [ ] `curl -s -o /dev/null -w "%{http_code}" "localhost:3000/api/daily?stage=1"` → `200`
  - [ ] `curl -s -o /dev/null -w "%{http_code}" "localhost:3000/api/daily?date=1990-01-01"` → `404`
  - [ ] A `stage=1` response contains no Day 2–5 field names and no `helpPhrase`
  - [ ] A `stage=1` response contains neither the answer city name nor its coordinates
  - [ ] `Cache-Control` on a today response includes `s-maxage=`
  - [ ] `grep -n "getUTCDate\|Date.UTC\|toISOString" src/app/api/daily/route.ts` returns no match (day logic is imported, not inlined)
  - [ ] With `NODE_ENV=production` and the secret unset, the route returns 500

  **QA Scenarios**:
  ```
  Scenario: Progressive disclosure holds at every stage
    Tool: Bash (curl + jq)
    Preconditions: Dev server running with a puzzle published for today
    Steps:
      1. For N in 1..5: curl "localhost:3000/api/daily?stage=N" and save the raw body to /tmp/stage-N.json
      2. Assert stage-1.json does NOT contain the substrings "referenceCity", "flagColours", "historicalEntity", "helpPhrase"
      3. Assert stage-2.json CONTAINS "referenceCity" but does NOT contain "flagColours", "historicalEntity", "helpPhrase"
      4. Assert stage-3.json CONTAINS "flagColours" but NOT "historicalEntity" or "helpPhrase"
      5. Assert stage-4.json CONTAINS "historicalEntity" but NOT "helpPhrase"
      6. Assert stage-5.json CONTAINS "helpPhrase" but does NOT contain "helpPhraseTranslation"
      7. Assert NONE of the five bodies contain today's answer city name (grep -i, case-insensitive)
      8. Exit non-zero on any violation
    Expected Result: Each stage reveals exactly one additional clue and nothing more; the answer never appears in an unresolved response
    Failure Indicators: Any later-day field present in an earlier stage — this silently destroys the game's core mechanic
    Evidence: .sisyphus/evidence/task-11-progressive-disclosure.txt

  Scenario: Future dates are refused and production secret is enforced
    Tool: Bash (curl)
    Preconditions: Dev server running
    Steps:
      1. curl -s -w "\n%{http_code}" "localhost:3000/api/daily?date=2099-01-01" — assert 400, assert body contains "Cannot access future puzzles"
      2. curl "localhost:3000/api/daily?date=2099-01-01" — assert body contains no city name and no clue fields
      3. Stop the dev server; restart with NODE_ENV=production and LOST_EXPLORER_DAILY_SECRET unset
      4. curl -s -o /dev/null -w "%{http_code}" "localhost:3000/api/daily?stage=1" — assert 500
      5. Restart with the secret set; assert 200 and that the response does NOT include an answer field
    Expected Result: Future dates rejected with 400 and zero clue leakage; production without a secret fails closed with 500; production with a secret serves clues without the answer
    Failure Indicators: 200 on a future date (catastrophic — all future puzzles readable); 200 in production without a secret while including the answer (silent dev-mode leak)
    Evidence: .sisyphus/evidence/task-11-date-gate-and-secret.txt
  ```

  **Evidence to Capture**:
  - [ ] `task-11-progressive-disclosure.txt`
  - [ ] `task-11-date-gate-and-secret.txt`

  **Commit**: YES
  - Message: `feat(api): add date-gated daily clue route`
  - Files: `src/app/api/daily/route.ts`, `src/server/dailySelection.ts`, `src/server/puzzleRepository.ts`
  - Pre-commit: `bun test && bun run build`

- [ ] 12. localStorage persistence + stats/streak fold (TDD)

  **What to do**:
  - **RED first.**
  - Implement `src/state/persistence.ts`: read/write two separate keys following the pattern verified across Worldle, Tradle and Globle:
    - `lx:games` → `Record<dayKey, DailyGameState>` — retained indefinitely; this is the raw material stats fold over.
    - `lx:meta` → schema version and nothing else derived.
  - **Stats are always DERIVED by folding `lx:games`, never separately stored or incremented.** This is what makes gap G4 and the mid-game-rollover edge case fall out correctly without special-casing.
  - Implement `computeStats(games)` returning: played, won, winPercent, currentStreak, longestStreak, averageDaySolved, per-Day solve counts (1–5), failed count, averageSolveTimeMs.
  - **Streak logic** (from Tradle's verified implementation): iterate day keys in chronological order; on a win, extend if the previous entry's day is exactly one day earlier, else reset to 1; on a loss, set 0. An *absent* day naturally breaks the streak because the next win's previous-day check fails — no special case needed.
  - **Zero-state correctness (gap G4)**: with zero games, `winPercent` must be `0` not `NaN`, and `averageDaySolved` must be `null` (rendered as `—`), never `NaN`. Test this explicitly.
  - Implement the versioned `parsePersisted` wiring from Task 3, with `safeParse` + fallback-to-default so corrupt localStorage never throws.
  - Implement `exportJournal()` / `importJournal(code)` — a base64 round-trip of `lx:games` (gap P11 insurance against a lost streak).
  - Implement a single `usePersistedGame()` hook. **All localStorage reads happen inside `useEffect`**, with a stable deterministic placeholder on first render, to avoid SSR hydration mismatch. This must be the only place in the app that touches `localStorage`.
  - Timer semantics (gap G8): `startedAtMs` is stamped on first clue view and persisted, so a reload does not reset it. Elapsed time is computed at resolution. No pause.

  **Must NOT do**:
  - Do not store derived statistics — recompute from `lx:games` every time. Storing them is how streaks desynchronize.
  - Do not read `localStorage` during render, in a module top-level, or behind a `typeof window !== 'undefined'` check sprinkled through components. One hook, `useEffect` only.
  - Do not compute a day boundary here — import `getPuzzleDayKey` from Task 5.
  - Do not add tamper detection or signing of local stats — research confirms it is not worth building.
  - Do not delete old game entries; they are the stats source.
  - Do not render a visible ticking clock (§10: speed must not dominate).

  **Recommended Agent Profile**:
  - **Category**: `ultrabrain`
    - Reason: Streak arithmetic and zero-state handling are exactly where daily games produce silent, trust-destroying bugs; the derived-not-stored design must be held rigorously.
  - **Skills**: [`test-driven-development`]
    - `test-driven-development`: streak transitions across gaps, losses and first-play are a dense boundary-condition space best pinned by tests first.

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 9–11, 13–16)
  - **Blocks**: 22, 24, 25
  - **Blocked By**: 3, 5

  **References**:
  - `https://github.com/alexandersimoes/tradle/blob/89255f7b6795f3a37ba6eccf0aed4cf44b1caa5a/src/domain/stats.ts#L13-L57` — **the primary reference.** The verified streak fold: chronological iteration, extend-on-consecutive-win, reset-to-1-on-gap, zero-on-loss. Port this logic.
  - `https://github.com/markgalassi/worldle/blob/001ec783bd3203b241aeba8e53370a2cae0fe54a/src/hooks/useGuesses.ts#L4-L28` — the `Record<dayString, Guess[]>` storage shape, retained across days.
  - `https://github.com/the-abe-train/globle/blob/7fe4ae74321c94f049631eb8c9c35982aa809bc6/src/hooks/useLocalStorage.tsx#L27-L34` — self-expiry of stale *in-progress* state while preserving history. Relevant to the mid-game-rollover case.
  - `https://dev.to/horushe/the-date-is-your-database-building-a-daily-puzzle-game-with-no-backend-2c56` — the SSR hydration rule: date-derived values are safe during SSR; localStorage must be read in `useEffect` only.
  - `initial.txt:586-611` — the required statistics list and the solve-distribution shape.
  - `src/domain/dailyClock.ts` (Task 5) — mandatory import for day keys.

  **WHY Each Reference Matters**:
  - Tradle's fold is cited with exact line numbers because reimplementing streak logic from intuition reliably produces off-by-one bugs at gaps and first-play; this version is verified in production.
  - Globle's self-expiry pattern is the specific answer to "what happens if the day rolls over mid-game" — stale in-progress state is discarded while history survives.

  **Acceptance Criteria**:
  - [ ] Test file committed failing first (verifiable in `git log -p`)
  - [ ] `bun test src/state/persistence.test.ts` → PASS, at least 18 assertions, 0 failures
  - [ ] `computeStats({})` returns `winPercent: 0` and `averageDaySolved: null` — **no `NaN` anywhere** in the returned object
  - [ ] Three consecutive wins → `currentStreak: 3`
  - [ ] Wins on days 1,2 then a gap on day 3 then a win on day 4 → `currentStreak: 1`, `longestStreak: 2`
  - [ ] An explicit loss sets `currentStreak: 0`
  - [ ] `importJournal(exportJournal())` round-trips to a deep-equal state
  - [ ] `grep -rn "localStorage" src/ --include=*.tsx | grep -v persistence` returns no match
  - [ ] `JSON.stringify(computeStats(anyFixture)).includes('null')` is permitted but `.includes('NaN')` is never true

  **QA Scenarios**:
  ```
  Scenario: Streak survives every transition shape
    Tool: Bash (bun)
    Preconditions: computeStats implemented
    Steps:
      1. Fixture A — zero games: assert played 0, won 0, winPercent 0, averageDaySolved null, currentStreak 0; assert JSON.stringify of the result contains no "NaN"
      2. Fixture B — wins on 2026-06-01, 06-02, 06-03: assert currentStreak 3, longestStreak 3
      3. Fixture C — wins on 06-01, 06-02, then nothing on 06-03, then a win on 06-04: assert currentStreak 1, longestStreak 2
      4. Fixture D — win 06-01, explicit loss 06-02, win 06-03: assert currentStreak 1, longestStreak 1
      5. Fixture E — an in_progress entry for today plus three prior wins: assert the in_progress entry does not count as played or won, and currentStreak remains 3
      6. Print each fixture's full stats object; exit non-zero on any mismatch
    Expected Result: All five fixtures produce the specified values; zero-state is NaN-free; in-progress games are excluded from totals
    Failure Indicators: NaN in fixture A; currentStreak 3 in fixture C (gap not breaking the streak); in-progress counted as a loss
    Evidence: .sisyphus/evidence/task-12-streak-transitions.txt

  Scenario: State survives reload and corruption without SSR mismatch
    Tool: Playwright
    Preconditions: Dev server running; a page consuming usePersistedGame
    Steps:
      1. Clear localStorage, navigate to http://localhost:3000, capture all console messages
      2. Assert zero console messages contain "Hydration" or "did not match"
      3. Write a valid games record into localStorage via page.evaluate, then reload
      4. Assert the restored state is reflected in the DOM (stats show the seeded values)
      5. Overwrite localStorage key "lx:games" with the literal string "{{{broken" and reload
      6. Assert the page still renders without a crash, and that stats show the zero-state (0 played, "—" for average day)
      7. Screenshot the corrupted-recovery state
    Expected Result: No hydration warnings; valid state restores; corrupt state degrades gracefully to zero-state with no error boundary triggered
    Failure Indicators: Any hydration mismatch warning; a blank page or error overlay after corruption
    Evidence: .sisyphus/evidence/task-12-reload-and-corruption.png
  ```

  **Evidence to Capture**:
  - [ ] `task-12-streak-transitions.txt`
  - [ ] `task-12-reload-and-corruption.png`

  **Commit**: YES
  - Message: `feat(state): add versioned persistence and stats`
  - Files: `src/state/persistence.ts`, `src/state/persistence.test.ts`, `src/state/usePersistedGame.ts`, `src/domain/stats.ts`, `src/domain/stats.test.ts`
  - Pre-commit: `bun test`

- [ ] 13. City autocomplete engine

  **What to do**:
  - Install `@leeoniya/ufuzzy` (7.6 KB). Research benchmarked fuse.js at **~78x slower** on an equivalent workload — do not use fuse.js.
  - Implement `src/search/cityIndex.ts`:
    - Lazy-load `public/data/city-pool.json` via dynamic `fetch` **after first paint**, never a static `import` (a static import inlines ~300–700 KB into the JS bundle).
    - Build an exact-prefix bucket map keyed on the first 2 normalized characters for an O(1) fast path, falling back to uFuzzy for typo tolerance.
    - `search(query, limit = 8)` ranking **exact match > prefix match > fuzzy match**, and returning records with a stable `id` (geonameid).
  - Normalize queries with Task 6's `toSearchKey` so query-time and build-time normalization are identical.
  - **Disambiguate same-name cities** in the display label (`Paris, France` vs `Paris, United States`) — there are many Springfields, and an ambiguous label makes the guess meaningless.
  - **Return geonameid-keyed results only** (gap G3). The consumer must never identify a city by display string.
  - Expose `isLoaded` so the UI can disable submission until the index is ready.

  **Must NOT do**:
  - Do not `import` the city pool JSON — fetch it.
  - Do not install fuse.js.
  - Do not reimplement normalization; import `toSearchKey`.
  - Do not return results identified by name string.
  - Do not implement the input UI here — that is Task 20. This is the engine only.
  - Do not add a server-side search API route; the client-side pool is the chosen strategy.

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: Ranking correctness plus a lazy-loading strategy with real bundle-size consequences; needs care but not deep algorithmic invention.
  - **Skills**: none
  - **Skills Evaluated but Omitted**:
    - `test-driven-development`: ranking quality is better verified by asserting ordered results on real data than by unit-testing a scoring function in isolation; the QA scenarios do this.

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 9–12, 14–16)
  - **Blocks**: 20
  - **Blocked By**: 6, 8

  **References**:
  - `https://github.com/leeoniya/uFuzzy` — API (`new uFuzzy()`, `filter`, `info`, `sort`) and the documented intent of ranking in-order contiguous matches highest. Read the README's ordering section.
  - `https://leeoniya.github.io/uFuzzy/demos/compare.html` — the benchmark establishing uFuzzy at 434ms vs fuse.js at 33,875ms for the same search set. Justifies the library choice.
  - `src/domain/normalize.ts:toSearchKey` (Task 6) — mandatory import for query normalization.
  - `public/data/city-pool.json` (Task 8) — the record shape `{id, name, country, cc, lat, lng, keys}`.
  - `initial.txt:399-411` — the normalization/alias requirements this engine must satisfy at query time.

  **WHY Each Reference Matters**:
  - The benchmark link is included because fuse.js is the far more famous choice and an executor may default to it; the 78x figure makes the decision concrete rather than a matter of taste.

  **Acceptance Criteria**:
  - [ ] `@leeoniya/ufuzzy` in dependencies; `fuse.js` absent from `package.json`
  - [ ] `grep -rn "from .*city-pool.json\|require.*city-pool" src/` returns no match (fetched, not imported)
  - [ ] `search('tbil')` returns Tbilisi as the first result
  - [ ] `search('munich')` and `search('münchen')` both return the same geonameid as first result
  - [ ] `search('kiev')` returns the Kyiv geonameid
  - [ ] `search('paris')` returns results whose labels disambiguate by country
  - [ ] Every returned object carries a numeric `id`
  - [ ] `bunx tsc --noEmit` exits 0

  **QA Scenarios**:
  ```
  Scenario: Ranking and alias resolution behave correctly on real data
    Tool: Bash (bun)
    Preconditions: city-pool.json generated; engine implemented
    Steps:
      1. Load the real city pool and build the index
      2. For each query in [tbil, tbilisi, barcelona, munich, munchen, münchen, kiev, kyiv, kobenhavn, københavn, reykjavik, cusco], print the top 3 results as `name (cc) id`
      3. Assert "tbilisi" returns Tbilisi (GE) as rank 1
      4. Assert "munich" and "münchen" return the SAME id at rank 1
      5. Assert "kiev" and "kyiv" return the SAME id at rank 1
      6. Assert "kobenhavn" and "københavn" return the SAME id at rank 1
      7. Assert an exact full-name query always outranks a mere prefix match of a different city
      8. Exit non-zero on any failure
    Expected Result: All alias and diacritic pairs collapse to one geonameid; exact matches rank first
    Failure Indicators: Alias pairs returning different ids (guess-dedupe will break); a fuzzy match outranking an exact match
    Evidence: .sisyphus/evidence/task-13-search-ranking.txt

  Scenario: City pool is lazy-loaded, not bundled
    Tool: Playwright + Bash
    Preconditions: Production build completed
    Steps:
      1. Run `bun run build` and locate the client JS chunks under .next/static
      2. Assert no chunk file exceeds 1 MB
      3. Assert `grep -rl "geonameid\|Tbilisi" .next/static/chunks` finds no chunk containing bulk city data
      4. Playwright: record network requests, navigate to the game page, wait for networkidle
      5. Assert a request to /data/city-pool.json occurred
      6. Assert that request started AFTER the first contentful paint (compare against performance timing)
    Expected Result: City pool arrives as a separate static asset fetched post-paint; no chunk embeds the city list
    Failure Indicators: A multi-hundred-KB JS chunk containing city names, indicating a static import
    Evidence: .sisyphus/evidence/task-13-lazy-load.txt
  ```

  **Evidence to Capture**:
  - [ ] `task-13-search-ranking.txt`
  - [ ] `task-13-lazy-load.txt`

  **Commit**: YES
  - Message: `feat(search): add city autocomplete engine`
  - Files: `src/search/cityIndex.ts`, `package.json`
  - Pre-commit: `bun run build`

- [ ] 14. Game state reducer (TDD)

  **What to do**:
  - **RED first.** Pure reducer in `src/domain/gameReducer.ts` — no React, no I/O, fully testable.
  - Actions: `REVEAL_DAY`, `SUBMIT_GUESS`, `CONTINUE`, `RESOLVE`.
  - **Implements decision P1, the fix for the spec's critical design bug**: exactly **one guess per Day, five maximum**. `CONTINUE` advances the Day without spending that Day's guess. A wrong guess advances the Day *and* is recorded in `wrongGuesses`.
  - **`CONTINUE` must be rejected on Day 5** — there is no Day 6. Day 5 offers only FINAL GUESS. Attempting `CONTINUE` at Day 5 is a no-op returning unchanged state.
  - A correct guess sets `status: 'won'` and records `daySolved`. A wrong guess on Day 5 sets `status: 'lost'`.
  - **Guess identity is `geonameId` only** (gap G3). `SUBMIT_GUESS` must reject a geonameId already present in `guesses` — this is what prevents "München" and "Munich" being spent as two guesses at one city.
  - Reject any action once `status !== 'in_progress'` (no guessing after resolution).
  - Wrong guesses carry `distanceKm` and `band` from Task 4, computed against the answer coordinates.
  - Tests must cover: win on each of Days 1–5; loss on Day 5; CONTINUE through all five Days without guessing then a final correct guess; duplicate-geonameId rejection; CONTINUE rejected at Day 5; all actions rejected after resolution; and that `wrongGuesses` length never exceeds 5.

  **Must NOT do**:
  - Do not let a wrong guess and a CONTINUE have identical effect — that is the exact bug P1 fixes.
  - Do not allow more than one guess per Day, or more than five total.
  - Do not compare cities by name string anywhere in this module.
  - Do not touch React, localStorage, or fetch here — pure function only.
  - Do not add a forfeit/give-up action (not specified).
  - Do not compute a numeric score; "Day solved" plus wrong-guess count is the metric (§10).

  **Recommended Agent Profile**:
  - **Category**: `ultrabrain`
    - Reason: This reducer encodes the game's central rule-set including the fix to the spec's one critical design flaw; subtle errors make the game trivially exploitable or unwinnable.
  - **Skills**: [`test-driven-development`]
    - `test-driven-development`: the rule matrix (5 days × guess/continue × win/lose) is a natural test-first specification.

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 9–13, 15, 16)
  - **Blocks**: 22, 25
  - **Blocked By**: 3, 4

  **References**:
  - `initial.txt:64-98` — the gameplay loop. **Note the documented divergence**: §4 as written makes a wrong guess advance the Day exactly like CONTINUE, which makes CONTINUE strictly dominated. Decision P1 overrides this — read the Context section of this plan for the resolution before implementing.
  - `initial.txt:389-400` — guessing rules: one guess per revealed Day, the same city cannot be guessed twice.
  - `initial.txt:93-97` — Day 5 behaviour: strongest clue, final guess, loss on failure.
  - `initial.txt:483-512` — scoring: Day solved is primary, "Average Day solved" is the hero metric, speed must not dominate.
  - `src/domain/geo.ts` (Task 4) — `haversineKm` and `distanceBand` for wrong-guess feedback.

  **WHY Each Reference Matters**:
  - `initial.txt:64-98` must be read *together with* this plan's P1 resolution, or the executor will faithfully reimplement the dominated-CONTINUE bug.

  **Acceptance Criteria**:
  - [ ] Test file committed failing first (verifiable in `git log -p`)
  - [ ] `bun test src/domain/gameReducer.test.ts` → PASS, at least 20 assertions, 0 failures
  - [ ] Submitting a geonameId already in `guesses` leaves state unchanged
  - [ ] `CONTINUE` at `currentDay: 5` leaves state unchanged
  - [ ] Five wrong guesses produce `status: 'lost'` and `wrongGuesses.length === 5`
  - [ ] Any action dispatched after `status: 'won'` leaves state unchanged
  - [ ] `grep -n "\.city ===\|name ===" src/domain/gameReducer.ts` returns no match (identity is by id)
  - [ ] No `score` field is produced

  **QA Scenarios**:
  ```
  Scenario: The P1 fix holds — CONTINUE and a wrong guess differ
    Tool: Bash (bun)
    Preconditions: Reducer implemented
    Steps:
      1. From a fresh Day-1 state, dispatch CONTINUE; capture state as S_continue
      2. From the same fresh state, dispatch SUBMIT_GUESS with a wrong geonameId; capture as S_wrong
      3. Assert both have currentDay 2 (both advance)
      4. Assert S_continue.guesses.length === 0 and S_wrong.guesses.length === 1
      5. Assert S_continue has an empty wrongGuesses record and S_wrong has exactly one
      6. Print both states side by side
    Expected Result: Both advance the Day, but only the wrong guess leaves a permanent record — so CONTINUE is no longer strictly dominated
    Failure Indicators: The two states being deep-equal, meaning the P1 bug was reimplemented
    Evidence: .sisyphus/evidence/task-14-continue-vs-guess.txt

  Scenario: Alias duplicate cannot spend two guesses, and Day 5 has no CONTINUE
    Tool: Bash (bun)
    Preconditions: Reducer implemented
    Steps:
      1. Dispatch SUBMIT_GUESS with geonameId 2867714 (München); assert guesses.length 1, currentDay 2
      2. Dispatch SUBMIT_GUESS with the SAME geonameId 2867714 again; assert guesses.length is still 1 and currentDay is still 2 (rejected, no guess spent)
      3. Advance to currentDay 5 via four CONTINUEs
      4. Dispatch CONTINUE; assert currentDay is still 5 and status still in_progress
      5. Dispatch SUBMIT_GUESS with a wrong id; assert status === 'lost'
      6. Dispatch SUBMIT_GUESS again; assert state unchanged (no action after resolution)
    Expected Result: Duplicate guess rejected without cost; CONTINUE is a no-op at Day 5; post-resolution actions ignored
    Failure Indicators: Duplicate accepted (player wastes or gains a guess); CONTINUE advancing past Day 5
    Evidence: .sisyphus/evidence/task-14-duplicate-and-day5.txt
  ```

  **Evidence to Capture**:
  - [ ] `task-14-continue-vs-guess.txt`
  - [ ] `task-14-duplicate-and-day5.txt`

  **Commit**: YES
  - Message: `feat(game): add game state reducer`
  - Files: `src/domain/gameReducer.ts`, `src/domain/gameReducer.test.ts`
  - Pre-commit: `bun test`

- [ ] 15. Journal shell layout + paper stage

  **What to do**:
  - Build the persistent app shell: the journal object itself. Aged paper surface using Task 2's pre-baked WebP, a visible stitched binding edge, deckled/torn page edge, and the `THE LOST EXPLORER` masthead in the display face at genuinely large scale.
  - Wrap all content in `.stage { isolation: isolate }` so `mix-blend-mode: multiply` ink layers composite against the paper. **No intermediate ancestor may carry `transform`, `filter`, `opacity < 1`, or `will-change`** — these silently break the blend.
  - **Mobile-first (P12)**: single column at 390 px, comfortable thumb-reach for the action row, no horizontal scroll, no layout shift when a clue card is appended. Scale up to a wider journal page on desktop — but the two-page spread is Task 23's endgame screen only, not the main play surface.
  - Reserve a stable slot for the Day counter / puzzle number and a slot for the action row, so appending clue cards never reflows what is already on screen.
  - Include a footer slot for the GeoNames attribution (filled in Task 28).

  **Must NOT do**:
  - Do not implement the two-page spread here (Task 23).
  - Do not add a nav bar, sidebar, settings drawer, or routing beyond the single game page.
  - Do not use live `feTurbulence` on the full-bleed paper surface.
  - Do not put `transform` or `will-change` on any ancestor inside `.stage`.
  - Do not build a generic layout/grid system — one shell, one column.

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
    - Reason: This is the primary surface establishing whether the "physical journal" illusion reads as bold and intentional or as a beige web page.
  - **Skills**: none
  - **Skills Evaluated but Omitted**:
    - `frontend-ui-ux`: the visual direction is already specified; this is execution of a defined identity.

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 9–14, 16)
  - **Blocks**: 22, 24
  - **Blocked By**: 1, 2

  **References**:
  - `src/app/globals.css` (Task 2) — palette and font tokens, the `.stage` utility, and the paper texture path. Consume tokens; do not hardcode colours.
  - `https://developer.mozilla.org/en-US/docs/Web/CSS/mix-blend-mode` — the stacking-context rule driving the `isolation: isolate` requirement and the ban on intermediate transforms.
  - `initial.txt:40-60` — the narrative framing ("Day", the explorer lost for several days) that the masthead and Day counter must express.
  - `initial.txt:826-842` — tone: the repeated structure should become familiar and comforting; the player should scan a clue in a few seconds.

  **Design Direction**:
  - The journal is a physical object. Binding stitches, torn edge and paper grain are structural, not decorative afterthoughts.
  - Bold = scale contrast. The masthead should be large and confident against small clean UI text. One hot accent only (`--stamp-red`).

  **WHY Each Reference Matters**:
  - The `mix-blend-mode` doc is cited because the ink-on-paper effect is the core of the aesthetic and it fails *silently* — no error, just flat-looking ink — making the constraint easy to break unknowingly.

  **Acceptance Criteria**:
  - [ ] `bun run build` exits 0
  - [ ] An element with `isolation: isolate` wraps the content area (verified via computed style)
  - [ ] No ancestor inside `.stage` has a computed `transform` other than `none`
  - [ ] At 390 px width, `document.documentElement.scrollWidth <= 390` (no horizontal scroll)
  - [ ] Masthead renders in the `--font-display` family
  - [ ] Paper texture is applied as a `background-image` on the page surface

  **QA Scenarios**:
  ```
  Scenario: Shell renders the journal illusion across viewports with no overflow
    Tool: Playwright
    Preconditions: Dev server running
    Steps:
      1. Navigate to http://localhost:3000 at viewport 390x844
      2. Assert document.documentElement.scrollWidth <= 390 (no horizontal scroll)
      3. Assert the masthead element's computed font-family contains "Rye"
      4. Assert the page surface's computed background-image contains "paper"
      5. Screenshot full page
      6. Resize to 1280x800, assert still no horizontal scroll, screenshot full page
      7. Resize to 768x1024, screenshot
    Expected Result: Journal surface with visible paper texture, large display masthead, zero horizontal scroll at all three widths
    Failure Indicators: Horizontal scrollbar at 390px; fallback serif in the masthead; missing texture
    Evidence: .sisyphus/evidence/task-15-shell-responsive.png

  Scenario: Blend-mode isolation is correctly established
    Tool: Playwright
    Preconditions: Dev server running
    Steps:
      1. Navigate to http://localhost:3000
      2. Query the .stage element; assert getComputedStyle(el).isolation === "isolate"
      3. Walk every descendant of .stage that is an ancestor of the content slot; for each assert computed transform === "none" AND willChange === "auto" AND opacity === "1"
      4. Write the full walked element list with their computed values to evidence
    Expected Result: isolation is isolate on the stage, and no intermediate ancestor creates a competing stacking context
    Failure Indicators: Any intermediate element with a transform or will-change, which would silently flatten the ink blend
    Evidence: .sisyphus/evidence/task-15-blend-isolation.txt
  ```

  **Evidence to Capture**:
  - [ ] `task-15-shell-responsive.png`
  - [ ] `task-15-blend-isolation.txt`

  **Commit**: YES
  - Message: `feat(ui): add journal shell layout`
  - Files: `src/app/layout.tsx`, `src/app/page.tsx`, `src/components/JournalShell.tsx`
  - Pre-commit: `bun run build`

- [ ] 16. Stamp + artefact primitives

  **What to do**:
  - Build the reusable physical-object primitives every clue and result screen composes from:
    - `<RubberStamp>` — ink-stamp text in the display face with a rough edge, slight rotation, and `mix-blend-mode: multiply`. Variants: `day` (neutral ink), `wrong` (stamp-red), `found` (stamp-red, large), `lost` (ink, large).
    - `<WashiTape>` — a translucent tape strip for affixing artefacts, with two-strip placement support.
    - `<TornEdge>` — an irregular deckled edge usable on any container (SVG clip-path or mask).
    - `<PaperCard>` — the base artefact container: slight rotation, drop shadow suggesting a physical object resting on the page.
  - Animations in **CSS keyframes only** (no animation library): a stamp "thud" (fast scale-down with a tiny overshoot, settling), and a card "taped in" entrance (small rotation + fade). Short durations; nothing floaty.
  - Every animation must be disabled under `prefers-reduced-motion: reduce`, and decorative SVG filters dropped in that mode.
  - Any `feTurbulence` used for rough edges must be **static** — fixed `seed`, no `<animate>` on `baseFrequency` — and applied only to these small elements, never a large surface.

  **Must NOT do**:
  - Do not install framer-motion, GSAP, react-spring, or any animation library.
  - Do not animate `feTurbulence` or `baseFrequency` — confirmed iOS Safari crash risk and Firefox perf regression.
  - Do not apply these filters to full-width or full-height elements.
  - Do not build primitives the screens do not need — four components, not a design system.
  - Do not bake any text into an image or SVG `<path>`; stamp text must remain real selectable DOM text (gap G5).

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
    - Reason: These primitives carry most of the "bold" character; the stamp thud and tape placement are craft details that determine whether the aesthetic lands.
  - **Skills**: none
  - **Skills Evaluated but Omitted**:
    - `frontend-ui-ux`: direction is specified; this is execution.

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 9–15)
  - **Blocks**: 18, 19, 20
  - **Blocked By**: 2

  **References**:
  - `src/app/globals.css` (Task 2) — tokens and the reduced-motion block.
  - `https://github.com/gotoailab/modern_mermaid/blob/main/src/components/Preview.tsx#L1264` — a real static two-pass `feTurbulence` + `feDisplacementMap` hand-drawn-wobble filter. Copy the *structure*; note the fixed `seed` and absence of animation.
  - `https://www.smashingmagazine.com/2021/09/deep-dive-wonderful-world-svg-displacement-filtering/` — why compound SVG filters drop frames, and the confirmation that they are not reliably GPU-accelerated.
  - `https://bugzilla.mozilla.org/show_bug.cgi?id=1879590` — the open Firefox perf regression on animated feTurbulence.
  - `https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion` — the correct query and the expectation that motion is removed, not merely shortened.
  - `initial.txt:515-535` — the FOUND / LOST result language the stamp variants render.

  **Design Direction**:
  - Stamps should feel *struck*, not faded in — fast, decisive, with a hint of overshoot and an off-axis rotation so no two look mechanically identical.
  - A wrong-guess stamp is a permanent scar on the page, not a transient toast.

  **WHY Each Reference Matters**:
  - The modern_mermaid filter is a working, shipped example of the exact rough-edge effect wanted, which is faster and safer than deriving filter parameters from scratch.
  - The Firefox bug and Smashing article together explain why the filters must be static and small — otherwise an executor will reasonably animate them for extra life and tank mobile performance.

  **Acceptance Criteria**:
  - [ ] `bun run build` exits 0
  - [ ] `grep -rn "framer-motion\|gsap\|react-spring" package.json` returns no match
  - [ ] `grep -rn "<animate" src/components/` returns no match
  - [ ] Every `feTurbulence` in `src/components/` has an explicit `seed` attribute
  - [ ] Stamp text appears in `document.body.innerText` (it is real text, not an image)
  - [ ] All four primitives render without console errors

  **QA Scenarios**:
  ```
  Scenario: Stamps render as real text with correct variants
    Tool: Playwright
    Preconditions: A scratch route or story page rendering all four primitives and all stamp variants
    Steps:
      1. Navigate to the primitives demo page
      2. Assert document.body.innerText contains "DAY 3", "WRONG", "FOUND" and "LOST" (proves text is real DOM text, not rasterised)
      3. For the WRONG stamp, assert its computed color resolves to the --stamp-red value
      4. For the DAY stamp, assert computed mix-blend-mode === "multiply"
      5. Assert each stamp has a non-zero computed rotation in its transform matrix
      6. Screenshot all primitives at 390x844 and at 1280x800
    Expected Result: All stamp text selectable in the DOM; red variant uses the accent token; blend mode active; stamps visibly rotated off-axis
    Failure Indicators: Stamp text absent from innerText (baked into an image, breaking screen readers per gap G5); blend-mode "normal"
    Evidence: .sisyphus/evidence/task-16-primitives.png

  Scenario: Reduced motion removes animation and decorative filters
    Tool: Playwright
    Preconditions: Primitives demo page available
    Steps:
      1. Create a context with reducedMotion: "reduce"
      2. Navigate to the primitives demo page
      3. For each animated element, assert getComputedStyle(el).animationName === "none" OR animationDuration === "0s"
      4. Assert decorative filter elements have computed filter === "none"
      5. Screenshot to confirm the layout is still intact and legible without motion
      6. Repeat with reducedMotion "no-preference" and assert animationName is NOT "none" (proves the animation exists at all and the test is meaningful)
    Expected Result: With reduce, zero running animations and no decorative filters; without it, animations are present — proving the media query is load-bearing
    Failure Indicators: Animations still running under reduce; or no animation in either mode, meaning the control case is vacuous
    Evidence: .sisyphus/evidence/task-16-reduced-motion.png
  ```

  **Evidence to Capture**:
  - [ ] `task-16-primitives.png`
  - [ ] `task-16-reduced-motion.png`

  **Commit**: YES
  - Message: `feat(ui): add stamp and artefact primitives`
  - Files: `src/components/RubberStamp.tsx`, `src/components/WashiTape.tsx`, `src/components/TornEdge.tsx`, `src/components/PaperCard.tsx`
  - Pre-commit: `bun run build`

- [ ] 17. puzzle-lint script + CI wiring

  **What to do**:
  - Implement `scripts/puzzle-lint.ts`, run via `bun run puzzle-lint`, turning §17's human checklist into **executable** checks (P8). Non-zero exit on any failure, with a per-puzzle per-rule report.
  - Rules (each must name the puzzle and the rule on failure):
    1. Schema valid against Task 3's zod schema.
    2. `geonameId` exists in `public/data/city-pool.json` (gap G2 — otherwise unwinnable).
    3. At least one pool `keys` entry equals `toSearchKey(city)` (the answer is reachable by typing its name).
    4. `distanceKm` within max(5%, 50 km) of `haversineKm(coordinates, referenceCityCoordinates)`.
    5. `distanceKm >= 800` and `recognisability === 'global'` (decision P3).
    6. `referenceCity` is not the answer city.
    7. Every `flagColours` entry is in the Task 10 allowlist for that `countryCode`, and the array is non-empty.
    8. `helpPhrase` does not contain the city or country name, compared via `toSearchKey` so diacritics and case cannot evade it (§17).
    9. `helpPhrase` is non-empty and differs from `helpPhraseTranslation`.
    10. `historicalSourceUrl` present and a well-formed `https://` URL.
    11. `mapYear` between 1500 and the current year.
    12. `populationSource` has `name`, a well-formed URL, and an `asOfYear` within the last 20 years.
    13. `metroPopulationMillions > 0`.
    14. `publishDate` is a valid `YYYY-MM-DD`, and **no two puzzles share one** (duplicate dates would make a day ambiguous).
    15. `landscape` is a valid enum member.
  - Print a summary table and `N/N puzzles passed`.
  - Wire into CI (GitHub Actions) alongside `typecheck`, `test` and `build`.
  - Document in a header comment which §17 items are **not** machine-checkable — Day 4 historical accuracy, Day 5 grammatical naturalness, and overall fairness — so these remain explicit human responsibilities rather than being assumed covered.

  **Must NOT do**:
  - Do not attempt to auto-verify historical claims or translation quality; assert provenance fields exist instead.
  - Do not make lint warn-only; it must fail the build.
  - Do not duplicate haversine or normalization logic — import from Tasks 4 and 6.
  - Do not add rules for fields outside the schema.

  **Recommended Agent Profile**:
  - **Category**: `deep`
    - Reason: Translating a 35-line prose checklist into precise executable rules requires careful interpretation and judgement about what is actually checkable.
  - **Skills**: none
  - **Skills Evaluated but Omitted**:
    - `test-driven-development`: the script's own correctness is demonstrated by running it against deliberately-broken fixtures (see QA), which is more direct than unit-testing each rule.

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3 (with Tasks 18–22)
  - **Blocks**: 29
  - **Blocked By**: 3, 4, 6, 7, 8, 9

  **References**:
  - `initial.txt:722-757` — **the authoritative source for this task.** Every checkable item in §17 must map to a numbered rule above; read it line by line and confirm coverage.
  - `initial.txt:761-822` — §18 edge cases, several of which become rules (flag ambiguity, population definitions, phrase content).
  - `src/domain/geo.ts` (Task 4), `src/domain/normalize.ts` (Task 6), `src/domain/puzzle.ts` (Task 3), `src/domain/flagColours.ts` (Task 10) — all imported, none reimplemented.

  **WHY Each Reference Matters**:
  - §17 is the user's own quality bar; this script's value is exactly proportional to how faithfully it encodes it, so the mapping must be explicit and complete.

  **Acceptance Criteria**:
  - [ ] `bun run puzzle-lint` exits 0 against the six real puzzles and prints `6/6 puzzles passed`
  - [ ] All 15 rules are implemented and each can be individually triggered
  - [ ] Running against a fixture with a wrong `distanceKm` exits non-zero and names rule 4
  - [ ] Running against a fixture whose `helpPhrase` contains the city name exits non-zero and names rule 8
  - [ ] Running against two puzzles sharing a `publishDate` exits non-zero and names rule 14
  - [ ] CI workflow file runs `puzzle-lint`
  - [ ] Header comment lists the non-machine-checkable §17 items

  **QA Scenarios**:
  ```
  Scenario: Lint passes real content and catches every seeded defect
    Tool: Bash
    Preconditions: Six real puzzles authored; lint implemented
    Steps:
      1. Run `bun run puzzle-lint`; assert exit 0 and stdout contains "6/6"
      2. Copy the six puzzles to a temp fixture dir
      3. Seed defect A: change one distanceKm to 50; run lint on the fixture dir; assert non-zero exit and stdout naming rule 4
      4. Seed defect B: set a helpPhrase to "Do you need help in Tbilisi?"; assert non-zero exit naming rule 8
      5. Seed defect C: delete a historicalSourceUrl; assert non-zero exit naming rule 10
      6. Seed defect D: set two publishDate values identical; assert non-zero exit naming rule 14
      7. Seed defect E: add "purple" to a flagColours array; assert non-zero exit naming rule 7
      8. Seed defect F: set a geonameId to 999999999; assert non-zero exit naming rule 2
      9. Restore the real content and re-run; assert exit 0 again
    Expected Result: Clean content passes; all six seeded defects are individually caught and reported by rule number; restoring returns to a passing state
    Failure Indicators: Any seeded defect passing lint — the rule is not actually implemented or is warn-only
    Evidence: .sisyphus/evidence/task-17-lint-defect-detection.txt

  Scenario: Lint is wired into CI and fails the pipeline
    Tool: Bash
    Preconditions: CI workflow added
    Steps:
      1. Assert the workflow file contains a step running `bun run puzzle-lint`
      2. Assert it also runs typecheck, test and build
      3. Locally simulate: seed a defect, run the full command chain `bun run typecheck && bun test && bun run puzzle-lint && bun run build`
      4. Assert the chain exits non-zero and that it stops at the puzzle-lint step
      5. Restore and assert the full chain exits 0
    Expected Result: puzzle-lint is a hard gate in the pipeline — a bad puzzle cannot reach production
    Failure Indicators: Chain continuing past a lint failure, indicating warn-only behaviour
    Evidence: .sisyphus/evidence/task-17-ci-gate.txt
  ```

  **Evidence to Capture**:
  - [ ] `task-17-lint-defect-detection.txt`
  - [ ] `task-17-ci-gate.txt`

  **Commit**: YES
  - Message: `feat(tooling): add puzzle-lint quality checks`
  - Files: `scripts/puzzle-lint.ts`, `.github/workflows/ci.yml`, `package.json`
  - Pre-commit: `bun run puzzle-lint`

- [ ] 18. Clue artefacts, Days 1–3

  **What to do**:
  - `<Day1Horizon>` — a pencil-sketch horizon. Use a **small fixed set of hand-made SVG motifs** keyed to the `landscape` enum (flat, hilly, mountainous, coastal, lakeside, river, desert, tropical, high-altitude). Population text rendered beside it in the journal hand, using Task 7's `formatPopulation` + `populationDescription`.
  - `<Day2Sign>` — a road sign affixed with two `<WashiTape>` strips, slightly crooked. The sign text is **real DOM text** styled to look stencilled (gap G5).
  - `<Day3FlagCloth>` — a torn cloth swatch (via `<TornEdge>`) showing the real flag SVG from Task 10, plus the colour-set sentence from Task 7.
  - All three compose `<PaperCard>` and enter with the "taped in" animation.

  **Must NOT do**:
  - Do not build a procedural/generative horizon system — a fixed motif per enum value.
  - Do not bake clue text into SVG paths or images; text must be real and selectable.
  - Do not reveal the full flag design in a way that trivially identifies the country — it is a torn fragment.
  - Do not reimplement clue string formatting; import from Task 7.

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering` — Reason: these three artefacts carry the game's first impression and most of its charm.
  - **Skills**: none
  - **Skills Evaluated but Omitted**: `frontend-ui-ux` — direction already specified.

  **Parallelization**:
  - **Can Run In Parallel**: YES · **Parallel Group**: Wave 3 (with 17, 19–22) · **Blocks**: 22 · **Blocked By**: 2, 7, 9, 16

  **References**:
  - `initial.txt:105-178` — Day 1 template, population rules, and the authoritative environment list the motifs must cover.
  - `initial.txt:182-221` — Day 2 sign template and wording.
  - `initial.txt:225-259` — Day 3 flag wording (note decision P2 changes this to a full colour set).
  - `src/domain/clueText.ts` (Task 7) — all clue strings come from here.
  - `src/components/PaperCard.tsx`, `WashiTape.tsx`, `TornEdge.tsx` (Task 16) — compose these, do not re-create them.
  - `src/domain/flagColours.ts` (Task 10) — flag asset path resolution.

  **WHY Each Reference Matters**: `initial.txt:160-177` defines exactly which landscapes must have a motif — missing one makes a future puzzle unrenderable.

  **Acceptance Criteria**:
  - [ ] `bun run build` exits 0
  - [ ] A motif exists for every `landscape` enum member (asserted by iterating the enum)
  - [ ] Day 1 population text appears in `innerText` and matches `formatPopulation` output exactly
  - [ ] Day 2 sign text appears in `innerText`
  - [ ] `grep -rn "procedural\|generateHorizon\|random" src/components/Day1Horizon.tsx` returns no match
  - [ ] No clue text is inside an `<image>` or a `<path>` element

  **QA Scenarios**:
  ```
  Scenario: All three artefacts render with real text for every landscape
    Tool: Playwright
    Preconditions: Demo route rendering Days 1-3 with a Tbilisi fixture
    Steps:
      1. Navigate to the demo route
      2. Assert innerText contains "1.2 million" (or the fixture's formatted population) and "fairly busy"
      3. Assert innerText contains the Day 2 reference city name and the formatted distance
      4. Assert innerText contains "and no other colours"
      5. Assert the flag <img> or <svg> has a non-zero boundingBox width
      6. Iterate every landscape enum value, re-render, and assert a motif SVG is present with non-zero dimensions for each
      7. Screenshot all three cards at 390x844 and 1280x800
    Expected Result: All clue text present as real DOM text; a visible motif for every landscape; flag fragment visible
    Failure Indicators: Any landscape rendering an empty/zero-size motif; clue text missing from innerText
    Evidence: .sisyphus/evidence/task-18-days-1-3.png

  Scenario: Artefact text is accessible to assistive technology
    Tool: Playwright
    Preconditions: Demo route available
    Steps:
      1. Navigate to the demo route
      2. Capture the accessibility snapshot
      3. Assert the Day 1, Day 2 and Day 3 clue sentences all appear in the accessibility tree as text nodes
      4. Assert decorative elements (tape, torn edge, paper grain) are either aria-hidden or have no accessible name
      5. Write the snapshot to evidence
    Expected Result: All clue content exposed to screen readers; purely decorative artefacts hidden from the tree
    Failure Indicators: Clue text absent from the a11y tree; decorative tape announced as meaningful content
    Evidence: .sisyphus/evidence/task-18-a11y-tree.txt
  ```

  **Evidence to Capture**: `task-18-days-1-3.png`, `task-18-a11y-tree.txt`

  **Commit**: YES · Message: `feat(ui): add Day 1-3 clue artefacts` · Files: `src/components/clues/Day1Horizon.tsx`, `Day2Sign.tsx`, `Day3FlagCloth.tsx`, `src/components/clues/horizons/*.tsx` · Pre-commit: `bun run build`

- [ ] 19. Clue artefacts, Days 4–5 + Noto script fallbacks

  **What to do**:
  - `<Day4MapFragment>` — a yellowed, folded map scrap with crease shadows, the year as a `<RubberStamp variant="day">`-style date stamp in the typewriter face, and the historical-entity sentence as real text.
  - `<Day5Napkin>` — the overheard phrase on a napkin/ticket stub, rendered **large and beautiful**. This is the game's signature recurring moment.
  - **Critical: the Noto fallback stack.** `Caveat` covers Latin + Latin-Ext + Cyrillic **only**. Georgian, Japanese, Arabic and Devanagari would render as tofu boxes. Implement a CSS font stack: `Caveat, 'Noto Sans Georgian', 'Noto Sans JP', 'Noto Naskh Arabic', 'Noto Sans Devanagari', 'Noto Sans', sans-serif`.
  - Load each Noto family via its own `next/font/google` call with a scoped `subsets`, and **code-split per clue language** — select the needed family from the puzzle's `languageCode` rather than bundling every script into the app shell.
  - Prefer `Noto Naskh Arabic` over `Noto Sans Arabic` — closer to an antique manuscript hand.
  - Ensure the native-script phrase has a `lang` attribute set from `languageCode` for correct shaping and screen-reader pronunciation.
  - The English translation must **not** be rendered pre-resolution.

  **Must NOT do**:
  - Do not bundle all Noto scripts unconditionally into the main shell.
  - Do not render `helpPhraseTranslation` before the game resolves.
  - Do not substitute a transliteration or romanization for the native script.
  - Do not omit the `lang` attribute.

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering` — Reason: multi-script typography with a real tofu-rendering failure mode, plus the game's signature visual moment.
  - **Skills**: none
  - **Skills Evaluated but Omitted**: `frontend-ui-ux` — direction specified.

  **Parallelization**:
  - **Can Run In Parallel**: YES · **Parallel Group**: Wave 3 (with 17, 18, 20–22) · **Blocks**: 22 · **Blocked By**: 2, 9, 10, 16

  **References**:
  - `initial.txt:263-308` — Day 4 template, four worked examples, and the rule to prefer historical states/empires/federations.
  - `initial.txt:312-356` — Day 5 template, the no-translation-before-guessing rule, and the instruction that Day 5 should feel like a recognisable recurring moment.
  - `https://github.com/notofonts/noto-docs/blob/main/docs/website/use.md` — Google's official guidance on composing a Noto fallback stack rather than seeking one universal font.
  - `https://nextjs.org/docs/app/getting-started/fonts` — `next/font/google` with explicit `subsets` (mandatory or the build errors).
  - `https://fonts.google.com/specimen/Caveat` — confirm the coverage gap first-hand.
  - `src/domain/clueText.ts` (Task 7) — `renderDay4` / `renderDay5`.

  **WHY Each Reference Matters**: The Noto doc and the Caveat specimen together make the tofu risk concrete — without them an executor will reasonably assume the journal font handles all five languages and ship broken Georgian.

  **Acceptance Criteria**:
  - [ ] `bun run build` exits 0
  - [ ] Georgian, Japanese, Arabic and Devanagari sample phrases all render with non-zero glyph width (no tofu)
  - [ ] The phrase element carries a `lang` attribute matching the puzzle's `languageCode`
  - [ ] `helpPhraseTranslation` is absent from the DOM pre-resolution
  - [ ] Noto families are not all present in the initial document request (code-split verified)

  **QA Scenarios**:
  ```
  Scenario: Every Day 5 script renders real glyphs, not tofu
    Tool: Playwright
    Preconditions: Demo route accepting a language fixture
    Steps:
      1. For each fixture in [Georgian "დახმარება ხომ არ გჭირდება?", Japanese "助けが必要ですか？", Arabic "هل تحتاج مساعدة؟", Devanagari "क्या आपको मदद चाहिए?", Catalan "Necessites ajuda?"]:
      2. Navigate to the demo route with that fixture
      3. Await document.fonts.ready
      4. Measure the phrase element's boundingBox; assert width > 50 and height > 10
      5. Assert the element's computed font-family list contains the expected Noto family for that script (or Caveat for Catalan)
      6. Assert the element's lang attribute is set
      7. Screenshot each
    Expected Result: All five scripts render with substantial glyph width and the correct family resolved; no fixture collapses to tofu-box width
    Failure Indicators: Suspiciously uniform narrow width across scripts (tofu boxes all render the same size); missing lang attribute
    Evidence: .sisyphus/evidence/task-19-script-rendering.png

  Scenario: Translation stays hidden until resolution
    Tool: Playwright
    Preconditions: Demo route with a Day 5 fixture including a translation field
    Steps:
      1. Navigate with status in_progress
      2. Assert document.body.innerHTML does NOT contain "Do you need help"
      3. Assert the native phrase IS present
      4. Re-render with status won
      5. Assert the translation IS now present
      6. Screenshot both states
    Expected Result: Translation absent from the DOM entirely while in progress; revealed only after resolution
    Failure Indicators: Translation present but merely CSS-hidden (readable via devtools, defeating Day 5)
    Evidence: .sisyphus/evidence/task-19-translation-gate.png
  ```

  **Evidence to Capture**: `task-19-script-rendering.png`, `task-19-translation-gate.png`

  **Commit**: YES · Message: `feat(ui): add Day 4-5 clue artefacts with Noto fallbacks` · Files: `src/components/clues/Day4MapFragment.tsx`, `Day5Napkin.tsx`, `src/styles/scriptFonts.ts` · Pre-commit: `bun run build`

- [ ] 20. Guess input UI + autocomplete dropdown

  **What to do**:
  - Build the guess input: journal-styled text field, an autocomplete dropdown fed by Task 13, and GUESS / CONTINUE actions.
  - **Submission requires a selected entity, not free text.** The submit action stays disabled until the player picks a dropdown option, so every guess carries a `geonameId` (gap G3) and ambiguous input like "Paris" can never be submitted unresolved.
  - Dropdown labels disambiguate by country.
  - Full keyboard support: arrow up/down to move the active option, Enter to select, Escape to dismiss. Correct ARIA combobox roles and `aria-activedescendant`.
  - Already-guessed cities are visibly marked and non-selectable.
  - **On Day 5, render FINAL GUESS only — no CONTINUE button.**
  - Disable input while the city index is still loading, with a quiet loading affordance.
  - Mobile: dropdown must not be obscured by the on-screen keyboard; actions within thumb reach.

  **Must NOT do**:
  - Do not permit free-text submission.
  - Do not render CONTINUE on Day 5.
  - Do not implement search logic here — consume Task 13.
  - Do not use hover-only affordances.
  - Do not auto-submit on a single fuzzy match.

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering` — Reason: the highest-interaction component in the app, where mobile keyboard behaviour and a11y correctness matter most.
  - **Skills**: none
  - **Skills Evaluated but Omitted**: `test-driven-development` — interaction behaviour verified via Playwright rather than unit tests.

  **Parallelization**:
  - **Can Run In Parallel**: YES · **Parallel Group**: Wave 3 (with 17–19, 21, 22) · **Blocks**: 22 · **Blocked By**: 13, 16

  **References**:
  - `initial.txt:389-414` — guessing rules, including that the same city cannot be guessed twice and what autocomplete must normalize.
  - `initial.txt:66-98` — the GUESS / CONTINUE choice, and that Day 5 offers only a final guess.
  - `https://www.w3.org/WAI/ARIA/apg/patterns/combobox/` — the authoritative ARIA combobox pattern: roles, `aria-expanded`, `aria-activedescendant`, keyboard interaction.
  - `src/search/cityIndex.ts` (Task 13) — `search()` and `isLoaded`.

  **WHY Each Reference Matters**: The ARIA combobox pattern is cited because hand-rolled autocompletes are a classic accessibility failure, and Task 27's Lighthouse ≥90 gate depends on getting the roles right here.

  **Acceptance Criteria**:
  - [ ] `bun run build` exits 0
  - [ ] Submit is disabled with free text typed but no option selected
  - [ ] Submit is enabled only after an option is chosen
  - [ ] Input has `role="combobox"` with `aria-expanded` reflecting dropdown state
  - [ ] Arrow keys move the active option and Enter selects it
  - [ ] No CONTINUE button exists in the DOM when `currentDay === 5`
  - [ ] An already-guessed city appears marked and is not selectable

  **QA Scenarios**:
  ```
  Scenario: Only resolved entities can be submitted
    Tool: Playwright
    Preconditions: Dev server running, game page at Day 1, city index loaded
    Steps:
      1. Fill the guess input with "tbil" and do NOT select an option
      2. Assert the submit button has the disabled attribute
      3. Press Enter; assert no guess was recorded (guess list length unchanged)
      4. Type "tbilisi", wait for the dropdown, assert at least one option is visible
      5. Press ArrowDown then Enter to select the first option
      6. Assert the submit button is now enabled
      7. Click submit; assert a guess was recorded exactly once
      8. Screenshot the dropdown open state
    Expected Result: Free text is unsubmittable; only a selected dropdown entity produces a guess; exactly one guess recorded
    Failure Indicators: Enter on unresolved text recording a guess; submit enabled without a selection
    Evidence: .sisyphus/evidence/task-20-entity-required.png

  Scenario: Day 5 offers no escape, and duplicates are blocked
    Tool: Playwright
    Preconditions: Game page, ability to advance to Day 5
    Steps:
      1. Advance to Day 5 by pressing CONTINUE four times
      2. Assert no element with accessible name matching /continue/i exists in the DOM
      3. Assert a FINAL GUESS action is present
      4. Navigate a fresh game, submit "Munich" as a wrong guess
      5. Type "München" and open the dropdown
      6. Assert the Munich option is rendered as already-guessed and is not selectable (aria-disabled or absent from selectable options)
      7. Attempt to select it; assert no second guess is recorded
      8. Screenshot both states
    Expected Result: CONTINUE absent at Day 5; the same city under a different alias cannot be guessed twice
    Failure Indicators: CONTINUE present at Day 5; München selectable after Munich was guessed (burns a second guess on one city)
    Evidence: .sisyphus/evidence/task-20-day5-and-duplicates.png
  ```

  **Evidence to Capture**: `task-20-entity-required.png`, `task-20-day5-and-duplicates.png`

  **Commit**: YES · Message: `feat(ui): add guess input with autocomplete` · Files: `src/components/GuessInput.tsx`, `src/components/CityDropdown.tsx`, `src/components/ActionRow.tsx` · Pre-commit: `bun run build`

- [ ] 21. Antique world map component (d3-geo)

  **What to do**:
  - Build the endgame map with **raw `d3-geo` + `topojson-client`** (~3.2 KB gzip). **Do not use react-simple-maps** — React 19 peer-dep friction, an open "library is dead" issue, and 33 KB gzip of unused zoom/drag/transition code.
  - Load `countries-110m.json` (~108 KB) from `public/data/` via `fetch` inside a `next/dynamic({ ssr: false })` component. **Never `import` the JSON** — that inlines 108 KB into the bundle and adds parse cost on every route.
  - Projection: `geoNaturalEarth1` (core d3-geo, 0 KB extra, reads as a vintage atlas). Do **not** use `geoEquirectangular`.
  - Render country paths via `geoPath(projection)`, styled as hand-inked outlines on paper. Ocean filled with an SVG `<pattern>` stipple/hatch (vector, zero runtime cost).
  - Draw dashed great-circle arcs from the true city to each wrong guess. `geoPath` **already adaptively samples** a 2-point `LineString` into a curved arc — no manual interpolation needed. If custom sampling is required, use `geoInterpolate`, **never a linear lerp on longitude** (it takes the long way round).
  - **Set `projection.preclip(geoClipAntimeridian)`** or dateline-crossing routes smear across the entire map width.
  - Mark the true city distinctly from wrong guesses.

  **Must NOT do**:
  - Do not install react-simple-maps, leaflet, mapbox-gl, or any tile-based map.
  - Do not `import` the TopoJSON file.
  - Do not use raster map tiles or satellite imagery — it would destroy the aesthetic and require an API key.
  - Do not add pan/zoom/drag — this is a static reveal.
  - Do not ship `countries-50m.json` (756 KB) or `10m` (3.66 MB).
  - Do not animate the route drawing (§22.10 is deferred).

  **Recommended Agent Profile**:
  - **Category**: `artistry` — Reason: making a 110m vector world map read convincingly as hand-drawn antique cartography, while handling projection and antimeridian correctness, needs both craft and precision.
  - **Skills**: none
  - **Skills Evaluated but Omitted**: `frontend-ui-ux` — the aesthetic target is specified; this is cartographic execution.

  **Parallelization**:
  - **Can Run In Parallel**: YES · **Parallel Group**: Wave 3 (with 17–20, 22) · **Blocks**: 23 · **Blocked By**: 2, 4

  **References**:
  - `https://github.com/topojson/world-atlas` — the `world-atlas@2.0.2` package, ISC licensed, Natural Earth derived (public domain, no attribution needed). Confirms `countries-110m.json` naming and that 110m is the small-scale/global file.
  - `https://github.com/d3/d3-geo` — `geoPath`, `geoNaturalEarth1`, `geoInterpolate`, `geoClipAntimeridian`, and `projection.preclip`. Read the clipping section specifically.
  - `https://github.com/d3/d3-geo-projection#geoNaturalEarth1` — confirms `geoNaturalEarth1` is in **core** d3-geo (tagged `[d3-geo]`), so no extra 31 KB dependency is needed.
  - `https://github.com/d3/d3-geo/blob/main/src/clip/antimeridian.js` — the antimeridian clipping implementation, for understanding what `preclip` does.
  - `https://github.com/owid/owid-grapher/blob/c7a8c59a78654779a0dd4f7a700965ca9f174dcf/packages/%40ourworldindata/grapher/src/mapCharts/GlobeController.ts#L1-L10` — production d3-geo usage in React, including the `geoInterpolate` + easing pattern (relevant only if a globe variant is explored later).
  - `https://github.com/zcreativelabs/react-simple-maps/issues/388` — the React 19 peer-dependency issue. Read to understand why this library is excluded.
  - `initial.txt:537-551` — the post-game content the map supports: city on a map, guesses plotted geographically, actual distances.

  **Design Direction**: Ink outlines on paper, stippled ocean, dashed brass route lines. No gradients, no drop shadows on the map itself, no modern cartographic chrome.

  **WHY Each Reference Matters**:
  - The `geoNaturalEarth1` core confirmation prevents an unnecessary 31 KB `d3-geo-projection` install.
  - The antimeridian source is cited because the bug it fixes is invisible until a specific guess pairing triggers it, and the QA scenario below deliberately provokes it.

  **Acceptance Criteria**:
  - [ ] `bun run build` exits 0
  - [ ] `grep -rn "react-simple-maps\|leaflet\|mapbox" package.json` returns no match
  - [ ] `grep -rn "countries-110m.json" src/ | grep -E "import|require"` returns no match
  - [ ] `public/data/countries-110m.json` exists and is under 150 KB
  - [ ] `projection.preclip(geoClipAntimeridian)` is called
  - [ ] Map renders country paths and at least one dashed arc without console errors
  - [ ] No chunk in `.next/static` contains the TopoJSON payload

  **QA Scenarios**:
  ```
  Scenario: Map renders with curved arcs and survives the antimeridian
    Tool: Playwright
    Preconditions: Demo route rendering the map with configurable marker coordinates
    Steps:
      1. Render with true city Tbilisi (41.72, 44.83) and wrong guesses Paris, Cairo, Delhi
      2. Assert the SVG contains more than 100 <path> elements (country outlines present)
      3. Assert exactly 3 arc paths are present with a stroke-dasharray set
      4. For one arc, read its "d" attribute and assert it contains more than 2 coordinate commands — proving it is an adaptively-sampled curve, not a straight 2-point chord
      5. Re-render with true city Anchorage (61.22, -149.90) and a wrong guess Petropavlovsk-Kamchatsky (53.02, 158.65) — a dateline-crossing pair
      6. Assert the arc's total rendered width is less than 60% of the SVG viewport width (a smeared antimeridian bug would span nearly the full width)
      7. Screenshot both renders
    Expected Result: Full country map, three dashed curved arcs, and the dateline pair drawing a short arc rather than a full-width smear
    Failure Indicators: Arc "d" containing only a single straight segment (no adaptive sampling); dateline arc spanning the whole map (preclip missing)
    Evidence: .sisyphus/evidence/task-21-map-arcs.png

  Scenario: TopoJSON is fetched, never bundled
    Tool: Bash + Playwright
    Preconditions: Production build completed
    Steps:
      1. Run `bun run build`
      2. Assert `grep -rl "countries-110m\|\"type\":\"Topology\"" .next/static/chunks` finds nothing
      3. Playwright: record network requests, navigate to a page WITHOUT the map; assert no request for countries-110m.json
      4. Navigate to the endgame/map route; assert a request for /data/countries-110m.json DOES occur
      5. Write the request lists for both routes to evidence
    Expected Result: TopoJSON absent from all JS chunks and fetched only on the route that needs the map
    Failure Indicators: Topology data found inside a chunk (static import), or fetched on routes that never show a map
    Evidence: .sisyphus/evidence/task-21-topojson-lazy.txt
  ```

  **Evidence to Capture**: `task-21-map-arcs.png`, `task-21-topojson-lazy.txt`

  **Commit**: YES · Message: `feat(map): add antique world map with great-circle arcs` · Files: `src/components/map/AntiqueWorldMap.tsx`, `src/components/map/arcs.ts`, `public/data/countries-110m.json`, `package.json` · Pre-commit: `bun run build`

- [ ] 22. Game screen wiring — the full playable loop

  **What to do**:
  - Compose everything into the playable daily game. This is the integration task that makes the product real.
  - Fetch `?stage=N` from Task 11 as Days unlock — **request the next stage only when the player actually advances**, so later clues never arrive early.
  - Drive state through Task 14's reducer; persist via Task 12's hook; render clue artefacts from Tasks 18–19; take guesses from Task 20.
  - Append each new clue card below the previous ones so the journal accumulates — the player can re-read every earlier clue. No carousel, no replacing.
  - Render a wrong guess as a permanent `<RubberStamp variant="wrong">` scar with the city name and its distance band.
  - On resolution, transition to Task 23's reveal.
  - **Resume correctly**: a reload mid-game restores the exact Day, guesses, and `startedAtMs`, and re-fetches only up to the unlocked stage.
  - **Handle UTC rollover mid-session** (gap: mid-game rollover): on detecting that `getPuzzleDayKey()` no longer matches the in-progress game's `dayKey`, discard the stale in-progress board and present today's puzzle. The abandoned game naturally fails to count as a win, so Task 12's derived streak handles it with no special case.
  - If the player already finished today, show the completed result rather than a fresh board.

  **Must NOT do**:
  - Do not prefetch stages the player has not unlocked.
  - Do not hold the answer in client state before resolution.
  - Do not recompute day boundaries locally — import from Task 5.
  - Do not replace earlier clue cards; accumulate them.
  - Do not add routing beyond the single game page.

  **Recommended Agent Profile**:
  - **Category**: `deep` — Reason: integration across eight modules with ordering, resume and rollover subtleties; needs autonomous diagnosis when pieces interact badly.
  - **Skills**: none
  - **Skills Evaluated but Omitted**: `test-driven-development` — the units are already tested; this layer is verified end-to-end by Playwright.

  **Parallelization**:
  - **Can Run In Parallel**: NO — this is the integration point
  - **Parallel Group**: Wave 3 (runs alongside 17–21 but completes last) · **Blocks**: 23, 25, 27 · **Blocked By**: 11, 12, 14, 15, 18, 19, 20

  **References**:
  - `initial.txt:64-98` — the loop, read together with this plan's P1 resolution.
  - `initial.txt:360-386` — the intended information curve and the feeling the accumulating clues should produce.
  - `initial.txt:417-437` — wrong-guess feedback (bands per decision P4).
  - `https://github.com/the-abe-train/globle/blob/7fe4ae74321c94f049631eb8c9c35982aa809bc6/src/hooks/useLocalStorage.tsx#L27-L34` — the stale in-progress expiry pattern for the rollover case.
  - `src/domain/gameReducer.ts` (14), `src/state/usePersistedGame.ts` (12), `src/app/api/daily/route.ts` (11), `src/domain/dailyClock.ts` (5).

  **WHY Each Reference Matters**: Globle's expiry hook is the concrete precedent for discarding a stale board without destroying history — the behaviour this task must reproduce.

  **Acceptance Criteria**:
  - [ ] `bun run build` exits 0 and `bun test` passes
  - [ ] A Day-1 correct guess ends the game and shows the reveal
  - [ ] Five wrong guesses end the game as a loss
  - [ ] All previously revealed clues remain visible as new Days unlock
  - [ ] A reload at Day 3 restores Day 3 with prior guesses intact
  - [ ] Network traffic shows no `stage=4` request while the player is on Day 3
  - [ ] Revisiting after completion shows the result, not a fresh board

  **QA Scenarios**:
  ```
  Scenario: Full win-on-Day-3 playthrough with accumulating clues
    Tool: Playwright
    Preconditions: Dev server with a known published puzzle; localStorage cleared
    Steps:
      1. Navigate to http://localhost:3000; assert Day 1 clue text is visible
      2. Start recording network requests
      3. Click CONTINUE; assert Day 2 clue visible AND Day 1 clue STILL visible
      4. Submit a wrong guess; assert a red WRONG stamp appears with the city name and a band phrase (e.g. "Very far")
      5. Assert Day 3 clue now visible and Days 1-2 still visible
      6. Assert the recorded requests include stage=2 and stage=3 but NOT stage=4 or stage=5
      7. Submit the correct city; assert the FOUND stamp appears and the reveal is shown
      8. Assert the result states "Day 3" and reports 1 wrong guess
      9. Screenshot the accumulated journal and the result
    Expected Result: Clues accumulate, wrong guess leaves a permanent stamp with a band (not exact km), no future stage is ever fetched, result reports Day 3 and 1 wrong guess
    Failure Indicators: Earlier clues disappearing; stage=4 fetched while on Day 3 (forward leak); exact kilometres shown instead of a band
    Evidence: .sisyphus/evidence/task-22-win-day3.png

  Scenario: Mid-game reload and UTC rollover are both handled
    Tool: Playwright
    Preconditions: Dev server; ability to override Date.now via an init script
    Steps:
      1. Play to Day 3 with one wrong guess recorded
      2. Reload the page
      3. Assert the board restores to Day 3, the wrong-guess stamp is still present, and Days 1-3 clues are visible
      4. Assert no stage=4 request occurred during restore
      5. Install an init script shifting Date.now forward past the next UTC midnight; reload
      6. Assert a fresh Day 1 board is presented (stale in-progress board discarded)
      7. Assert the statistics do NOT count the abandoned game as a win
      8. Screenshot the restored state and the post-rollover state
    Expected Result: Reload restores state exactly; crossing UTC midnight presents a fresh puzzle without counting the abandoned game as a win
    Failure Indicators: Reload losing guesses or resetting to Day 1; post-rollover showing yesterday's board; abandoned game counted as won
    Evidence: .sisyphus/evidence/task-22-reload-rollover.png
  ```

  **Evidence to Capture**: `task-22-win-day3.png`, `task-22-reload-rollover.png`

  **Commit**: YES · Message: `feat(game): wire the full playable daily loop` · Files: `src/app/page.tsx`, `src/components/GameBoard.tsx`, `src/components/ClueStack.tsx`, `src/state/useDailyGame.ts` · Pre-commit: `bun test && bun run build`

- [ ] 23. Endgame journal spread + reveal

  **What to do**:
  - The payoff screen. On desktop, a **two-page spread**: left = Task 21's antique map with the true city and dashed arcs to every wrong guess; right = the full reveal.
  - **Mobile (gap G9)**: the spread collapses to a single scrolling column — map first, then reveal. The two-page metaphor must not produce a cramped or horizontally-scrolling layout at 390 px.
  - Reveal contents per §11 and §11's post-game list: a large `FOUND` or `LOST` stamp; the city and country; Day solved; wrong-guess count; elapsed time; all five clues re-presented; the flag as a postage stamp; the **Day 5 translation now revealed**; the population source citation; the Day 4 historical source link; and one short educational fact.
  - On a loss, show the true city and the player's final guess with its distance (per §11's loss format).
  - Include the countdown to the next puzzle (Task 26) and the share action (Task 25).

  **Must NOT do**:
  - Do not keep the two-page spread at mobile widths.
  - Do not animate the route drawing (§22.10 deferred).
  - Do not add social embeds, ads, or a newsletter prompt.
  - Do not reveal the answer anywhere before this screen mounts.

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering` — Reason: the emotional payoff and the most visually ambitious screen; composition quality determines whether the whole aesthetic pays off.
  - **Skills**: none
  - **Skills Evaluated but Omitted**: `frontend-ui-ux` — direction specified.

  **Parallelization**:
  - **Can Run In Parallel**: YES · **Parallel Group**: Wave 4 (with 24–27) · **Blocks**: 27 · **Blocked By**: 21, 22

  **References**:
  - `initial.txt:515-551` — the exact success and failure result formats, plus the authoritative list of permitted post-game content.
  - `initial.txt:537-551` — confirms revealing more information post-game is intended, reinforcing the learning aim.
  - `src/components/map/AntiqueWorldMap.tsx` (21), `src/components/clues/*` (18, 19), `src/components/RubberStamp.tsx` (16).

  **WHY Each Reference Matters**: `initial.txt:515-535` gives the literal result wording; matching it keeps the voice consistent with the clue templates.

  **Acceptance Criteria**:
  - [ ] `bun run build` exits 0
  - [ ] Win state shows city, country, Day solved, wrong-guess count and elapsed time
  - [ ] Loss state shows the true city and the final guess with its distance
  - [ ] The Day 5 translation is present here and only here
  - [ ] Population source and Day 4 source URL are both rendered as links
  - [ ] At 390 px there is no horizontal scroll and the layout is a single column
  - [ ] All five clues are re-presented

  **QA Scenarios**:
  ```
  Scenario: Win reveal is complete and correct on mobile and desktop
    Tool: Playwright
    Preconditions: A completed winning game state seeded in localStorage
    Steps:
      1. Navigate at 1280x800; assert a two-column layout (map and reveal side by side via boundingBox x-offsets)
      2. Assert innerText contains the city name, the country, "Day 3", the wrong-guess count, and an elapsed time in mm:ss form
      3. Assert the Day 5 English translation is now present in innerText
      4. Assert anchor elements exist for both the population source and the historical source
      5. Assert all five clue texts are present
      6. Resize to 390x844; assert scrollWidth <= 390 and that the map and reveal are stacked (same x-offset, different y)
      7. Screenshot both widths
    Expected Result: Complete reveal with sources and translation; two columns on desktop, single stacked column on mobile with no horizontal scroll
    Failure Indicators: Horizontal scroll at 390px; missing translation or source links; clues not re-presented
    Evidence: .sisyphus/evidence/task-23-win-reveal.png

  Scenario: Loss reveal shows the answer and the final guess distance
    Tool: Playwright
    Preconditions: A completed losing game state seeded with five wrong guesses
    Steps:
      1. Navigate to the game page
      2. Assert a LOST stamp is visible
      3. Assert innerText contains the true city name and country
      4. Assert innerText contains the final guess city and a distance for it
      5. Assert the map shows 5 arcs plus a distinct marker for the true city
      6. Screenshot
    Expected Result: Loss state fully discloses the answer, the final guess and its distance, with all five guesses plotted
    Failure Indicators: True city withheld on a loss; fewer than 5 arcs plotted
    Evidence: .sisyphus/evidence/task-23-loss-reveal.png
  ```

  **Evidence to Capture**: `task-23-win-reveal.png`, `task-23-loss-reveal.png`

  **Commit**: YES · Message: `feat(ui): add endgame journal spread reveal` · Files: `src/components/reveal/JournalSpread.tsx`, `src/components/reveal/ResultSummary.tsx`, `src/components/reveal/CluesRecap.tsx` · Pre-commit: `bun run build`

- [ ] 24. Statistics panel + distribution bars

  **What to do**:
  - Render the stats from Task 12's `computeStats`, styled as a journal endpaper tally: games played, won, win %, current streak, longest streak, **average Day solved** (the hero metric per §10), per-Day solve distribution as hand-drawn tally bars, failed count, average solve time.
  - **Zero state (gap G4)**: with no games played, show `0` for counts and `—` for average Day solved. **Never render `NaN`.**
  - Include the export/import "sealed envelope" journal-transfer control from Task 12.

  **Must NOT do**:
  - Do not render `NaN`, `Infinity` or `undefined` in any cell.
  - Do not add a chart library — tally bars are CSS.
  - Do not add leaderboards, friend comparison, or global percentiles (§14 deferred).
  - Do not recompute stats locally; consume `computeStats`.

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering` — Reason: data presentation that must stay on-aesthetic while remaining precisely legible.
  - **Skills**: none
  - **Skills Evaluated but Omitted**: `test-driven-development` — the maths is tested in Task 12; this is presentation.

  **Parallelization**:
  - **Can Run In Parallel**: YES · **Parallel Group**: Wave 4 (with 23, 25–27) · **Blocks**: 27 · **Blocked By**: 12, 15

  **References**:
  - `initial.txt:586-611` — the required statistics list and the distribution bar shape.
  - `initial.txt:483-512` — confirms "Average Day solved" is the metric users should care about, so it deserves visual primacy.
  - `src/domain/stats.ts` (Task 12) — the only source of these numbers.

  **WHY Each Reference Matters**: §10 explicitly names the hero metric; without that cue an executor will give equal weight to streak and win rate, diluting the game's intended focus.

  **Acceptance Criteria**:
  - [ ] `bun run build` exits 0
  - [ ] With cleared localStorage, the panel renders and `innerText` contains no `NaN`, `Infinity` or `undefined`
  - [ ] Average Day solved renders `—` at zero state
  - [ ] Distribution shows all five Day rows plus a Lost row
  - [ ] Average Day solved is the most visually prominent figure
  - [ ] Export produces a string; importing it restores the same stats

  **QA Scenarios**:
  ```
  Scenario: Zero state is clean and seeded state is accurate
    Tool: Playwright
    Preconditions: Dev server running
    Steps:
      1. Clear localStorage, navigate to the stats panel
      2. Assert innerText does NOT match /NaN|Infinity|undefined/
      3. Assert the average-Day cell renders "—"
      4. Assert played and won both read 0
      5. Seed localStorage with 4 wins (Days 2,3,3,4) and 1 loss, reload
      6. Assert played 5, won 4, win% 80
      7. Assert average Day solved reads 3 (mean of 2,3,3,4)
      8. Assert the Day 3 distribution row is the longest bar
      9. Screenshot both states
    Expected Result: Zero state shows dashes and zeros with no NaN; seeded state computes 80% and an average of 3 with Day 3 as the modal row
    Failure Indicators: NaN anywhere; wrong average (e.g. including the loss in the mean)
    Evidence: .sisyphus/evidence/task-24-stats-states.png

  Scenario: Journal export/import round-trips
    Tool: Playwright
    Preconditions: Seeded stats present
    Steps:
      1. Open the stats panel, trigger export, capture the resulting code string via the DOM or clipboard
      2. Clear localStorage and reload; assert zero state
      3. Trigger import, paste the captured code, submit
      4. Assert the restored panel shows the original played/won/streak values
      5. Screenshot the restored panel
    Expected Result: Exported code fully restores prior statistics after a complete wipe
    Failure Indicators: Import failing silently, or restoring partial data
    Evidence: .sisyphus/evidence/task-24-export-import.png
  ```

  **Evidence to Capture**: `task-24-stats-states.png`, `task-24-export-import.png`

  **Commit**: YES · Message: `feat(ui): add statistics panel` · Files: `src/components/stats/StatsPanel.tsx`, `src/components/stats/DistributionBars.tsx`, `src/components/stats/JournalTransfer.tsx` · Pre-commit: `bun run build`

- [ ] 25. Share string + clipboard triple-fallback

  **What to do**:
  - **TDD the string generator.** `buildShareString(state, stats)` producing, per §12: title with puzzle number, a five-cell visual strip marking the solved Day (e.g. `⬜⬜🟩⬛⬛`), optional time, and streak.
  - **The city and country name must never appear** — unit-test this against all six puzzles, in both win and loss states.
  - A loss must render a distinct strip with no answer disclosure.
  - Clipboard delivery via the verified triple fallback: `navigator.share` (mobile, excluding Firefox) → `navigator.clipboard.writeText` (secure context) → `document.execCommand('copy')`.
  - **iOS Safari constraint**: `clipboard.writeText` must be called **synchronously inside the user-gesture callstack**. The share string is built from in-memory state, so no `await` may be introduced before the clipboard call. If any async step ever becomes necessary, use `navigator.clipboard.write([new ClipboardItem({'text/plain': promise})])`, which Safari accepts with a pending Promise.
  - Show a brief confirmation on success.

  **Must NOT do**:
  - Do not include the city, country, or any clue text in the share output.
  - Do not `await` anything before the clipboard write.
  - Do not generate a share image in v1 (deferred).
  - Do not add social-network share buttons or tracking parameters.

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high` — Reason: small surface but with a hard spoiler-safety guarantee and a well-documented cross-browser trap.
  - **Skills**: [`test-driven-development`]
    - `test-driven-development`: the "no answer leakage" property is exactly what must be pinned by a test first.

  **Parallelization**:
  - **Can Run In Parallel**: YES · **Parallel Group**: Wave 4 (with 23, 24, 26, 27) · **Blocks**: 27 · **Blocked By**: 12, 14, 22

  **References**:
  - `initial.txt:555-583` — the share format, the five-stage visual, and the absolute rule: never show the city name.
  - `https://github.com/the-abe-train/globle/blob/7fe4ae74321c94f049631eb8c9c35982aa809bc6/src/components/Statistics.tsx#L109-L138` — the production triple-fallback chain, including the Firefox exclusion on `canShare`.
  - `https://github.com/markgalassi/worldle/blob/001ec783bd3203b241aeba8e53370a2cae0fe54a/src/components/Share.tsx#L34-L72` — the emoji-grid assembly and title/URL composition pattern.
  - `https://github.com/n8n-io/n8n/pull/28081` — a real fix for the iOS Safari `NotAllowedError` caused by awaiting before the clipboard write.
  - `https://developer.mozilla.org/en-US/docs/Web/API/Clipboard/writeText` — the user-gesture requirement.

  **WHY Each Reference Matters**: The n8n PR is cited because the iOS failure is silent on desktop testing and only reproduces on real Safari — knowing the cause up front avoids shipping a share button that does nothing for iPhone users.

  **Acceptance Criteria**:
  - [ ] Test file committed failing first (verifiable in `git log -p`)
  - [ ] `bun test src/share/shareString.test.ts` → PASS, at least 10 assertions, 0 failures
  - [ ] For all six puzzles, in win and loss states, the output contains neither city nor country name
  - [ ] A Day-3 win produces a strip marking position 3
  - [ ] A loss produces a distinct strip with no answer
  - [ ] Output contains the puzzle number and the streak
  - [ ] No `await` precedes the clipboard call in the handler

  **QA Scenarios**:
  ```
  Scenario: Share output is provably spoiler-free for every puzzle
    Tool: Bash (bun)
    Preconditions: buildShareString implemented; six puzzles available
    Steps:
      1. For each of the six puzzles, construct a winning state (solved Day 3) and a losing state
      2. Call buildShareString for all twelve combinations
      3. For each output, assert it does NOT contain the puzzle's city name, country name, reference city, historical entity, or helpPhrase — compared case-insensitively AND via toSearchKey so diacritics cannot evade the check
      4. Assert each output DOES contain the puzzle number and a five-cell strip
      5. Print all twelve outputs for visual inspection
      6. Exit non-zero on any leak
    Expected Result: Zero leaks across all twelve outputs; each contains a puzzle number and a five-cell strip
    Failure Indicators: Any city, country or clue fragment appearing in a share string — this would spoil the puzzle for every recipient
    Evidence: .sisyphus/evidence/task-25-share-no-spoilers.txt

  Scenario: Clipboard copy succeeds from a real user gesture
    Tool: Playwright
    Preconditions: Completed game state; clipboard permissions granted to the context
    Steps:
      1. Grant clipboard-read and clipboard-write permissions
      2. Navigate to the completed game reveal
      3. Click the share button (a genuine user gesture, not a programmatic call)
      4. Read the clipboard via navigator.clipboard.readText()
      5. Assert the clipboard content matches the expected share string
      6. Assert the clipboard content contains no city name
      7. Assert a confirmation affordance became visible
      8. Screenshot the confirmation
    Expected Result: Clipboard contains the exact spoiler-free share string and a confirmation is shown
    Failure Indicators: Empty clipboard (NotAllowedError from an awaited call before the write); confirmation never appearing
    Evidence: .sisyphus/evidence/task-25-clipboard.png
  ```

  **Evidence to Capture**: `task-25-share-no-spoilers.txt`, `task-25-clipboard.png`

  **Commit**: YES · Message: `feat(share): add spoiler-free share string` · Files: `src/share/shareString.ts`, `src/share/shareString.test.ts`, `src/components/ShareButton.tsx` · Pre-commit: `bun test`

- [ ] 26. Countdown + "explorer is resting" empty state

  **What to do**:
  - Countdown to the next puzzle using Task 5's `nextUtcMidnightMs`, captured once on mount and ticked client-side with `setInterval` against that fixed target — **not** by re-deriving from a hardcoded date string each tick.
  - Render as `HH:MM:SS` in the UI face, framed in the journal voice.
  - **"Explorer is resting" state (gap G1)**: when `/api/daily` returns 404 because no puzzle is published for today, render a designed empty state — the journal closed, a note that the explorer is between journeys — rather than an error or a crash. With only six puzzles this state **will** be reached, so it is a first-class screen, not an edge case.
  - Clear the interval on unmount.

  **Must NOT do**:
  - Do not derive the countdown from local time or a hardcoded string.
  - Do not use modulo over the puzzle pool to avoid the empty state — repeats are forbidden.
  - Do not show a raw error, stack trace, or blank page on 404.
  - Do not leak an interval.

  **Recommended Agent Profile**:
  - **Category**: `quick` — Reason: small, well-specified component plus one empty state.
  - **Skills**: none
  - **Skills Evaluated but Omitted**: `test-driven-development` — the clock maths is already tested in Task 5; this is presentation.

  **Parallelization**:
  - **Can Run In Parallel**: YES · **Parallel Group**: Wave 4 (with 23–25, 27) · **Blocks**: 27 · **Blocked By**: 5, 11

  **References**:
  - `https://github.com/nexu-io/nexu/blob/main/apps/web/src/hooks/use-countdown.ts` — the capture-target-once + `setInterval` + cleanup pattern.
  - `src/domain/dailyClock.ts` (Task 5) — `nextUtcMidnightMs`, `secondsUntilNextUtcMidnight`.
  - `initial.txt:40-60` — the narrative voice the empty state should speak in.

  **WHY Each Reference Matters**: The hook pattern is cited because the naive implementation (recomputing from a date string every tick) drifts and misbehaves across the boundary.

  **Acceptance Criteria**:
  - [ ] `bun run build` exits 0
  - [ ] Countdown renders `HH:MM:SS` and decrements once per second
  - [ ] The 404 path renders the resting state with no console error
  - [ ] `clearInterval` is called on unmount
  - [ ] Countdown value is identical under `TZ=Pacific/Kiritimati` and `TZ=UTC`

  **QA Scenarios**:
  ```
  Scenario: Countdown ticks accurately and is timezone-independent
    Tool: Playwright
    Preconditions: Dev server running
    Steps:
      1. Navigate to a page showing the countdown; capture the displayed value
      2. Wait 3000ms; capture again
      3. Assert the second value is exactly 3 seconds less than the first (allow 1s tolerance for scheduling)
      4. Assert the format matches /^\d{2}:\d{2}:\d{2}$/
      5. Launch a second context with the TZ environment set to Pacific/Kiritimati; capture the value
      6. Assert both contexts agree within 2 seconds
      7. Navigate away and assert no "setInterval" leak warning and no continued updates (check via a mutation observer count)
    Expected Result: Countdown decrements in real time, formats as HH:MM:SS, agrees across timezones, and stops on unmount
    Failure Indicators: Value frozen or jumping; Kiritimati showing a 14-hour-different countdown
    Evidence: .sisyphus/evidence/task-26-countdown.png

  Scenario: No published puzzle renders a designed resting state
    Tool: Playwright + Bash
    Preconditions: Ability to request a date with no puzzle
    Steps:
      1. curl "localhost:3000/api/daily?date=1990-01-01" and assert HTTP 404
      2. Temporarily point the app at a date with no published puzzle (via a test query param or env override)
      3. Navigate to the page
      4. Assert no uncaught console error of level "error"
      5. Assert innerText contains the resting-state copy and NOT the word "Error" or "404"
      6. Assert the countdown is still rendered
      7. Screenshot
    Expected Result: A deliberate, in-voice empty state with a working countdown and no error surfaces
    Failure Indicators: Error overlay, blank page, raw "404" text, or an unhandled promise rejection
    Evidence: .sisyphus/evidence/task-26-resting-state.png
  ```

  **Evidence to Capture**: `task-26-countdown.png`, `task-26-resting-state.png`

  **Commit**: YES · Message: `feat(ui): add countdown and no-puzzle state` · Files: `src/components/Countdown.tsx`, `src/components/RestingState.tsx`, `src/hooks/useCountdown.ts` · Pre-commit: `bun run build`

- [ ] 27. Accessibility, reduced-motion and mobile pass

  **What to do**:
  - Systematic pass across every screen. The aesthetic is deliberately heavy (texture, blend modes, handwriting type) and each of those choices is an accessibility risk that must be verified rather than assumed.
  - **Contrast**: every text/background pair must meet WCAG AA (4.5:1 body, 3:1 large). Paper-and-ink is naturally high-contrast, but `--brass` and muted tones on cream are the likely failures — fix by adjusting tokens, not by abandoning the palette.
  - **Handwriting legibility**: enforce the minimum size token for `--font-journal` on mobile; narration must not fall below it.
  - **Keyboard**: full keyboard operability of the guess input, dropdown, share and stats. Visible focus indicators styled in-aesthetic (an ink underline, not a removed outline).
  - **Screen reader**: clue text in the a11y tree; decorative artefacts (tape, grain, torn edges, stamps' texture) `aria-hidden`; new clue arrivals announced via a polite live region; `lang` on native-script phrases.
  - **Reduced motion**: all stamp/tape animations disabled and decorative SVG filters dropped.
  - **Mobile**: verify 390×844 and 360×640 — no horizontal scroll, no layout shift as clues append, actions in thumb reach, dropdown unobstructed by the keyboard.
  - Run Lighthouse mobile accessibility and reach **≥90**.

  **Must NOT do**:
  - Do not remove focus outlines without an equally visible replacement.
  - Do not fix contrast by flattening the design to plain white-on-black.
  - Do not add an accessibility-overlay widget.
  - Do not disable zoom or set `user-scalable=no`.

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high` — Reason: cross-cutting audit-and-remediate work requiring careful measurement across every screen.
  - **Skills**: none
  - **Skills Evaluated but Omitted**: `test-driven-development` — this is remediation against measured audits, not new logic.

  **Parallelization**:
  - **Can Run In Parallel**: NO — audits the output of all prior UI work
  - **Parallel Group**: Wave 4 (completes last) · **Blocks**: 28, 29 · **Blocked By**: 22, 23, 24, 25, 26

  **References**:
  - `https://www.w3.org/WAI/WCAG22/quickref/` — the AA criteria being verified.
  - `https://www.w3.org/WAI/ARIA/apg/patterns/combobox/` — re-verify the Task 20 implementation against the pattern.
  - `https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion` — expectation that motion is removed.
  - `https://developer.chrome.com/docs/lighthouse/accessibility/scoring` — what the ≥90 gate actually measures.
  - `initial.txt:826-842` — the requirement that a player can scan a clue in a few seconds, which is a legibility constraint as much as a tone one.

  **WHY Each Reference Matters**: The Lighthouse scoring doc matters because the ≥90 target is otherwise an arbitrary number; knowing which audits are weighted tells the executor where to spend effort.

  **Acceptance Criteria**:
  - [ ] Lighthouse mobile accessibility ≥ 90 (report saved to evidence)
  - [ ] Zero axe-core violations of impact `serious` or `critical`
  - [ ] All text/background pairs meet AA (measured, with the computed ratios recorded)
  - [ ] Every interactive element is reachable by Tab with a visible focus indicator
  - [ ] Under `prefers-reduced-motion: reduce`, zero running animations
  - [ ] No horizontal scroll at 390 px or 360 px
  - [ ] Cumulative layout shift when a clue appends is 0
  - [ ] No `user-scalable=no` or `maximum-scale=1` in the viewport meta

  **QA Scenarios**:
  ```
  Scenario: Automated accessibility audit passes on every screen
    Tool: Playwright (+ axe-core injected)
    Preconditions: All screens reachable; seeded states for in-progress, win, loss, resting
    Steps:
      1. For each screen state in [fresh Day 1, mid-game Day 3, win reveal, loss reveal, stats panel, resting state]:
      2. Navigate at 390x844, inject axe-core, run a full scan
      3. Assert zero violations with impact "serious" or "critical"
      4. Record every violation (including minor/moderate) to the evidence file with its rule id and target selector
      5. Run Lighthouse mobile accessibility on the main game page; assert score >= 90 and save the JSON report
      6. Tab through the fresh Day 1 screen, asserting each focused element has a computed outline or box-shadow that is not "none"
    Expected Result: No serious or critical axe violations on any of the six states; Lighthouse accessibility >= 90; every tab stop visibly focused
    Failure Indicators: Any serious/critical violation; Lighthouse below 90; a focus ring removed without replacement
    Evidence: .sisyphus/evidence/task-27-axe-and-lighthouse.json

  Scenario: Mobile layout is stable and reduced motion is honoured everywhere
    Tool: Playwright
    Preconditions: Game playable
    Steps:
      1. At 390x844, record the layout, click CONTINUE to append a clue, and assert the previously-visible elements did not move (compare boundingBox y-offsets before and after; expect zero shift for existing content)
      2. Assert scrollWidth <= 390 at every Day from 1 to 5
      3. Repeat the width check at 360x640
      4. Assert the viewport meta contains neither "user-scalable=no" nor "maximum-scale=1"
      5. Create a reducedMotion "reduce" context; walk every screen and assert no element has a running animation (animationName none or duration 0s)
      6. Assert decorative SVG filters compute to "none" under reduce
      7. Screenshot each Day at 390x844
    Expected Result: Zero layout shift as clues append, no horizontal scroll at either width, zoom permitted, and all motion removed under reduce
    Failure Indicators: Existing clues shifting when a new one appends; horizontal scroll at any Day; animations still running under reduce
    Evidence: .sisyphus/evidence/task-27-mobile-stability.png
  ```

  **Evidence to Capture**: `task-27-axe-and-lighthouse.json`, `task-27-mobile-stability.png`

  **Commit**: YES · Message: `fix(a11y): accessibility, reduced-motion and mobile pass` · Files: various across `src/` · Pre-commit: `bun run build`

- [ ] 28. README + licence attribution + env docs

  **What to do**:
  - Write `README.md`: what the game is, the five-clue ladder, local setup with bun, the data pipeline commands, and how to add a puzzle.
  - **Licence attribution (legally required)**: GeoNames is CC BY 4.0 and **requires attribution** — render "City data © GeoNames.org, licensed under CC BY 4.0" in the app footer, not only in the README. Also credit: Natural Earth / `world-atlas` (public domain / ISC), `flag-icons` (MIT), the population source per puzzle (UN WUP CC BY 4.0 and/or citypopulation.de CC BY 3.0 with the required `Thomas Brinkhoff: City Population` credit), and the fonts (OFL / Apache-2.0).
  - Document `LOST_EXPLORER_DAILY_SECRET`: its purpose, that its absence enables dev mode in non-production, and that production fails with 500 without it.
  - Document which §17 checks are automated by `puzzle-lint` and which remain human responsibilities (Day 4 historical accuracy, Day 5 grammatical naturalness, overall fairness).
  - Record the open questions from §22 that v1 deliberately leaves to playtesting.

  **Must NOT do**:
  - Do not omit the GeoNames in-app attribution — it is a licence condition, not a courtesy.
  - Do not write marketing copy or a roadmap.
  - Do not document features that do not exist.
  - Do not commit any real secret value.

  **Recommended Agent Profile**:
  - **Category**: `writing` — Reason: documentation and licence prose.
  - **Skills**: none
  - **Skills Evaluated but Omitted**: `test-driven-development` — documentation.

  **Parallelization**:
  - **Can Run In Parallel**: YES · **Parallel Group**: Wave 5 (with 29) · **Blocks**: none · **Blocked By**: 27

  **References**:
  - `https://creativecommons.org/licenses/by/4.0/` — the attribution requirement wording.
  - `https://www.geonames.org/` — the required credit form.
  - `https://www.citypopulation.de/` — the exact credit string required (`Thomas Brinkhoff: City Population`).
  - `initial.txt:922-938` — §22's twelve open questions, to be recorded as deliberately deferred.
  - `initial.txt:846-873` — §20's MVP boundary, useful for describing what v1 intentionally excludes.

  **WHY Each Reference Matters**: The CC BY and citypopulation.de pages specify the literal credit strings; paraphrasing them does not satisfy the licences.

  **Acceptance Criteria**:
  - [ ] `README.md` exists covering setup, pipeline commands, and adding a puzzle
  - [ ] The GeoNames attribution string is present in the rendered app footer, verified in the DOM
  - [ ] `flag-icons`, `world-atlas`, font licences and population sources are all credited
  - [ ] `LOST_EXPLORER_DAILY_SECRET` behaviour is documented in all three modes
  - [ ] Non-automatable §17 items are listed explicitly
  - [ ] `git grep -i "LOST_EXPLORER_DAILY_SECRET=" -- ':!.env.example'` finds no real value

  **QA Scenarios**:
  ```
  Scenario: Required attributions appear in the running app, not just the README
    Tool: Playwright
    Preconditions: Dev server running; README written
    Steps:
      1. Navigate to http://localhost:3000
      2. Assert innerText contains "GeoNames" and "CC BY 4.0"
      3. Navigate to the completed-game reveal; assert the population source name and a link to it are present
      4. Assert innerText or the credits section mentions flag-icons and Natural Earth
      5. Screenshot the footer and the credits area
    Expected Result: All licence-required attributions are visible to an actual user of the deployed app
    Failure Indicators: Attribution present only in README — this does not satisfy CC BY 4.0
    Evidence: .sisyphus/evidence/task-28-attribution.png

  Scenario: Documented setup actually works from a clean checkout
    Tool: Bash
    Preconditions: README written
    Steps:
      1. Extract the setup command sequence from README.md
      2. In a clean clone at /tmp, run the documented install command
      3. Run the documented build command; assert exit 0
      4. Run the documented test command; assert exit 0
      5. Run the documented puzzle-lint command; assert exit 0
      6. Assert no step required an undocumented environment variable
    Expected Result: Every documented command succeeds from a clean checkout with no undocumented prerequisites
    Failure Indicators: A build failing for want of an env var the README never mentions
    Evidence: .sisyphus/evidence/task-28-clean-setup.txt
  ```

  **Evidence to Capture**: `task-28-attribution.png`, `task-28-clean-setup.txt`

  **Commit**: YES · Message: `docs: add README with licence attribution` · Files: `README.md`, `src/components/Footer.tsx` · Pre-commit: none

- [ ] 29. Vercel deploy config + production secret hardening

  **What to do**:
  - Add deployment configuration for Vercel. Confirm `output: 'export'` is **absent** — static export would remove the server that the date-gated clue route depends on, silently reintroducing the P6 leak.
  - Verify the `Cache-Control` headers from Task 11 behave correctly behind a CDN: today's clue cached with `s-maxage` until UTC midnight, past dates cached hard.
  - **Production secret guard**: assert that `NODE_ENV=production` without `LOST_EXPLORER_DAILY_SECRET` fails closed (HTTP 500), and never falls through to dev mode. Document the required Vercel environment variable.
  - Add a production build check to CI that fails if `output: 'export'` ever appears or if the answer field is present in a non-dev response.
  - Confirm `public/data/city-pool.json` and `countries-110m.json` are served as static assets with long-lived caching.

  **Must NOT do**:
  - Do not enable static export.
  - Do not commit a real secret.
  - Do not add preview-deployment protection bypass tokens to the repo.
  - Do not add a custom server; route handlers suffice.

  **Recommended Agent Profile**:
  - **Category**: `quick` — Reason: configuration plus two guard assertions.
  - **Skills**: none
  - **Skills Evaluated but Omitted**: `test-driven-development` — configuration verified by assertion scripts.

  **Parallelization**:
  - **Can Run In Parallel**: YES · **Parallel Group**: Wave 5 (with 28) · **Blocks**: none · **Blocked By**: 1, 17, 27

  **References**:
  - `https://nextjs.org/docs/app/api-reference/config/next-config-js/output` — confirms what static export disables, including route handlers.
  - `https://vercel.com/docs/projects/environment-variables` — setting the daily secret in the project.
  - `https://github.com/sainsw/framemoji/blob/c1029cb11008a286ead7fa6c582eabd108edc7b5/src/app/api/daily/route.ts#L1-L98` — the cache-header strategy being verified in a deployed context.
  - `src/app/api/daily/route.ts` (Task 11) — the headers and the secret guard under test.

  **WHY Each Reference Matters**: The `output` doc is re-cited here because enabling static export is a plausible-sounding performance "optimisation" that would silently destroy the game's integrity guarantee.

  **Acceptance Criteria**:
  - [ ] `bun run build` exits 0 in a production configuration
  - [ ] `grep -rn "output.*export" next.config.*` returns no match
  - [ ] With `NODE_ENV=production` and the secret unset, `/api/daily?stage=1` returns 500
  - [ ] With `NODE_ENV=production` and the secret set, it returns 200 and the body contains no answer field
  - [ ] Today's clue response carries `s-maxage`
  - [ ] CI fails if `output: 'export'` is introduced
  - [ ] Required Vercel env vars are documented

  **QA Scenarios**:
  ```
  Scenario: Production build fails closed without a secret and never leaks the answer
    Tool: Bash (curl)
    Preconditions: Production build available
    Steps:
      1. Start the production server with NODE_ENV=production and LOST_EXPLORER_DAILY_SECRET unset
      2. curl -s -o /dev/null -w "%{http_code}" "localhost:3000/api/daily?stage=1"; assert 500
      3. curl the same and assert the body contains no city name and no "answer" key
      4. Restart with the secret set
      5. curl "localhost:3000/api/daily?stage=1"; assert 200
      6. Assert the body does NOT contain an "answer" key (dev mode must not be active in production)
      7. Assert the response Cache-Control header contains "s-maxage"
      8. curl "localhost:3000/api/daily?date=2099-01-01"; assert 400
    Expected Result: Production without a secret fails closed with 500 and zero leakage; with a secret it serves clues, omits the answer, sets s-maxage, and still rejects future dates
    Failure Indicators: 200 with an answer field in production (silent dev-mode fallthrough — the worst possible outcome)
    Evidence: .sisyphus/evidence/task-29-prod-secret-guard.txt

  Scenario: Static export can never be reintroduced unnoticed
    Tool: Bash
    Preconditions: CI guard added
    Steps:
      1. Assert `grep -rn "output.*export" next.config.*` currently returns nothing
      2. Temporarily add `output: 'export'` to next.config
      3. Run the CI guard command; assert it exits non-zero and names the offending config
      4. Additionally assert `bun run build` now fails or emits a route-handler incompatibility error
      5. Revert the config; assert the guard exits 0 and the build succeeds
    Expected Result: The guard catches static export immediately and fails the pipeline; reverting restores a passing state
    Failure Indicators: Guard passing with output: 'export' present, allowing the P6 leak back in silently
    Evidence: .sisyphus/evidence/task-29-export-guard.txt
  ```

  **Evidence to Capture**: `task-29-prod-secret-guard.txt`, `task-29-export-guard.txt`

  **Commit**: YES · Message: `chore: add Vercel config and production secret guard` · Files: `vercel.json`, `next.config.ts`, `.github/workflows/ci.yml`, `.env.example` · Pre-commit: `bun run build`

---

## Final Verification Wave

> 4 review agents run in PARALLEL. ALL must APPROVE. Present consolidated results to the user and get an explicit "okay" before completing.
>
> **Do NOT auto-proceed after verification.** Never mark F1–F4 checked before the user's approval. Rejection or feedback → fix → re-run → present again → wait.

- [ ] F1. **Plan Compliance Audit** — `oracle`
  Read this plan end-to-end. For each "Must Have": verify the implementation exists (read the file, curl the endpoint, run the command). For each "Must NOT Have": search the codebase for the forbidden pattern and reject with `file:line` if found — specifically grep for leaderboard/auth/achievement code, `framer-motion`, `gsap`, `lodash`, `luxon`, `moment`, service-worker registration, and any `types.ts` god-file. Confirm evidence files exist in `.sisyphus/evidence/`. Compare delivered artefacts against the Concrete Deliverables list.
  Output: `Must Have [N/N] | Must NOT Have [N/N] | Tasks [N/N] | VERDICT: APPROVE/REJECT`

- [ ] F2. **Code Quality Review** — `unspecified-high`
  Run `bunx tsc --noEmit`, the linter, and `bun test`. Review every changed file for `as any`, `@ts-ignore`, empty catch blocks, `console.log` left in production paths, commented-out code, and unused imports. Check AI slop: excessive comments, premature abstraction, generic names (`data`, `result`, `item`, `temp`, `handler`). Verify no duplicated day-boundary calculation exists anywhere outside the single daily-clock module.
  Output: `Build [PASS/FAIL] | Lint [PASS/FAIL] | Tests [N pass/N fail] | Files [N clean/N issues] | VERDICT`

- [ ] F3. **Real Manual QA** — `unspecified-high` (+ `playwright` skill)
  Start from a cleared localStorage state. Execute EVERY QA scenario from EVERY task, following the exact steps and capturing evidence. Then test cross-task integration: a full Day-1 win, a full Day-3 win, a full Day-5 loss, a mid-game reload, a mid-game UTC rollover (via clock mocking), and a repeat visit after completion. Test edge cases: empty stats on first play, invalid free-text guess submission, attempting to guess the same city twice under two different alias spellings, and a dateline-crossing wrong guess on the endgame map. Save to `.sisyphus/evidence/final-qa/`.
  Output: `Scenarios [N/N pass] | Integration [N/N] | Edge Cases [N tested] | VERDICT`

- [ ] F4. **Scope Fidelity Check** — `deep`
  For each task: read its "What to do", then read the actual diff (`git log`, `git diff`). Verify 1:1 — everything specified was built, and nothing beyond spec was built. Check every "Must NOT do" for compliance. Detect cross-task contamination (Task N touching Task M's files). Flag any file change not accounted for by a task. Specifically confirm no §14/§22 deferred features leaked in.
  Output: `Tasks [N/N compliant] | Contamination [CLEAN/N issues] | Unaccounted [CLEAN/N files] | VERDICT`

---

## Commit Strategy

| Task | Message | Pre-commit |
|---|---|---|
| 1 | `chore: scaffold Next.js app with bun and tailwind` | `bun run build` |
| 2 | `feat(ui): add journal design tokens and font system` | `bun run build` |
| 3 | `feat(domain): add puzzle and game zod schemas` | `bun test` |
| 4 | `feat(geo): add haversine distance and bands` | `bun test` |
| 5 | `feat(daily): add UTC epoch clock and puzzle index` | `bun test` |
| 6 | `feat(search): add text normalization and fold map` | `bun test` |
| 7 | `feat(clues): add population and distance formatting` | `bun test` |
| 8 | `feat(data): add GeoNames city pool pipeline` | `bun test` |
| 9 | `feat(content): add six curated puzzles` | `bun run puzzle-lint` |
| 10 | `feat(content): add flag colour data and swatch assets` | `bun run build` |
| 11 | `feat(api): add date-gated daily clue route` | `bun test` |
| 12 | `feat(state): add versioned persistence and stats` | `bun test` |
| 13 | `feat(search): add city autocomplete engine` | `bun test` |
| 14 | `feat(game): add game state reducer` | `bun test` |
| 15 | `feat(ui): add journal shell layout` | `bun run build` |
| 16 | `feat(ui): add stamp and artefact primitives` | `bun run build` |
| 17 | `feat(tooling): add puzzle-lint quality checks` | `bun run puzzle-lint` |
| 18 | `feat(ui): add Day 1-3 clue artefacts` | `bun run build` |
| 19 | `feat(ui): add Day 4-5 clue artefacts with Noto fallbacks` | `bun run build` |
| 20 | `feat(ui): add guess input with autocomplete` | `bun run build` |
| 21 | `feat(map): add antique world map with great-circle arcs` | `bun run build` |
| 22 | `feat(game): wire the full playable daily loop` | `bun test && bun run build` |
| 23 | `feat(ui): add endgame journal spread reveal` | `bun run build` |
| 24 | `feat(ui): add statistics panel` | `bun run build` |
| 25 | `feat(share): add spoiler-free share string` | `bun test` |
| 26 | `feat(ui): add countdown and no-puzzle state` | `bun run build` |
| 27 | `fix(a11y): accessibility, reduced-motion and mobile pass` | `bun run build` |
| 28 | `docs: add README with licence attribution` | — |
| 29 | `chore: add Vercel config and production secret guard` | `bun run build` |

---

## Success Criteria

### Verification Commands
```bash
bun run build                                  # Expected: exit 0, no TS errors
bun test                                       # Expected: all pass, 0 failures
bun run puzzle-lint                            # Expected: 6/6 puzzles pass
curl -s -o /dev/null -w "%{http_code}" \
  "http://localhost:3000/api/daily?date=2099-01-01"   # Expected: 400
curl -s "http://localhost:3000/api/daily?stage=1" | grep -c "help"  # Expected: 0 (no Day 5 leak)
```

### Final Checklist
- [ ] All "Must Have" items present and verified
- [ ] All "Must NOT Have" items confirmed absent
- [ ] All unit tests pass
- [ ] `puzzle-lint` passes for all 6 puzzles
- [ ] Playwright evidence exists for every task's QA scenarios
- [ ] Day 5 clue proven unreachable before unlock
- [ ] Share string proven spoiler-free by unit test
- [ ] Lighthouse mobile accessibility ≥ 90
- [ ] F1–F4 all APPROVE
- [ ] User has given explicit approval

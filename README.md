# The Lost Explorer

A daily geography deduction game. One mystery city, one for everyone, reset
at 00:00 UTC. Five clue "Days" reveal it gradually, in a fixed order:

1. **Physical geography** — landscape and metro population.
2. **Relative geography** — distance and direction-free band to a globally
   famous reference city, always ≥800 km away.
3. **National identity** — the full set of colours on the national flag,
   with no layout, rendered as a torn cloth swatch.
4. **Historical geography** — what political entity the city belonged to on
   an old map, with a source.
5. **Language** — a short help phrase in the local language.

One guess per Day, five Days maximum. Days 1–4 offer GUESS or CONTINUE; Day
5 is FINAL GUESS only, no CONTINUE. Wrong guesses are recorded as distance
bands (`<250 km`, `<750 km`, `<2000 km`, `≥2000 km`), not exact figures.
Streak and statistics are derived from `localStorage`. The share result is
spoiler-free emoji text — no city or country name.

## What this is not

v1 deliberately has no leaderboards, no accounts, no achievements, no audio
pronunciation, no difficulty modes, no missed-puzzle archive, no animated
route-drawing, no admin CMS, no dark mode, and no generated share image. See
`initial.txt` §20 for the full MVP boundary this repo follows.

## Setup

Requires [bun](https://bun.sh).

```bash
bun install
bun run dev      # http://localhost:3000
```

```bash
bun run build    # next build, exits 0 with no TypeScript errors
bun run start    # serve the production build
```

```bash
bun test              # bun's built-in runner — all pure-logic unit tests
bun run typecheck     # tsc --noEmit
bun run lint          # next lint
```

No environment variable is required for any of the commands above. The city
guess pool (`public/data/city-pool.json`) and the world border topology
(`public/data/countries-110m.json`) are committed to the repo, so a fresh
clone works without first running the GeoNames pipeline.

## The data pipeline

```bash
bun run build-city-pool   # scripts/build-city-pool.ts
```

Downloads GeoNames' `cities15000.zip`, `alternateNamesV2.zip` (~785 MB
uncompressed, stream-filtered line by line, never loaded whole) and
`countryInfo.txt` into `geonames-raw/` (gitignored, cached across runs), then
writes the trimmed ~25k-city guess pool to `public/data/city-pool.json`. Run
this only when the guess pool itself needs regenerating — normal setup,
builds, and tests do not need it, since the output is already committed.

```bash
bun run puzzle-lint       # scripts/puzzle-lint.ts
```

Validates every file in `content/puzzles/*.json` against the schema and 15
mechanical rules (below). Exits non-zero, naming the offending puzzle and
rule, on any failure.

## Adding a puzzle

1. Pick a city and find its GeoNames `geonameid` at
   [geonames.org](https://www.geonames.org/).
2. Copy an existing file in `content/puzzles/` (e.g. `tbilisi.json`) as a
   template — it has all five Day fields plus provenance.
3. Fill in `day1`–`day5` per `src/domain/puzzle.ts`. In particular:
   - `day1.populationSource` needs a real `name`, `url`, and `asOfYear`
     (metro population, not GeoNames' city-proper figure).
   - `day2.referenceCityCoordinates` must be the reference city's real
     coordinates — `puzzle-lint` checks the stated `distanceKm` against
     haversine, and requires `distanceKm >= 800` with
     `recognisability: "global"`.
   - `day3.flagColours` is the full colour set on the flag, checked against
     the per-country allowlist in `src/domain/flagColours.ts`.
   - `day4.historicalSourceUrl` is required — no script can fact-check a
     historical claim, so the citation is mandatory and the claim itself
     needs human review (see §17 below).
   - `day5.helpPhrase` must not contain the city or country name.
4. Set `publishDate` to an unused `YYYY-MM-DD` — every puzzle needs a unique
   date, and the live puzzle window is explicit calendar dates, not a
   `index % N` rotation (so there's no repeat-on-day-7 bug).
5. Run `bun run puzzle-lint`. Fix anything it reports.
6. Run `bun run build-city-pool` first if the city isn't already in the pool
   (new cities under the population floor, or a capital not yet covered).

### Known caveat: the puzzle window ends 2026-10-07

The six puzzles currently in `content/puzzles/` cover `2026-10-02` through
`2026-10-07`. Past that date the app shows a designed "the explorer is
resting" empty state rather than a 404 or a repeated puzzle — there is no
modulo wraparound. To extend the window, add more dated puzzle files per the
steps above; the app picks them up automatically once their `publishDate`
arrives.

## Environment variables

`.env.example` documents the one variable this app reads:

| Variable | Purpose | Dev / no secret set | Production, no secret | Production, secret set |
|---|---|---|---|---|
| `LOST_EXPLORER_DAILY_SECRET` | HMAC key the daily route uses to select which puzzle a date maps to, so the selection can't be predicted or tampered with from outside | Dev mode: the route signs with a fixed fallback key and includes an extra `answer` field in the response, for local development convenience | The route refuses to serve, returning **HTTP 500** — it will never silently fall through to dev mode and leak an answer | The route serves clues normally; the `answer` field is absent |

Set it in `.env.local` for anything beyond quick local dev, and in your
deployment platform's environment variable settings for production.

A second, narrower variable — `LOST_EXPLORER_TODAY_OVERRIDE` — lets
non-production environments pin "today" to a fixed date for QA (e.g.
exercising the resting state without waiting for the real calendar). It is
read-only outside production and has no effect at all when
`NODE_ENV=production`, so the live clock can never be faked in prod. Neither
variable is required for `bun install`, `bun run build`, `bun test`, or
`bun run puzzle-lint` to succeed.

## Licence attribution

This is a licence condition, not a courtesy, and the required strings are
rendered in the running app's footer, not only here.

- **City data** — © [GeoNames.org](https://www.geonames.org/), licensed
  under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Credited
  in-app as *"City data © GeoNames.org, licensed under CC BY 4.0"*
  (`src/components/Footer.tsx`).
- **Country border topology** — [Natural Earth](https://www.naturalearthdata.com/)
  (public domain) via [`world-atlas`](https://github.com/topojson/world-atlas)
  (ISC).
- **Flag artwork** — [`flag-icons`](https://github.com/lipis/flag-icons)
  (MIT).
- **Per-puzzle population figures** — cited individually on each puzzle's
  reveal screen next to the number they back, since the source varies by
  city. Sources used across the current puzzle set are
  [UN World Urbanization Prospects](https://population.un.org/wup/)
  (CC BY 4.0) and [citypopulation.de](https://www.citypopulation.de/)
  (CC BY 3.0 — population figures only, coordinates are not redistributed
  from it). citypopulation.de's licence requires the exact credit
  `Thomas Brinkhoff: City Population`, which is the literal `name` field
  used in every puzzle file sourced from it.
- **Typefaces**, all self-hosted at build time via `next/font/google`, never
  fetched from Google at runtime: Rye (OFL), Special Elite (Apache
  License 2.0), Caveat (OFL), Inter (OFL), and the Noto fallback families
  (OFL) used for Day 5 scripts Caveat doesn't cover (Georgian, Japanese,
  Arabic, Devanagari).

## §17 quality checklist: what's automated, what's still human

The design spec's §17 QC checklist (`initial.txt:722-757`) is mostly prose.
`scripts/puzzle-lint.ts` turns 15 of its checkable items into numbered,
mechanically-enforced rules — schema validity, the answer existing in and
being typeable from the guess pool, the Day 2 distance matching haversine
and meeting the ≥800 km "global" ring, flag colours against a per-country
allowlist, the Day 5 phrase not leaking the answer, source URLs being
well-formed, population and map-year sanity bounds, and unique publish
dates. Running `bun run puzzle-lint` enforces all 15; it is wired into CI.

What it explicitly does **not** and cannot check, and remains a human
responsibility before a puzzle ships:

- **Day 4 historical accuracy** — was the city genuinely part of the named
  entity in the stated year, and is the wording politically and
  historically fair? No script can fact-check a historical claim; a
  `historicalSourceUrl` is required so a human reviewer has something to
  check against, but the review itself has to happen.
- **Day 5 grammatical naturalness** — is the phrase actually correct and
  natural in the target language, and if a city has several common
  languages, is the one chosen a fair pick?
- **Overall puzzle fairness** — could several plausible cities still fit
  before Day 5? Does each clue materially narrow the field? Is any single
  clue disproportionately powerful? Is the final answer realistically
  solvable? Judging the shape of a deduction space is a human call, not a
  per-field check.

## Open questions v1 leaves to playtesting

The design spec's §22 (`initial.txt:922-938`) lists twelve questions it
explicitly says should not block the MVP. They're recorded here rather than
answered, because the plan this app shipped against resolved some of them as
starting defaults (bands over exact distances, one guess per Day) while
leaving the rest genuinely open:

1. Exact distance vs. distance bands for wrong guesses.
2. One guess per Day vs. unlimited guesses with a penalty.
3. How scoring should work numerically.
4. Whether completion time should affect score, or only break leaderboard
   ties.
5. Which population dataset is the right one to standardize on.
6. How a multilingual city should pick its Day 5 language.
7. Whether capitals should appear less often than other cities.
8. Whether weekend puzzles should be easier.
9. Whether players should be able to play previously-missed puzzles.
10. Whether the post-game map should show the route between guesses, not
    just their final positions.
11. Whether Day 5 should eventually include optional audio pronunciation.
12. Whether difficulty should be manually assigned or calculated from
    player results.

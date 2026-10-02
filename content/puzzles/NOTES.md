# Puzzle content notes

Six hand-verified puzzles for v1, per Task 9 of the plan. Dates are explicit
consecutive days starting at `EPOCH_UTC` (`2026-06-01`, `src/domain/dailyClock.ts`) —
no modulo wrapping (gap G1).

| # | City | Country | publishDate | Capital? |
|---|---|---|---|---|
| 1 | Tbilisi | Georgia | 2026-06-01 | yes |
| 2 | Barcelona | Spain | 2026-06-02 | **no** |
| 3 | Hanoi | Vietnam | 2026-06-03 | yes |
| 4 | Cusco | Peru | 2026-06-04 | **no** |
| 5 | Reykjavík | Iceland | 2026-06-05 | yes |
| 6 | Sarajevo | Bosnia and Herzegovina | 2026-06-06 | yes |

Per §9, not every answer is a capital — Barcelona and Cusco are the two
non-capital answers in this set.

## Barcelona — Catalan vs Spanish (§18 multilingual-city review)

§18 explicitly names Barcelona as a city requiring manual language review
because both Catalan and Spanish are official and widely spoken.

**Decision: Catalan.**

Rationale:
- The §18 policy is "use the locally dominant language most likely to be
  heard in ordinary street interaction." Catalan is the historic, regionally
  dominant language of Barcelona and Catalonia, used in schools, local
  government, street signage and everyday commerce — not a minority or
  ceremonial language.
- Day 5 is the game's strongest and final clue (§6: "usually makes the
  country or linguistic region highly identifiable"). Spanish is shared by
  ~20 countries and would barely narrow the search at all this late in the
  clue ladder. Catalan is spoken natively only in Catalonia, the Balearic
  Islands, Valencia (as Valencian) and Andorra — a genuinely narrowing,
  high-value clue that still requires combining it with the earlier
  Days (population, distance, flag, history) to land on Barcelona
  specifically rather than another Catalan-speaking area.
- The phrase itself, "Necessites ajuda?", is taken directly from the design
  spec's own worked Catalan example (`initial.txt:330-332`), so it is
  pre-verified as grammatically natural rather than machine-translated.

No part of `helpPhrase` or `helpPhraseTranslation` contains "Barcelona" or
"Spain" (checked case- and diacritic-insensitively).

## Day 5 phrase verification

All six Day 5 phrases were checked against native/learner reference sources
for naturalness (not machine-translated blind):

- **Georgian** (`დახმარება ხომ არ გჭირდება?`) — taken verbatim from the
  design spec's own Georgian worked example (`initial.txt:338-340`).
- **Catalan** (`Necessites ajuda?`) — taken verbatim from the design spec's
  own Catalan worked example (`initial.txt:330-332`).
- **Vietnamese** (`Bạn có cần giúp đỡ không?`) — cross-checked against
  multiple Vietnamese-learner reference pages that all gloss this exact
  sentence as "Do you need any help?" / "Bạn có cần giúp đỡ không?".
- **Icelandic** (`Þarftu hjálp?`) — cross-checked against live Icelandic
  business websites (customer-support pages) using this exact phrase as a
  natural "Do you need help?" heading.
- **Spanish** (`¿Necesitas ayuda?`) — standard, unambiguous second-person
  Spanish phrasing; no regional variant risk at this register.
- **Bosnian** (`Treba li ti pomoć?`) — cross-checked against Bosnian
  phrase/emergency-language references and real usage in Bosnian prose,
  both glossing it as "Do you need help?".

None of the six phrases contains its own city or country name.

## Population sourcing

All six populations are urban-agglomeration/urban-area figures from
**citypopulation.de** (Thomas Brinkhoff: City Population, CC BY 3.0,
attribution: "Thomas Brinkhoff: City Population"). Per the licence,
population figures are used from citypopulation.de but **coordinates are
taken from GeoNames** (`public/data/city-pool.json`), never from
citypopulation.de, since citypopulation.de's terms do not permit coordinate
redistribution.

- Tbilisi, Barcelona, Hanoi: "Major Agglomerations of the World" table
  (reference date 2026-01-01) — all three exceed the table's 1-million
  threshold.
- Cusco, Sarajevo: below the 1-million threshold for that table, so taken
  from the country-specific city/urban-conglomeration pages instead
  (2022-06-30 estimates).
- Reykjavík: "Greater Reykjavik" urban-area page, Stór-Reykjavík urban area
  estimate (2026-01-01).

## Day 4 historical entities

Chosen to be interesting-but-useful per §17/§18, each with a real source and
neutral wording (the actual sentence construction, "this place was part of
[entity] at the time", is applied uniformly by `renderDay4` in
`src/domain/clueText.ts` — only `historicalEntity` and `mapYear` are
authored here):

- Tbilisi, 1900 → the Russian Empire (Tiflis Governorate of the Caucasus
  Viceroyalty). Matches the design spec's own worked example.
- Barcelona, 1812 → the French Empire. Napoleon annexed Catalonia into four
  French departments (Montserrat department's prefecture was Barcelona
  itself) from January 1812 until the French withdrawal in 1814 — a
  genuinely surprising, well-documented fact rather than "Spain", which
  would be uninformative.
- Hanoi, 1900 → French Indochina. Matches the design spec's own worked
  example.
- Cusco, 1700 → the Viceroyalty of Peru. Cusco was under Spanish viceregal
  rule from 1542 until Peruvian independence (1824); 1700 falls safely
  within that span, well before the later Intendancy-era subdivisions.
- Reykjavík, 1900 → the Kingdom of Denmark. Iceland was a Danish dependency
  from 1380 until home rule (1904) and sovereignty (1918); in 1900 it was
  formally part of the Danish state.
- Sarajevo, 1980 → Yugoslavia. Matches the design spec's own worked example
  (Sarajevo hosted the 1984 Winter Olympics as part of the SFR Yugoslavia).

## Day 2 references

All six satisfy decision P3 (distant + globally famous, target ≥800 km,
`recognisability: "global"`). Reference-city coordinates are taken from
`public/data/city-pool.json` (same GeoNames source as the answer cities) so
`puzzle-lint`'s haversine check compares like-for-like coordinate data.
See `.sisyphus/evidence/task-9-distance-accuracy.txt` for the computed vs.
stated distance table.

## Flag colours (decision P2 — full palette, not single colour)

- Georgia (GE): red, white
- Spain (ES): red, yellow
- Vietnam (VN): red, yellow
- Peru (PE): red, white
- Iceland (IS): blue, white, red
- Bosnia and Herzegovina (BA): blue, yellow, white

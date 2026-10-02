// puzzle-lint — executable enforcement of design-spec §17 (the QC checklist)
// and the P3/P8/G2 decisions that extend it. Non-zero exit on any failure.
//
// §17 is a human prose checklist (initial.txt:722-757). Most of its items are
// mechanically checkable and are encoded below as 15 numbered rules — each
// failure names BOTH the offending puzzle and the rule number so the report
// is actionable without re-reading this file.
//
// --- NOT machine-checkable (remain explicit human responsibilities) -------
// These §17/§18 items cannot be verified by a script and are NOT covered by
// any rule below. Passing this lint is NOT evidence these have been done:
//   - Day 4: "was the city genuinely part of the named entity in the stated
//     year?" and "is the historical wording politically/historically
//     accurate?" — no automated source exists to fact-check a historical
//     claim. Rule 10 only asserts a `historicalSourceUrl` citation exists.
//   - Day 5: "is the phrase grammatically natural?" and "if several
//     languages are common, is the selected language fair?" (§18
//     multilingual-city policy) — no automated grammar/fairness check
//     exists. Rules 8–9 only assert the phrase is non-trivial and does not
//     leak the answer.
//   - Overall: "could several plausible cities still fit before Day 5?",
//     "does each clue materially narrow the possibilities?", "is one clue
//     disproportionately powerful?", "is the final answer realistically
//     solvable?" — judging the shape of the deduction space requires human
//     judgement, not a per-field check.
// ---------------------------------------------------------------------------
//
// Usage: bun run puzzle-lint [puzzlesDir] [cityPoolPath]
//   puzzlesDir    defaults to content/puzzles
//   cityPoolPath  defaults to public/data/city-pool.json
// Both paths are resolved relative to the current working directory when
// relative, so a temp fixture dir can be linted without touching real
// content — this is how the seeded-defect QA scenario works.

import { readFileSync, readdirSync } from 'node:fs';
import { dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PuzzleSchema, type Puzzle } from '../src/domain/puzzle';
import { haversineKm } from '../src/domain/geo';
import { toSearchKey } from '../src/domain/normalize';
import { flagColourAllowlist } from '../src/domain/flagColours';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const puzzlesDirArg = process.argv[2];
const cityPoolArg = process.argv[3];

const PUZZLES_DIR = puzzlesDirArg
  ? resolve(process.cwd(), puzzlesDirArg)
  : join(ROOT, 'content', 'puzzles');
const CITY_POOL_PATH = cityPoolArg
  ? resolve(process.cwd(), cityPoolArg)
  : join(ROOT, 'public', 'data', 'city-pool.json');

interface CityPoolEntry {
  id: number;
  name: string;
  country: string;
  cc: string;
  lat: number;
  lng: number;
  keys: string[];
}

interface Failure {
  rule: number;
  label: string;
  message: string;
}

interface PuzzleResult {
  id: string;
  file: string;
  failures: Failure[];
}

const RULE_LABELS: Record<number, string> = {
  1: 'schema validity',
  2: 'geonameId exists in city pool (G2)',
  3: 'answer reachable by typed name',
  4: 'distance accuracy vs haversine',
  5: 'Day 2 reference ring (P3)',
  6: 'reference city is not the answer',
  7: 'flag colours in per-country allowlist',
  8: 'helpPhrase does not leak the answer',
  9: 'helpPhrase non-trivial',
  10: 'historicalSourceUrl well-formed https URL',
  11: 'mapYear in range',
  12: 'populationSource well-formed and recent',
  13: 'metroPopulationMillions positive',
  14: 'publishDate valid and unique',
  15: 'landscape is a valid enum member',
};

function fail(result: PuzzleResult, rule: number, message: string): void {
  result.failures.push({ rule, label: RULE_LABELS[rule] ?? 'unknown rule', message });
}

function wellFormedUrl(value: string): URL | null {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

function isValidCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return false;
  // Date.UTC silently rolls over invalid day-of-month (e.g. 2026-02-30 ->
  // 2026-03-02). Round-tripping through toISOString catches that.
  return date.toISOString().slice(0, 10) === value;
}

function loadCityPool(): CityPoolEntry[] {
  const raw = readFileSync(CITY_POOL_PATH, 'utf-8');
  return JSON.parse(raw) as CityPoolEntry[];
}

function loadPuzzleFiles(): Array<{ file: string; raw: unknown }> {
  return readdirSync(PUZZLES_DIR)
    .filter((f) => extname(f) === '.json')
    .sort()
    .map((file) => ({
      file,
      raw: JSON.parse(readFileSync(join(PUZZLES_DIR, file), 'utf-8')) as unknown,
    }));
}

function lintPuzzle(
  id: string,
  file: string,
  raw: unknown,
  cityPoolById: Map<number, CityPoolEntry>,
  publishDateOwners: Map<string, string[]>,
): PuzzleResult {
  const result: PuzzleResult = { id, file, failures: [] };
  const rawObj = (raw ?? {}) as Record<string, unknown>;

  // Rule 1: schema valid against src/domain/puzzle.ts
  const parsed = PuzzleSchema.safeParse(raw);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`)
      .join('; ');
    fail(result, 1, `schema invalid — ${issues}`);
    // Rule 14's duplicate-date check still runs on whatever raw value exists,
    // so a schema-broken puzzle can't hide a date collision from its peers.
    if (typeof rawObj.publishDate === 'string') {
      const owners = publishDateOwners.get(rawObj.publishDate) ?? [];
      owners.push(id);
      publishDateOwners.set(rawObj.publishDate, owners);
    }
    return result;
  }

  const puzzle: Puzzle = parsed.data;

  // Rule 2: geonameId exists in public/data/city-pool.json (gap G2)
  const poolEntry = cityPoolById.get(puzzle.geonameId);
  if (!poolEntry) {
    fail(
      result,
      2,
      `geonameId ${puzzle.geonameId} not found in city pool (${CITY_POOL_PATH}) — answer would be unwinnable`,
    );
  }

  // Rule 3: at least one pool keys entry equals toSearchKey(city)
  if (poolEntry) {
    const cityKey = toSearchKey(puzzle.city);
    const reachable = poolEntry.keys.some((k) => toSearchKey(k) === cityKey);
    if (!reachable) {
      fail(
        result,
        3,
        `no key of pool entry ${puzzle.geonameId} equals toSearchKey("${puzzle.city}") = "${cityKey}" — answer not typeable`,
      );
    }
  } else {
    fail(result, 3, `cannot verify — no pool entry for geonameId ${puzzle.geonameId} (see rule 2)`);
  }

  // Rule 4: distanceKm within max(5%, 50km) of haversine(coordinates, referenceCityCoordinates)
  const actualKm = haversineKm(
    puzzle.coordinates.lat,
    puzzle.coordinates.lng,
    puzzle.day2.referenceCityCoordinates.lat,
    puzzle.day2.referenceCityCoordinates.lng,
  );
  const tolerance = Math.max(puzzle.day2.distanceKm * 0.05, 50);
  const diff = Math.abs(actualKm - puzzle.day2.distanceKm);
  if (diff > tolerance) {
    fail(
      result,
      4,
      `stated distanceKm=${puzzle.day2.distanceKm} but haversine computes ${actualKm.toFixed(1)}km (diff ${diff.toFixed(1)}km exceeds tolerance ${tolerance.toFixed(1)}km)`,
    );
  }

  // Rule 5: distanceKm >= 800 AND recognisability === 'global' (decision P3)
  if (!(puzzle.day2.distanceKm >= 800 && puzzle.day2.recognisability === 'global')) {
    fail(
      result,
      5,
      `requires distanceKm >= 800 AND recognisability === 'global' (got distanceKm=${puzzle.day2.distanceKm}, recognisability="${puzzle.day2.recognisability}")`,
    );
  }

  // Rule 6: referenceCity is not the answer city
  if (toSearchKey(puzzle.day2.referenceCity) === toSearchKey(puzzle.city)) {
    fail(result, 6, `referenceCity "${puzzle.day2.referenceCity}" matches the answer city "${puzzle.city}"`);
  }

  // Rule 7: every flagColours entry in the per-country allowlist; non-empty
  if (puzzle.day3.flagColours.length === 0) {
    fail(result, 7, `flagColours is empty`);
  } else {
    const allowlist = flagColourAllowlist[puzzle.countryCode];
    if (!allowlist) {
      fail(result, 7, `no flagColours allowlist entry for countryCode "${puzzle.countryCode}"`);
    } else {
      const disallowed = puzzle.day3.flagColours.filter((c) => !allowlist.includes(c));
      if (disallowed.length > 0) {
        fail(
          result,
          7,
          `colour(s) not in allowlist for ${puzzle.countryCode}: ${disallowed.join(', ')} (allowed: ${allowlist.join(', ')})`,
        );
      }
    }
  }

  // Rule 8: helpPhrase does not contain the city or country name (toSearchKey comparison)
  const phraseKey = toSearchKey(puzzle.day5.helpPhrase);
  const cityKey = toSearchKey(puzzle.city);
  const countryKey = toSearchKey(puzzle.country);
  if (cityKey.length > 0 && phraseKey.includes(cityKey)) {
    fail(result, 8, `helpPhrase leaks the city name ("${puzzle.city}")`);
  } else if (countryKey.length > 0 && phraseKey.includes(countryKey)) {
    fail(result, 8, `helpPhrase leaks the country name ("${puzzle.country}")`);
  }

  // Rule 9: helpPhrase non-empty and differs from helpPhraseTranslation
  if (puzzle.day5.helpPhrase.trim().length === 0) {
    fail(result, 9, `helpPhrase is empty`);
  } else if (puzzle.day5.helpPhrase.trim() === puzzle.day5.helpPhraseTranslation.trim()) {
    fail(result, 9, `helpPhrase is identical to helpPhraseTranslation — translation is missing`);
  }

  // Rule 10: historicalSourceUrl present and a well-formed https:// URL
  const sourceUrl = wellFormedUrl(puzzle.day4.historicalSourceUrl);
  if (!sourceUrl || sourceUrl.protocol !== 'https:') {
    fail(result, 10, `historicalSourceUrl "${puzzle.day4.historicalSourceUrl}" is not a well-formed https:// URL`);
  }

  // Rule 11: mapYear between 1500 and the current year
  const currentYear = new Date().getUTCFullYear();
  if (!(puzzle.day4.mapYear >= 1500 && puzzle.day4.mapYear <= currentYear)) {
    fail(result, 11, `mapYear ${puzzle.day4.mapYear} is outside [1500, ${currentYear}]`);
  }

  // Rule 12: populationSource has name, a well-formed URL, asOfYear within last 20 years
  const src = puzzle.day1.populationSource;
  if (src.name.trim().length === 0) {
    fail(result, 12, `populationSource.name is empty`);
  } else if (!wellFormedUrl(src.url)) {
    fail(result, 12, `populationSource.url "${src.url}" is not a well-formed URL`);
  } else if (!(src.asOfYear <= currentYear && currentYear - src.asOfYear <= 20)) {
    fail(
      result,
      12,
      `populationSource.asOfYear ${src.asOfYear} is not within the last 20 years (current year ${currentYear})`,
    );
  }

  // Rule 13: metroPopulationMillions > 0
  if (!(puzzle.day1.metroPopulationMillions > 0)) {
    fail(result, 13, `metroPopulationMillions ${puzzle.day1.metroPopulationMillions} is not > 0`);
  }

  // Rule 14 (part a): publishDate is a valid YYYY-MM-DD calendar date
  if (!isValidCalendarDate(puzzle.publishDate)) {
    fail(result, 14, `publishDate "${puzzle.publishDate}" is not a valid YYYY-MM-DD calendar date`);
  }
  {
    const owners = publishDateOwners.get(puzzle.publishDate) ?? [];
    owners.push(id);
    publishDateOwners.set(puzzle.publishDate, owners);
  }

  // Rule 15: landscape is a valid enum member (introspected from the live
  // schema so the allowed list is never duplicated by hand)
  const landscapeSchema = PuzzleSchema.shape.day1.shape.landscape;
  if (!landscapeSchema.safeParse(puzzle.day1.landscape).success) {
    fail(
      result,
      15,
      `landscape "${puzzle.day1.landscape}" is not a valid enum member (allowed: ${landscapeSchema.options.join(', ')})`,
    );
  }

  return result;
}

function applyDuplicateDateFailures(
  results: PuzzleResult[],
  publishDateOwners: Map<string, string[]>,
): void {
  // Rule 14 (part b): no two puzzles share a publishDate — duplicates make a
  // day ambiguous. Cross-puzzle, so it runs after every puzzle has been
  // individually linted.
  for (const [date, owners] of publishDateOwners) {
    if (owners.length <= 1) continue;
    for (const ownerId of owners) {
      const result = results.find((r) => r.id === ownerId);
      if (!result) continue;
      const others = owners.filter((o) => o !== ownerId);
      fail(result, 14, `publishDate "${date}" is shared with: ${others.join(', ')}`);
    }
  }
}

function printReport(results: PuzzleResult[]): boolean {
  console.log('');
  console.log('puzzle-lint — executable enforcement of spec §17');
  console.log('='.repeat(50));
  console.log('');

  for (const r of results) {
    if (r.failures.length === 0) {
      console.log(`PASS  ${r.id} (${r.file}) — all 15 rules passed`);
    } else {
      console.log(`FAIL  ${r.id} (${r.file}) — ${r.failures.length} rule(s) failed:`);
      for (const f of r.failures) {
        console.log(`        Rule ${f.rule} (${f.label}): ${f.message}`);
      }
    }
  }

  const passCount = results.filter((r) => r.failures.length === 0).length;
  console.log('');
  console.log(`${passCount}/${results.length} puzzles passed`);
  console.log('');

  return passCount === results.length;
}

function main(): void {
  const cityPool = loadCityPool();
  const cityPoolById = new Map(cityPool.map((e) => [e.id, e]));
  const files = loadPuzzleFiles();

  if (files.length === 0) {
    console.error(`No puzzle JSON files found in ${PUZZLES_DIR}`);
    process.exit(1);
  }

  const publishDateOwners = new Map<string, string[]>();
  const results: PuzzleResult[] = files.map(({ file, raw }) => {
    const rawObj = raw as Record<string, unknown>;
    const id = typeof rawObj.id === 'string' ? rawObj.id : file;
    return lintPuzzle(id, file, raw, cityPoolById, publishDateOwners);
  });

  applyDuplicateDateFailures(results, publishDateOwners);

  const ok = printReport(results);
  process.exit(ok ? 0 : 1);
}

main();

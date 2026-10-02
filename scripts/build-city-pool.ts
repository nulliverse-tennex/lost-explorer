// GeoNames city-pool pipeline.
//
// Builds public/data/city-pool.json — the ~25k-city guess pool used by the
// autocomplete (Task 13), the flag-colour join (Task 10) and puzzle-lint
// (Task 17).
//
// Source files (CC BY 4.0, https://creativecommons.org/licenses/by/4.0/):
//   https://download.geonames.org/export/dump/cities15000.zip
//   https://download.geonames.org/export/dump/alternateNamesV2.zip
//   https://download.geonames.org/export/dump/countryInfo.txt
//
// Column order below is taken verbatim from
// https://download.geonames.org/export/dump/readme.txt — both dumps are
// headerless tab-delimited files. Guessing column positions silently produces
// wrong data (e.g. swapped lat/lng), so do not "simplify" these indices.
//
// `alternateNamesV2.txt` is ~785 MB uncompressed. It is read as a LINE
// STREAM via node:readline over a fs.createReadStream, never loaded whole or
// JSON.parsed. Only rows whose geonameid is already in the cities15000 set
// are retained.

import { createInterface } from 'node:readline';
import { createReadStream, statSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { toSearchKey } from '../src/domain/normalize';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const CACHE_DIR = join(ROOT, 'geonames-raw');
const OUT_PATH = join(ROOT, 'public', 'data', 'city-pool.json');

const DUMP_BASE = 'https://download.geonames.org/export/dump';
const CITIES_ZIP_URL = `${DUMP_BASE}/cities15000.zip`;
const ALT_NAMES_ZIP_URL = `${DUMP_BASE}/alternateNamesV2.zip`;
const COUNTRY_INFO_URL = `${DUMP_BASE}/countryInfo.txt`;

const CITIES_TXT = join(CACHE_DIR, 'cities15000.txt');
const ALT_NAMES_TXT = join(CACHE_DIR, 'alternateNamesV2.txt');
const COUNTRY_INFO_TXT = join(CACHE_DIR, 'countryInfo.txt');

export const GEONAMES_ATTRIBUTION =
  'City data © GeoNames.org, licensed under CC BY 4.0';

const MAX_ALIASES_PER_CITY = 8;

// Pseudo-languages in alternateNamesV2 — postal codes, airport codes, link
// URLs and Wikidata IDs. These are not name variants and would pollute
// autocomplete with junk.
const DROPPED_PSEUDO_LANGUAGES = new Set([
  'post',
  'iata',
  'icao',
  'faac',
  'link',
  'wkdt',
  'unlc',
]);

// Exonym languages worth keeping regardless of the city's own country, per
// Task 8's spec (covers the common "a player's browser is in French/German/
// etc and types the exonym" case).
const EXONYM_LANGUAGES = new Set(['de', 'fr', 'es', 'it', 'pt', 'ru']);

interface CityRecord {
  id: number;
  name: string;
  asciiname: string;
  lat: number;
  lng: number;
  cc: string;
}

// cities15000.zip's own readme describes it as "ca 25.000" records, but the
// live dump has grown to ~34k. A population floor brings the pool back to
// the intended ~25k size; national capitals are exempted so every country's
// capital stays guessable even if small (e.g. Nuuk, Funafuti).
const MIN_POPULATION = 25000;
const CAPITAL_FEATURE_CODE = 'PPLC';

interface AliasCandidate {
  name: string;
  isolanguage: string;
  isPreferredName: boolean;
  isShortName: boolean;
  isHistoric: boolean;
  order: number;
}

interface OutputRecord {
  id: number;
  name: string;
  country: string;
  cc: string;
  lat: number;
  lng: number;
  keys: string[];
}

async function ensureCacheDir(): Promise<void> {
  await mkdir(CACHE_DIR, { recursive: true });
}

function fileExistsNonEmpty(path: string): boolean {
  try {
    return statSync(path).size > 0;
  } catch {
    return false;
  }
}

async function downloadAndUnzip(
  zipUrl: string,
  zipFilename: string,
  expectedOutputPath: string,
): Promise<void> {
  if (fileExistsNonEmpty(expectedOutputPath)) {
    console.log(`[cache] ${expectedOutputPath} already present, skipping download`);
    return;
  }

  const zipPath = join(CACHE_DIR, zipFilename);
  console.log(`[download] ${zipUrl}`);
  const res = await fetch(zipUrl);
  if (!res.ok || !res.body) {
    throw new Error(`Failed to download ${zipUrl}: HTTP ${res.status}`);
  }
  await Bun.write(zipPath, res);

  console.log(`[unzip] ${zipPath}`);
  const proc = Bun.spawn(['unzip', '-o', zipPath, '-d', CACHE_DIR]);
  const exitCode = await proc.exited;
  if (exitCode !== 0) {
    throw new Error(`unzip failed for ${zipPath} with exit code ${exitCode}`);
  }
}

async function downloadCountryInfo(): Promise<void> {
  if (fileExistsNonEmpty(COUNTRY_INFO_TXT)) {
    console.log(`[cache] ${COUNTRY_INFO_TXT} already present, skipping download`);
    return;
  }
  console.log(`[download] ${COUNTRY_INFO_URL}`);
  const res = await fetch(COUNTRY_INFO_URL);
  if (!res.ok) {
    throw new Error(`Failed to download ${COUNTRY_INFO_URL}: HTTP ${res.status}`);
  }
  await Bun.write(COUNTRY_INFO_TXT, res);
}

// countryInfo.txt columns (comment lines start with '#'):
// ISO, ISO3, ISO-Numeric, fips, Country, Capital, Area, Population,
// Continent, tld, CurrencyCode, CurrencyName, Phone, Postal Code Format,
// Postal Code Regex, Languages, geonameid, neighbours, EquivalentFipsCode
async function loadCountryInfo(): Promise<{
  displayNameByCc: Map<string, string>;
  nativeLanguagesByCc: Map<string, Set<string>>;
}> {
  const displayNameByCc = new Map<string, string>();
  const nativeLanguagesByCc = new Map<string, Set<string>>();

  const rl = createInterface({
    input: createReadStream(COUNTRY_INFO_TXT, { encoding: 'utf8' }),
    crlfDelay: Infinity,
  });

  for await (const line of rl) {
    if (line.length === 0 || line.startsWith('#')) continue;
    const cols = line.split('\t');
    const iso = cols[0];
    const country = cols[4];
    const languages = cols[15];
    if (!iso || !country) continue;

    displayNameByCc.set(iso, country);

    const langSet = new Set<string>();
    if (languages) {
      for (const entry of languages.split(',')) {
        const primary = entry.split('-')[0]?.trim().toLowerCase();
        if (primary) langSet.add(primary);
      }
    }
    nativeLanguagesByCc.set(iso, langSet);
  }

  return { displayNameByCc, nativeLanguagesByCc };
}

// cities15000.txt (geoname table) columns:
// geonameid, name, asciiname, alternatenames, latitude, longitude,
// feature class, feature code, country code, cc2, admin1 code, admin2 code,
// admin3 code, admin4 code, population, elevation, dem, timezone,
// modification date
async function loadCities(): Promise<Map<number, CityRecord>> {
  const cities = new Map<number, CityRecord>();

  const rl = createInterface({
    input: createReadStream(CITIES_TXT, { encoding: 'utf8' }),
    crlfDelay: Infinity,
  });

  for await (const line of rl) {
    if (line.length === 0) continue;
    const cols = line.split('\t');
    const idStr = cols[0];
    const name = cols[1];
    const asciiname = cols[2];
    const latStr = cols[4];
    const lngStr = cols[5];
    const featureCode = cols[7];
    const cc = cols[8];
    const populationStr = cols[14];
    if (!idStr || !name || !asciiname || !latStr || !lngStr || !cc) continue;

    const id = Number(idStr);
    const lat = Number(latStr);
    const lng = Number(lngStr);
    const population = Number(populationStr ?? '0');
    if (!Number.isFinite(id) || !Number.isFinite(lat) || !Number.isFinite(lng)) {
      continue;
    }
    if (population <= MIN_POPULATION && featureCode !== CAPITAL_FEATURE_CODE) {
      continue;
    }

    cities.set(id, { id, name, asciiname, lat, lng, cc });
  }

  return cities;
}

// alternateNamesV2.txt (alternate names table) columns:
// alternateNameId, geonameid, isolanguage, alternate name, isPreferredName,
// isShortName, isColloquial, isHistoric, from, to
//
// STREAM-FILTERED line by line — this file is ~785 MB uncompressed and must
// never be read whole or JSON.parsed.
async function streamFilterAliases(
  cityIds: ReadonlySet<number>,
  nativeLanguagesByCc: ReadonlyMap<string, Set<string>>,
  ccByCityId: ReadonlyMap<number, string>,
): Promise<Map<number, AliasCandidate[]>> {
  const aliasesByCity = new Map<number, AliasCandidate[]>();
  let order = 0;

  const rl = createInterface({
    input: createReadStream(ALT_NAMES_TXT, { encoding: 'utf8' }),
    crlfDelay: Infinity,
  });

  for await (const line of rl) {
    if (line.length === 0) continue;
    const cols = line.split('\t');
    const geonameidStr = cols[1];
    const isolanguage = cols[2] ?? '';
    const name = cols[3];
    if (!geonameidStr || !name) continue;

    const geonameid = Number(geonameidStr);
    if (!Number.isFinite(geonameid) || !cityIds.has(geonameid)) continue;

    if (DROPPED_PSEUDO_LANGUAGES.has(isolanguage)) continue;

    const isHistoric = cols[7] === '1';
    const cc = ccByCityId.get(geonameid);
    const nativeLangs = cc ? nativeLanguagesByCc.get(cc) : undefined;
    const isKeptLanguage =
      isolanguage === 'en' ||
      EXONYM_LANGUAGES.has(isolanguage) ||
      (nativeLangs?.has(isolanguage) ?? false);

    // Keep isHistoric=1 rows even outside the normal language keep-set —
    // this is what supplies Kiev->Kyiv per GeoNames' own readme example.
    if (!isKeptLanguage && !isHistoric) continue;

    const candidate: AliasCandidate = {
      name,
      isolanguage,
      isPreferredName: cols[4] === '1',
      isShortName: cols[5] === '1',
      isHistoric,
      order: order++,
    };

    const existing = aliasesByCity.get(geonameid);
    if (existing) {
      existing.push(candidate);
    } else {
      aliasesByCity.set(geonameid, [candidate]);
    }
  }

  return aliasesByCity;
}

function rankCandidate(c: AliasCandidate): number {
  if (c.isPreferredName) return 0;
  if (c.isShortName) return 1;
  if (c.isHistoric) return 2;
  return 3;
}

function buildKeysForCity(
  city: CityRecord,
  aliases: AliasCandidate[] | undefined,
): string[] {
  const keys: string[] = [];
  const seen = new Set<string>();

  const addKey = (raw: string): void => {
    const key = toSearchKey(raw);
    if (key.length === 0 || seen.has(key)) return;
    seen.add(key);
    keys.push(key);
  };

  // Primary name and asciiname always included — they are the city's own
  // canonical identity, independent of the alternateNames join.
  addKey(city.name);
  addKey(city.asciiname);

  const sorted = (aliases ?? [])
    .slice()
    .sort((a, b) => rankCandidate(a) - rankCandidate(b) || a.order - b.order);

  for (const candidate of sorted) {
    if (keys.length >= MAX_ALIASES_PER_CITY) break;
    addKey(candidate.name);
  }

  return keys;
}

async function main(): Promise<void> {
  await ensureCacheDir();

  await Promise.all([
    downloadAndUnzip(CITIES_ZIP_URL, 'cities15000.zip', CITIES_TXT),
    downloadAndUnzip(ALT_NAMES_ZIP_URL, 'alternateNamesV2.zip', ALT_NAMES_TXT),
    downloadCountryInfo(),
  ]);

  console.log('[parse] countryInfo.txt');
  const { displayNameByCc, nativeLanguagesByCc } = await loadCountryInfo();

  console.log('[parse] cities15000.txt');
  const cities = await loadCities();
  console.log(`[parse] ${cities.size} cities loaded`);

  const ccByCityId = new Map<number, string>();
  for (const city of cities.values()) ccByCityId.set(city.id, city.cc);

  console.log('[stream] alternateNamesV2.txt (this takes a while, ~785 MB)');
  const aliasesByCity = await streamFilterAliases(
    new Set(cities.keys()),
    nativeLanguagesByCc,
    ccByCityId,
  );
  console.log(`[stream] aliases retained for ${aliasesByCity.size} cities`);

  const records: OutputRecord[] = [];
  for (const city of cities.values()) {
    const keys = buildKeysForCity(city, aliasesByCity.get(city.id));
    if (keys.length === 0) continue;

    records.push({
      id: city.id,
      name: city.name,
      country: displayNameByCc.get(city.cc) ?? city.cc,
      cc: city.cc,
      lat: city.lat,
      lng: city.lng,
      keys,
    });
  }

  const json = JSON.stringify(records);
  await mkdir(dirname(OUT_PATH), { recursive: true });
  await Bun.write(OUT_PATH, json);

  const gzipped = gzipSync(Buffer.from(json));

  console.log(`[done] ${records.length} records written to ${OUT_PATH}`);
  console.log(`[done] minified size: ${(json.length / 1024).toFixed(1)} KB`);
  console.log(`[done] gzipped size: ${(gzipped.length / 1024).toFixed(1)} KB`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

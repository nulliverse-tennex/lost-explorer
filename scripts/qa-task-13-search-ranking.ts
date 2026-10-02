import { toSearchKey } from '@/domain/normalize';
import {
  CITY_POOL_URL,
  isLoaded,
  loadCityIndex,
  search,
  type CitySearchResult,
} from '@/search/cityIndex';

const POOL_FILE = 'public/data/city-pool.json';

const QUERIES = [
  'tbil',
  'tbilisi',
  'barcelona',
  'munich',
  'munchen',
  'münchen',
  'kiev',
  'kyiv',
  'kobenhavn',
  'københavn',
  'reykjavik',
  'cusco',
];

const failures: string[] = [];
const lines: string[] = [];

function out(line = ''): void {
  lines.push(line);
  console.log(line);
}

function check(label: string, passed: boolean, detail: string): void {
  out(`${passed ? 'PASS' : 'FAIL'}  ${label}${detail === '' ? '' : ` — ${detail}`}`);
  if (!passed) {
    failures.push(label);
  }
}

function describe(result: CitySearchResult | undefined): string {
  return result === undefined
    ? '<none>'
    : `${result.name} (${result.cc}) ${result.id}`;
}

function hasExactKey(pool: PoolRecord[], result: CitySearchResult, key: string): boolean {
  const record = pool.find((entry) => entry.id === result.id);
  return record !== undefined && record.keys.includes(key);
}

interface PoolRecord {
  id: number;
  name: string;
  keys: string[];
}

const pool: PoolRecord[] = await Bun.file(POOL_FILE).json();

const server = Bun.serve({
  port: 0,
  fetch(request) {
    const { pathname } = new URL(request.url);
    if (pathname !== CITY_POOL_URL) {
      return new Response('not found', { status: 404 });
    }
    return new Response(Bun.file(POOL_FILE), {
      headers: { 'content-type': 'application/json' },
    });
  },
});

const poolUrl = `http://localhost:${server.port}${CITY_POOL_URL}`;

out('QA Scenario 1: Ranking and alias resolution behave correctly on real data');
out('='.repeat(76));
out();
out(`Date:        ${new Date().toISOString()}`);
out(`Pool file:   ${POOL_FILE} (${pool.length} records)`);
out(`Fetched via: ${poolUrl}`);
out();

check('isLoaded() is false before load', !isLoaded(), 'index absent');
check('search() returns [] before load', search('tbilisi').length === 0, 'no index, no results');
out();

const loadStart = performance.now();
await loadCityIndex(poolUrl);
const loadMs = performance.now() - loadStart;

check('isLoaded() is true after load', isLoaded(), `fetch + index build in ${loadMs.toFixed(0)}ms`);
out();

out('Top 3 results per query');
out('-'.repeat(76));

const topByQuery = new Map<string, CitySearchResult[]>();
let slowestMs = 0;

for (const query of QUERIES) {
  const start = performance.now();
  const results = search(query, 8);
  const elapsed = performance.now() - start;
  slowestMs = Math.max(slowestMs, elapsed);
  topByQuery.set(query, results);

  out(`${query.padEnd(12)} ${elapsed.toFixed(2).padStart(6)}ms`);
  results.slice(0, 3).forEach((result, rank) => {
    out(`  ${rank + 1}. ${describe(result).padEnd(42)} label="${result.label}"`);
  });
  if (results.length === 0) {
    out('  <no results>');
  }
}

out();
out('Assertions');
out('-'.repeat(76));

function rankOne(query: string): CitySearchResult | undefined {
  return topByQuery.get(query)?.[0];
}

const tbilisi = rankOne('tbilisi');
check(
  'Step 3: "tbilisi" returns Tbilisi (GE) at rank 1',
  tbilisi?.name === 'Tbilisi' && tbilisi.cc === 'GE',
  describe(tbilisi),
);

const tbil = rankOne('tbil');
check(
  'Prefix: "tbil" returns Tbilisi at rank 1',
  tbil?.id === tbilisi?.id,
  describe(tbil),
);

function checkSamePair(step: string, a: string, b: string): void {
  const left = rankOne(a);
  const right = rankOne(b);
  check(
    `${step}: "${a}" and "${b}" return the SAME id at rank 1`,
    left !== undefined && right !== undefined && left.id === right.id,
    `${describe(left)} vs ${describe(right)}`,
  );
}

checkSamePair('Step 4', 'munich', 'munchen');
checkSamePair('Step 4', 'munich', 'münchen');
checkSamePair('Step 5', 'kiev', 'kyiv');
checkSamePair('Step 6', 'kobenhavn', 'københavn');

const reykjavik = rankOne('reykjavik');
check(
  'Diacritic primary: "reykjavik" returns Reykjavík (IS) at rank 1',
  reykjavik?.name === 'Reykjavík' && reykjavik.cc === 'IS',
  describe(reykjavik),
);

const cusco = rankOne('cusco');
check(
  'Alias primary: "cusco" returns Cusco (PE) at rank 1',
  cusco?.name === 'Cusco' && cusco.cc === 'PE',
  describe(cusco),
);

const barcelona = rankOne('barcelona');
check(
  'Homonym: "barcelona" returns a Barcelona at rank 1',
  barcelona?.name === 'Barcelona',
  describe(barcelona),
);

const exactQueries = QUERIES.filter((query) => query !== 'tbil');
let orderingViolations = 0;
const orderingDetail: string[] = [];

for (const query of exactQueries) {
  const key = toSearchKey(query);
  const results = topByQuery.get(query) ?? [];
  const exactFlags = results.map((result) => hasExactKey(pool, result, key));

  if (exactFlags[0] !== true) {
    orderingViolations += 1;
    orderingDetail.push(`${query}: rank 1 is not an exact match`);
    continue;
  }
  const lastExact = exactFlags.lastIndexOf(true);
  const firstInexact = exactFlags.indexOf(false);
  if (firstInexact !== -1 && lastExact > firstInexact) {
    orderingViolations += 1;
    orderingDetail.push(`${query}: a prefix/fuzzy match outranks an exact match`);
  }
}

check(
  'Step 7: an exact full-name match always outranks a prefix match of another city',
  orderingViolations === 0,
  orderingViolations === 0
    ? `${exactQueries.length} full-name queries, exact matches contiguous at the top`
    : orderingDetail.join('; '),
);

const parisResults = search('paris', 8);
const parisLabels = parisResults.map((result) => result.label);
check(
  'Every "paris" label carries its country and stays unique',
  parisResults.length > 1 &&
    parisLabels.every((label) => label.includes(', ')) &&
    new Set(parisLabels).size === parisLabels.length,
  parisLabels.join(' | '),
);

const barcelonaLabels = (topByQuery.get('barcelona') ?? [])
  .filter((result) => result.name === 'Barcelona')
  .map((result) => result.label);
check(
  'Same-name cities in different countries get distinct labels',
  barcelonaLabels.length === 2 &&
    barcelonaLabels.includes('Barcelona, Spain') &&
    barcelonaLabels.includes('Barcelona, Venezuela'),
  barcelonaLabels.join(' | '),
);

const everyQueryResults = [...topByQuery.values()].flat();
check(
  'Every returned object carries a numeric id',
  everyQueryResults.length > 0 &&
    everyQueryResults.every(
      (result) => typeof result.id === 'number' && Number.isInteger(result.id),
    ),
  `${everyQueryResults.length} results inspected`,
);

check(
  'Single-character queries return nothing',
  search('t').length === 0 && search('k').length === 0 && search('p').length === 0,
  'MIN_QUERY_LENGTH = 2 enforced',
);

const koResults = search('ko', 8);
const kyivId = 703448;
check(
  'Short junk alias "ko" does not outrank primary-name matches',
  koResults.length > 0 && koResults[0]?.id !== kyivId,
  `rank 1 = ${describe(koResults[0])}; Kyiv alias "ko" demoted to index ${koResults.findIndex(
    (result) => result.id === kyivId,
  )}`,
);

const kyShort = search('ky', 8);
check(
  'Two-character primary-name prefixes still resolve',
  kyShort.length > 0 && kyShort.every((result) => typeof result.id === 'number'),
  kyShort.slice(0, 3).map(describe).join(' | '),
);

check(
  'Typo tolerance falls back to uFuzzy',
  search('tbilissi', 8).some((result) => result.id === tbilisi?.id) &&
    search('barcelna', 8).some((result) => result.name === 'Barcelona'),
  'tbilissi -> Tbilisi, barcelna -> Barcelona',
);

check(
  'limit is respected',
  search('san', 3).length === 3 && search('san', 8).length === 8,
  'limit=3 -> 3 results, limit=8 -> 8 results',
);

out();
out('Performance');
out('-'.repeat(76));
out(`Fetch + index build: ${loadMs.toFixed(0)}ms for ${pool.length} records`);
out(`Slowest query:       ${slowestMs.toFixed(2)}ms`);
out();
out('Result');
out('-'.repeat(76));
out(
  failures.length === 0
    ? 'ALL ASSERTIONS PASSED'
    : `${failures.length} FAILED: ${failures.join(', ')}`,
);

server.stop(true);

await Bun.write('.sisyphus/evidence/task-13-search-ranking.txt', `${lines.join('\n')}\n`);

process.exit(failures.length === 0 ? 0 : 1);

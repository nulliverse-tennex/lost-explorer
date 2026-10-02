import uFuzzy from '@leeoniya/ufuzzy';
import { toSearchKey } from '@/domain/normalize';

export const CITY_POOL_URL = '/data/city-pool.json';

export const MIN_QUERY_LENGTH = 2;

// GeoNames alternateNames contributes stubs like Kyiv's "ko". Matching one must
// never outrank a real primary-name match or two-letter queries return nonsense.
const WEAK_ALIAS_MAX_LENGTH = 3;

const BUCKET_KEY_LENGTH = 2;

const RANK_EXACT_NAME = 0;
const RANK_EXACT_ALIAS = 1;
const RANK_PREFIX_NAME = 2;
const RANK_PREFIX_ALIAS = 3;
const RANK_WEAK_ALIAS = 4;
const RANK_FUZZY = 5;

// uFuzzy's alpha class is a-z, so non-latin aliases can never match there; they
// stay reachable through the exact/prefix buckets, which scan keys directly.
const LATIN_KEY = /^[a-z0-9' ]+$/;

export interface CityRecord {
  readonly id: number;
  readonly name: string;
  readonly country: string;
  readonly cc: string;
  readonly lat: number;
  readonly lng: number;
  readonly keys: readonly string[];
}

export interface CitySearchResult {
  /** GeoNames id. The only identity a consumer may key a guess on. */
  readonly id: number;
  readonly name: string;
  readonly country: string;
  readonly cc: string;
  readonly lat: number;
  readonly lng: number;
  /** Country-qualified so the twelve Springfields stay distinguishable. */
  readonly label: string;
}

interface CityIndex {
  readonly records: readonly CityRecord[];
  readonly buckets: ReadonlyMap<string, readonly number[]>;
  readonly fuzzyHaystack: readonly string[];
  readonly fuzzy: uFuzzy;
}

interface ScoredCity {
  readonly recordIndex: number;
  readonly rank: number;
  readonly matchLength: number;
}

let index: CityIndex | null = null;
let pending: Promise<void> | null = null;

export function isLoaded(): boolean {
  return index !== null;
}

export function loadCityIndex(url: string = CITY_POOL_URL): Promise<void> {
  if (index !== null) {
    return Promise.resolve();
  }
  pending ??= fetchAndBuild(url).finally(() => {
    pending = null;
  });
  return pending;
}

export function search(query: string, limit = 8): CitySearchResult[] {
  if (index === null || limit <= 0) {
    return [];
  }

  const key = toSearchKey(query);
  if (key.length < MIN_QUERY_LENGTH) {
    return [];
  }

  const { records, buckets, fuzzyHaystack, fuzzy } = index;
  const scored: ScoredCity[] = [];
  const seen = new Set<number>();

  for (const recordIndex of buckets.get(key.slice(0, BUCKET_KEY_LENGTH)) ?? []) {
    const record = records[recordIndex];
    if (record === undefined) {
      continue;
    }
    const hit = rankRecord(record, key);
    if (hit !== null) {
      scored.push({ recordIndex, rank: hit.rank, matchLength: hit.matchLength });
      seen.add(recordIndex);
    }
  }

  scored.sort((a, b) => compareScored(a, b, records));

  if (scored.length < limit) {
    for (const recordIndex of fuzzyMatches(fuzzy, fuzzyHaystack, key)) {
      if (seen.has(recordIndex)) {
        continue;
      }
      scored.push({ recordIndex, rank: RANK_FUZZY, matchLength: 0 });
      seen.add(recordIndex);
      if (scored.length >= limit) {
        break;
      }
    }
  }

  const results: CitySearchResult[] = [];
  for (const entry of scored.slice(0, limit)) {
    const record = records[entry.recordIndex];
    if (record !== undefined) {
      results.push(toResult(record));
    }
  }
  return results;
}

function rankRecord(
  record: CityRecord,
  key: string,
): { rank: number; matchLength: number } | null {
  let rank = -1;
  let matchLength = 0;

  for (let position = 0; position < record.keys.length; position += 1) {
    const candidate = record.keys[position];
    if (candidate === undefined) {
      continue;
    }

    const isPrimary = position === 0;
    const isWeak = !isPrimary && candidate.length <= WEAK_ALIAS_MAX_LENGTH;
    let candidateRank: number;

    if (candidate === key) {
      candidateRank = isPrimary
        ? RANK_EXACT_NAME
        : isWeak
          ? RANK_WEAK_ALIAS
          : RANK_EXACT_ALIAS;
    } else if (candidate.startsWith(key)) {
      candidateRank = isPrimary
        ? RANK_PREFIX_NAME
        : isWeak
          ? RANK_WEAK_ALIAS
          : RANK_PREFIX_ALIAS;
    } else {
      continue;
    }

    if (
      rank === -1 ||
      candidateRank < rank ||
      (candidateRank === rank && candidate.length < matchLength)
    ) {
      rank = candidateRank;
      matchLength = candidate.length;
    }
  }

  return rank === -1 ? null : { rank, matchLength };
}

function compareScored(
  a: ScoredCity,
  b: ScoredCity,
  records: readonly CityRecord[],
): number {
  if (a.rank !== b.rank) {
    return a.rank - b.rank;
  }
  if (a.matchLength !== b.matchLength) {
    return a.matchLength - b.matchLength;
  }

  const left = records[a.recordIndex];
  const right = records[b.recordIndex];
  if (left === undefined || right === undefined) {
    return 0;
  }
  // The pool has no population column, so alias breadth proxies prominence:
  // Barcelona (ES) carries six exonyms, Barcelona (VE) carries one.
  if (left.keys.length !== right.keys.length) {
    return right.keys.length - left.keys.length;
  }
  return left.id - right.id;
}

function fuzzyMatches(
  fuzzy: uFuzzy,
  haystack: readonly string[],
  key: string,
): number[] {
  const [haystackIdxs, info, order] = fuzzy.search([...haystack], key);
  if (info !== null && order !== null) {
    const ordered: number[] = [];
    for (const position of order) {
      const recordIndex = info.idx[position];
      if (recordIndex !== undefined) {
        ordered.push(recordIndex);
      }
    }
    return ordered;
  }
  return haystackIdxs ?? [];
}

function toResult(record: CityRecord): CitySearchResult {
  return {
    id: record.id,
    name: record.name,
    country: record.country,
    cc: record.cc,
    lat: record.lat,
    lng: record.lng,
    label: `${record.name}, ${record.country}`,
  };
}

async function fetchAndBuild(url: string): Promise<void> {
  await afterFirstPaint();

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`city pool request failed with ${response.status}`);
  }

  const payload: unknown = await response.json();
  if (!Array.isArray(payload)) {
    throw new Error('city pool payload is not an array');
  }

  const records = payload.filter(isCityRecord);
  if (records.length === 0) {
    throw new Error('city pool payload contained no usable records');
  }

  index = buildIndex(records);
}

// Two frames, not one: the first callback still runs pre-composite, so only the
// second guarantees the 800 KB request is issued after first contentful paint.
function afterFirstPaint(): Promise<void> {
  if (typeof requestAnimationFrame !== 'function') {
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => resolve());
    });
  });
}

function buildIndex(records: readonly CityRecord[]): CityIndex {
  const buckets = new Map<string, number[]>();
  const fuzzyHaystack: string[] = [];

  records.forEach((record, recordIndex) => {
    const bucketed = new Set<string>();
    for (const key of record.keys) {
      if (key.length < BUCKET_KEY_LENGTH) {
        continue;
      }
      const bucketKey = key.slice(0, BUCKET_KEY_LENGTH);
      if (bucketed.has(bucketKey)) {
        continue;
      }
      bucketed.add(bucketKey);

      const bucket = buckets.get(bucketKey);
      if (bucket === undefined) {
        buckets.set(bucketKey, [recordIndex]);
      } else {
        bucket.push(recordIndex);
      }
    }
    fuzzyHaystack.push(record.keys.filter((key) => LATIN_KEY.test(key)).join(' '));
  });

  return {
    records,
    buckets,
    fuzzyHaystack,
    fuzzy: new uFuzzy({
      intraMode: 1,
      intraIns: 1,
      intraSub: 1,
      intraTrn: 1,
      intraDel: 1,
    }),
  };
}

function isCityRecord(value: unknown): value is CityRecord {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const record = value as Record<string, unknown>;
  return (
    typeof record.id === 'number' &&
    typeof record.name === 'string' &&
    typeof record.country === 'string' &&
    typeof record.cc === 'string' &&
    typeof record.lat === 'number' &&
    typeof record.lng === 'number' &&
    Array.isArray(record.keys)
  );
}

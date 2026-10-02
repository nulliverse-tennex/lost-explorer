import { parsePersisted } from '@/domain/persistence';
import { RecordedGameSchema, type GameJournal } from '@/domain/stats';

export const GAMES_KEY = 'lx:games';
export const META_KEY = 'lx:meta';

export const SCHEMA_VERSION = parsePersisted(null)._v;

function jsonOrNull(raw: string | null): unknown {
  if (raw === null) {
    return null;
  }

  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function parseJournal(
  raw: string | null,
  version: number = SCHEMA_VERSION
): GameJournal {
  const payload = jsonOrNull(raw);
  if (!isRecord(payload)) {
    return {};
  }

  const journal: GameJournal = {};

  for (const [dayKey, entry] of Object.entries(payload)) {
    // parsePersisted owns version migration and never throws. Running it one day at a time means
    // a single corrupt entry drops that day instead of wiping the whole streak.
    const migrated = parsePersisted({ _v: version, games: { [dayKey]: entry } });
    const base = migrated.games[dayKey];
    if (base === undefined) {
      continue;
    }

    const withSolveTime = RecordedGameSchema.safeParse(entry);
    journal[dayKey] = withSolveTime.success ? withSolveTime.data : base;
  }

  return journal;
}

export function serializeJournal(journal: GameJournal): string {
  return JSON.stringify(journal);
}

function storedSchemaVersion(): number {
  return parsePersisted(localStorage.getItem(META_KEY))._v;
}

export function readJournal(): GameJournal {
  return parseJournal(localStorage.getItem(GAMES_KEY), storedSchemaVersion());
}

export function writeJournal(journal: GameJournal): void {
  localStorage.setItem(GAMES_KEY, serializeJournal(journal));
  localStorage.setItem(META_KEY, JSON.stringify({ _v: SCHEMA_VERSION }));
}

function encodeBase64(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary);
}

function decodeBase64(code: string): string | null {
  try {
    const bytes = Uint8Array.from(atob(code), (char) => char.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  } catch {
    return null;
  }
}

export function exportJournal(journal: GameJournal = readJournal()): string {
  return encodeBase64(serializeJournal(journal));
}

export function importJournal(code: string): GameJournal {
  return parseJournal(decodeBase64(code));
}

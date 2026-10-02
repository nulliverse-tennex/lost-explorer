import { z } from 'zod';
import { DailyGameStateSchema, DailyGameState } from './game';

// Version 1: Initial schema
const PersistenceV1Schema = z.object({
  _v: z.literal(1),
  streak: z.number().int().nonnegative().default(0),
  games: z.record(z.string(), DailyGameStateSchema).default({}),
});

type PersistenceV1 = z.infer<typeof PersistenceV1Schema>;

// Current version (v1)
const CurrentPersistenceSchema = PersistenceV1Schema;
export type PersistedState = z.infer<typeof CurrentPersistenceSchema>;

// Discriminated union for versioning
const VersionedPersistenceSchema = z.discriminatedUnion('_v', [
  PersistenceV1Schema,
]);

// Migration function: transforms older versions to current
function migrateToLatest(data: unknown): PersistedState {
  if (typeof data !== 'object' || data === null) {
    return getDefaultState();
  }

  const obj = data as Record<string, unknown>;
  const version = obj._v;

  // If no version or unknown version, return default
  if (version === undefined || typeof version !== 'number') {
    return getDefaultState();
  }

  // Version 1 is current; no migration needed
  if (version === 1) {
    const result = PersistenceV1Schema.safeParse(data);
    if (result.success) {
      return result.data;
    }
    return getDefaultState();
  }

  // Unknown future version: return default
  return getDefaultState();
}

function getDefaultState(): PersistedState {
  return {
    _v: 1,
    streak: 0,
    games: {},
  };
}

export function parsePersisted(raw: unknown): PersistedState {
  // Never throw; always return a valid state
  try {
    if (typeof raw === 'string') {
      const parsed = JSON.parse(raw);
      return migrateToLatest(parsed);
    }
    return migrateToLatest(raw);
  } catch {
    // JSON parse error or any other exception: return default
    return getDefaultState();
  }
}

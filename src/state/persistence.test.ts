import { describe, it, expect, beforeEach } from 'bun:test';
import { RecordedGameSchema, type GameJournal, type RecordedGame } from '@/domain/stats';
import {
  GAMES_KEY,
  META_KEY,
  SCHEMA_VERSION,
  exportJournal,
  importJournal,
  parseJournal,
  readJournal,
  writeJournal,
} from './persistence';

class MemoryStorage {
  private readonly entries = new Map<string, string>();

  get length(): number {
    return this.entries.size;
  }

  clear(): void {
    this.entries.clear();
  }

  getItem(key: string): string | null {
    return this.entries.get(key) ?? null;
  }

  key(index: number): string | null {
    return [...this.entries.keys()][index] ?? null;
  }

  removeItem(key: string): void {
    this.entries.delete(key);
  }

  setItem(key: string, value: string): void {
    this.entries.set(key, String(value));
  }
}

Object.defineProperty(globalThis, 'localStorage', {
  value: new MemoryStorage(),
  configurable: true,
  writable: true,
});

function gameOn(dayKey: string, displayName = 'Tbilisi'): RecordedGame {
  const startedAtMs = Date.parse(`${dayKey}T09:00:00.000Z`);

  return RecordedGameSchema.parse({
    dayKey,
    currentDay: 3,
    guesses: {
      '611717': {
        geonameId: 611717,
        displayName,
        country: 'Georgia',
        distanceKm: 0,
        band: 'very-close',
        dayGuessed: 3,
      },
    },
    status: 'won',
    startedAtMs,
    resolvedAtMs: startedAtMs + 240_000,
  });
}

function journalOf(...games: RecordedGame[]): GameJournal {
  return Object.fromEntries(games.map((game) => [game.dayKey, game]));
}

beforeEach(() => {
  localStorage.clear();
});

describe('parseJournal', () => {
  it('returns an empty journal for missing storage', () => {
    expect(parseJournal(null)).toEqual({});
  });

  it('returns an empty journal for the literal corruption string, without throwing', () => {
    expect(() => parseJournal('{{{broken')).not.toThrow();
    expect(parseJournal('{{{broken')).toEqual({});
  });

  it('returns an empty journal when the payload is a JSON array rather than a record', () => {
    expect(parseJournal('[1,2,3]')).toEqual({});
  });

  it('keeps the valid entries and drops only the unparseable ones', () => {
    const payload = JSON.stringify({
      '2026-06-01': gameOn('2026-06-01'),
      '2026-06-02': { dayKey: '2026-06-02', currentDay: 99 },
    });

    const journal = parseJournal(payload);

    expect(Object.keys(journal)).toEqual(['2026-06-01']);
  });

  it('preserves the solve timestamp the stats fold needs', () => {
    const game = gameOn('2026-06-01');
    const journal = parseJournal(JSON.stringify(journalOf(game)));

    expect(journal['2026-06-01']?.resolvedAtMs).toBe(game.resolvedAtMs);
  });
});

describe('readJournal and writeJournal', () => {
  it('returns an empty journal when nothing has ever been written', () => {
    expect(readJournal()).toEqual({});
  });

  it('round-trips a written journal', () => {
    const journal = journalOf(gameOn('2026-06-01'), gameOn('2026-06-02'));
    writeJournal(journal);

    expect(readJournal()).toEqual(journal);
  });

  it('stores the games under the lx:games key', () => {
    writeJournal(journalOf(gameOn('2026-06-01')));

    expect(GAMES_KEY).toBe('lx:games');
    expect(localStorage.getItem(GAMES_KEY)).toContain('2026-06-01');
  });

  it('stores the schema version, and nothing derived, under the lx:meta key', () => {
    writeJournal(journalOf(gameOn('2026-06-01')));

    expect(META_KEY).toBe('lx:meta');
    expect(JSON.parse(localStorage.getItem(META_KEY) ?? 'null')).toEqual({
      _v: SCHEMA_VERSION,
    });
  });

  it('never writes a streak or any other derived statistic to storage', () => {
    writeJournal(journalOf(gameOn('2026-06-01')));

    const everythingStored = [
      localStorage.getItem(GAMES_KEY),
      localStorage.getItem(META_KEY),
    ].join('');

    expect(everythingStored).not.toContain('streak');
    expect(everythingStored).not.toContain('winPercent');
    expect(everythingStored).not.toContain('played');
  });

  it('survives a corrupt games payload and degrades to the zero state', () => {
    localStorage.setItem(GAMES_KEY, '{{{broken');
    localStorage.setItem(META_KEY, JSON.stringify({ _v: SCHEMA_VERSION }));

    expect(() => readJournal()).not.toThrow();
    expect(readJournal()).toEqual({});
  });

  it('survives corrupt meta and degrades to the zero state', () => {
    writeJournal(journalOf(gameOn('2026-06-01')));
    localStorage.setItem(META_KEY, 'not json at all');

    expect(() => readJournal()).not.toThrow();
    expect(readJournal()).toEqual({});
  });

  it('discards a journal written by an unreadable future schema version', () => {
    writeJournal(journalOf(gameOn('2026-06-01')));
    localStorage.setItem(META_KEY, JSON.stringify({ _v: 999 }));

    expect(readJournal()).toEqual({});
  });

  it('retains older days when a newer day is added', () => {
    writeJournal(journalOf(gameOn('2026-06-01')));
    const grown = { ...readJournal(), ...journalOf(gameOn('2026-06-02')) };
    writeJournal(grown);

    expect(Object.keys(readJournal()).sort()).toEqual(['2026-06-01', '2026-06-02']);
  });
});

describe('exportJournal and importJournal', () => {
  it('round-trips the stored journal through the no-argument form', () => {
    const journal = journalOf(gameOn('2026-06-01'), gameOn('2026-06-02'));
    writeJournal(journal);

    expect(importJournal(exportJournal())).toEqual(journal);
  });

  it('round-trips a journal passed explicitly', () => {
    const journal = journalOf(gameOn('2026-06-01'));

    expect(importJournal(exportJournal(journal))).toEqual(journal);
  });

  it('emits base64 characters only', () => {
    expect(exportJournal(journalOf(gameOn('2026-06-01')))).toMatch(
      /^[A-Za-z0-9+/]+={0,2}$/
    );
  });

  it('survives non-ASCII city names that plain btoa would reject', () => {
    const journal = journalOf(gameOn('2026-06-01', 'თბილისი — København'));

    expect(importJournal(exportJournal(journal))).toEqual(journal);
  });

  it('returns an empty journal for a code that is not base64', () => {
    expect(() => importJournal('not base64 !!')).not.toThrow();
    expect(importJournal('not base64 !!')).toEqual({});
  });

  it('returns an empty journal for base64 that does not decode to a journal', () => {
    expect(importJournal(exportJournalRaw('{{{broken'))).toEqual({});
  });

  it('returns an empty journal for an empty code', () => {
    expect(importJournal('')).toEqual({});
  });
});

function exportJournalRaw(text: string): string {
  const bytes = new TextEncoder().encode(text);
  return btoa(String.fromCharCode(...bytes));
}

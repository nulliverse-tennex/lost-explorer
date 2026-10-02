import { describe, expect, it } from 'bun:test';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { daysSinceEpoch } from '../domain/dailyClock';
import { toSearchKey } from '../domain/normalize';
import { PuzzleSchema, type Puzzle } from '../domain/puzzle';
import { computeStats, RecordedGameSchema, type RecordedGame, type Stats } from '../domain/stats';
import { buildShareString, isResolvedGame, type ResolvedGame } from './shareString';

const PUZZLE_DIR = join(import.meta.dir, '../../content/puzzles');

function loadPuzzles(): Puzzle[] {
  return readdirSync(PUZZLE_DIR)
    .filter((name) => name.endsWith('.json'))
    .map((name) => PuzzleSchema.parse(JSON.parse(readFileSync(join(PUZZLE_DIR, name), 'utf8'))))
    .sort((a, b) => a.publishDate.localeCompare(b.publishDate));
}

function guessEntry(geonameId: number, distanceKm: number, dayGuessed: number) {
  return {
    geonameId,
    displayName: `Decoy ${geonameId}`,
    country: 'Decoyland',
    distanceKm,
    band: distanceKm === 0 ? 'very-close' : 'far',
    dayGuessed,
  };
}

function resolved(game: RecordedGame): ResolvedGame {
  if (!isResolvedGame(game)) {
    throw new Error(`fixture is not resolved: ${game.dayKey}`);
  }
  return game;
}

function wonOn(dayKey: string, solveDay: number, solveTimeMs: number | null = 78_000): ResolvedGame {
  const startedAtMs = solveTimeMs === null ? 0 : Date.parse(`${dayKey}T09:00:00.000Z`);
  const guesses: Record<string, unknown> = {};
  for (let day = 1; day < solveDay; day += 1) {
    guesses[String(1000 + day)] = guessEntry(1000 + day, 400 * day, day);
  }
  guesses['9999'] = guessEntry(9999, 0, solveDay);

  return resolved(
    RecordedGameSchema.parse({
      dayKey,
      currentDay: solveDay,
      guesses,
      status: 'won',
      startedAtMs,
      ...(solveTimeMs === null ? {} : { resolvedAtMs: startedAtMs + solveTimeMs }),
    }),
  );
}

function lostOn(dayKey: string, solveTimeMs: number | null = 260_000): ResolvedGame {
  const startedAtMs = solveTimeMs === null ? 0 : Date.parse(`${dayKey}T09:00:00.000Z`);
  const guesses: Record<string, unknown> = {};
  for (let day = 1; day <= 5; day += 1) {
    guesses[String(2000 + day)] = guessEntry(2000 + day, 900 * day, day);
  }

  return resolved(
    RecordedGameSchema.parse({
      dayKey,
      currentDay: 5,
      guesses,
      status: 'lost',
      startedAtMs,
      ...(solveTimeMs === null ? {} : { resolvedAtMs: startedAtMs + solveTimeMs }),
    }),
  );
}

function abandonedOn(dayKey: string, stoppedOnDay: number): ResolvedGame {
  const guesses: Record<string, unknown> = {};
  for (let day = 1; day < stoppedOnDay; day += 1) {
    guesses[String(3000 + day)] = guessEntry(3000 + day, 700 * day, day);
  }

  return resolved(
    RecordedGameSchema.parse({
      dayKey,
      currentDay: stoppedOnDay,
      guesses,
      status: 'lost',
      startedAtMs: 0,
    }),
  );
}

function statsFor(...games: RecordedGame[]): Stats {
  const journal: Record<string, RecordedGame> = {};
  for (const game of games) {
    journal[game.dayKey] = game;
  }
  return computeStats(journal);
}

function puzzleNumberFor(dayKey: string): number {
  return daysSinceEpoch(Date.parse(`${dayKey}T00:00:00.000Z`)) + 1;
}

function stripOf(share: string): string {
  const line = share.split('\n').find((candidate) => /[\u2b1b\u2b1c\u{1f7e9}\u{1f7e5}]/u.test(candidate));
  return line ?? '';
}

const EMPTY_STATS = computeStats({});

describe('buildShareString — visual strip', () => {
  it('marks a Day-3 win at position 3 of five cells', () => {
    const share = buildShareString(wonOn('2026-10-04', 3), EMPTY_STATS);
    expect(stripOf(share)).toBe('⬜⬜🟩⬛⬛');
  });

  it('marks a Day-1 win at position 1', () => {
    expect(stripOf(buildShareString(wonOn('2026-10-04', 1), EMPTY_STATS))).toBe('🟩⬛⬛⬛⬛');
  });

  it('marks a Day-5 win at position 5', () => {
    expect(stripOf(buildShareString(wonOn('2026-10-04', 5), EMPTY_STATS))).toBe('⬜⬜⬜⬜🟩');
  });

  it('always emits exactly five cells', () => {
    for (const day of [1, 2, 3, 4, 5]) {
      expect([...stripOf(buildShareString(wonOn('2026-10-04', day), EMPTY_STATS))]).toHaveLength(5);
    }
    expect([...stripOf(buildShareString(lostOn('2026-10-04'), EMPTY_STATS))]).toHaveLength(5);
  });

  it('renders a loss as a distinct strip that no win can produce', () => {
    const loss = stripOf(buildShareString(lostOn('2026-10-04'), EMPTY_STATS));
    expect(loss).toBe('⬜⬜⬜⬜🟥');
    expect(loss).not.toContain('🟩');

    const wins = [1, 2, 3, 4, 5].map((day) =>
      stripOf(buildShareString(wonOn('2026-10-04', day), EMPTY_STATS)),
    );
    expect(wins).not.toContain(loss);
    for (const win of wins) {
      expect(win).toContain('🟩');
      expect(win).not.toContain('🟥');
    }
  });

  it('marks the day the trail went cold when a game is lost before Day 5', () => {
    expect(stripOf(buildShareString(abandonedOn('2026-10-04', 2), EMPTY_STATS))).toBe('⬜🟥⬛⬛⬛');
  });
});

describe('buildShareString — required content', () => {
  it('contains the puzzle number derived from the day key', () => {
    const share = buildShareString(wonOn('2026-10-02', 3), EMPTY_STATS);
    expect(share).toContain(`#${puzzleNumberFor('2026-10-02')}`);
  });

  it('gives consecutive day keys consecutive puzzle numbers', () => {
    const first = buildShareString(wonOn('2026-10-02', 3), EMPTY_STATS);
    const second = buildShareString(wonOn('2026-10-03', 3), EMPTY_STATS);
    expect(first).toContain(`#${puzzleNumberFor('2026-10-02')}`);
    expect(second).toContain(`#${puzzleNumberFor('2026-10-02') + 1}`);
  });

  it('contains the current streak', () => {
    const games = [
      wonOn('2026-10-02', 2),
      wonOn('2026-10-03', 3),
      wonOn('2026-10-04', 1),
    ];
    const stats = statsFor(...games);
    expect(stats.currentStreak).toBe(3);
    expect(buildShareString(games[2]!, stats)).toContain('3');
    expect(buildShareString(games[2]!, stats)).toMatch(/🔥[^\n]*3/u);
  });

  it('still reports a zero streak after a loss', () => {
    const loss = lostOn('2026-10-02');
    const stats = statsFor(loss);
    expect(stats.currentStreak).toBe(0);
    expect(buildShareString(loss, stats)).toMatch(/🔥[^\n]*0/u);
  });

  it('names the game in the title', () => {
    expect(buildShareString(wonOn('2026-10-02', 3), EMPTY_STATS).split('\n')[0]).toBe(
      `The Lost Explorer #${puzzleNumberFor('2026-10-02')}`,
    );
  });

  it('reports the solved day in words as well as the strip', () => {
    expect(buildShareString(wonOn('2026-10-02', 4), EMPTY_STATS)).toContain('Day 4');
  });

  it('includes the elapsed time when the game was timed', () => {
    expect(buildShareString(wonOn('2026-10-02', 3, 78_000), EMPTY_STATS)).toContain('01:18');
  });

  it('pads hours into the elapsed time only when needed', () => {
    expect(buildShareString(wonOn('2026-10-02', 3, 3_723_000), EMPTY_STATS)).toContain('1:02:03');
  });

  it('omits the elapsed time when the game was never timed', () => {
    const share = buildShareString(wonOn('2026-10-02', 3, null), EMPTY_STATS);
    expect(share).not.toContain('⏱');
    expect(share).not.toContain(':');
  });

  it('reports the wrong-guess count, and omits it at zero', () => {
    expect(buildShareString(wonOn('2026-10-02', 3), EMPTY_STATS)).toContain('2 wrong');
    expect(buildShareString(wonOn('2026-10-02', 1), EMPTY_STATS)).not.toContain('wrong');
  });
});

describe('isResolvedGame', () => {
  it('rejects an unresolved game', () => {
    const inProgress = RecordedGameSchema.parse({
      dayKey: '2026-10-02',
      currentDay: 2,
      guesses: {},
      status: 'in_progress',
      startedAtMs: 0,
    });
    expect(isResolvedGame(inProgress)).toBe(false);
  });

  it('accepts wins and losses', () => {
    expect(isResolvedGame(wonOn('2026-10-02', 3))).toBe(true);
    expect(isResolvedGame(lostOn('2026-10-02'))).toBe(true);
  });
});

describe('buildShareString — no spoilers for any puzzle', () => {
  const puzzles = loadPuzzles();

  it('loads all six hand-verified puzzles', () => {
    expect(puzzles).toHaveLength(6);
  });

  function secretsOf(puzzle: Puzzle): string[] {
    return [
      puzzle.city,
      puzzle.country,
      puzzle.countryCode,
      puzzle.day2.referenceCity,
      puzzle.day2.referenceCityCountry,
      puzzle.day4.historicalEntity,
      puzzle.day5.language,
      puzzle.day5.helpPhrase,
      puzzle.day5.helpPhraseTranslation,
    ].filter((secret) => secret.length > 2);
  }

  for (const puzzle of puzzles) {
    const win = wonOn(puzzle.publishDate, 3);
    const loss = lostOn(puzzle.publishDate);
    const stats = statsFor(win);

    for (const [label, game] of [
      ['win', win],
      ['loss', loss],
    ] as const) {
      it(`leaks nothing from ${puzzle.id} on a ${label}`, () => {
        const share = buildShareString(game, stats);
        const lowered = share.toLowerCase();
        const keyed = toSearchKey(share);

        for (const secret of secretsOf(puzzle)) {
          expect(lowered).not.toContain(secret.toLowerCase());
          expect(keyed).not.toContain(toSearchKey(secret));
        }
      });
    }
  }

  it('leaks no guessed city or country name', () => {
    const share = buildShareString(wonOn('2026-10-02', 4), EMPTY_STATS);
    expect(share).not.toContain('Decoy');
    expect(share).not.toContain('Decoyland');
  });

  it('leaks nothing when every puzzle is folded into one corpus check', () => {
    for (const puzzle of puzzles) {
      for (const game of [wonOn(puzzle.publishDate, 3), lostOn(puzzle.publishDate)]) {
        const keyed = toSearchKey(buildShareString(game, EMPTY_STATS));
        expect(keyed).not.toContain(toSearchKey(puzzle.city));
        expect(keyed).not.toContain(toSearchKey(puzzle.country));
      }
    }
  });
});

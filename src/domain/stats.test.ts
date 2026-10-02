import { describe, it, expect } from 'bun:test';
import {
  computeStats,
  RecordedGameSchema,
  type GameJournal,
  type RecordedGame,
} from './stats';

function guess(geonameId: number, distanceKm: number, dayGuessed: number) {
  return {
    geonameId,
    displayName: `City ${geonameId}`,
    country: 'Testland',
    distanceKm,
    band: distanceKm === 0 ? 'very-close' : 'far',
    dayGuessed,
  };
}

function startOf(dayKey: string): number {
  return Date.parse(`${dayKey}T09:00:00.000Z`);
}

function wonOn(
  dayKey: string,
  solvedOnDay: number,
  solveTimeMs: number | null = 120_000
): RecordedGame {
  const startedAtMs = startOf(dayKey);
  const guesses: Record<string, unknown> = {};
  for (let day = 1; day < solvedOnDay; day += 1) {
    guesses[String(1000 + day)] = guess(1000 + day, 500 * day, day);
  }
  guesses['9999'] = guess(9999, 0, solvedOnDay);

  return RecordedGameSchema.parse({
    dayKey,
    currentDay: solvedOnDay,
    guesses,
    status: 'won',
    startedAtMs,
    ...(solveTimeMs === null ? {} : { resolvedAtMs: startedAtMs + solveTimeMs }),
  });
}

function lostOn(dayKey: string, solveTimeMs = 300_000): RecordedGame {
  const startedAtMs = startOf(dayKey);
  const guesses: Record<string, unknown> = {};
  for (let day = 1; day <= 5; day += 1) {
    guesses[String(2000 + day)] = guess(2000 + day, 900 * day, day);
  }

  return RecordedGameSchema.parse({
    dayKey,
    currentDay: 5,
    guesses,
    status: 'lost',
    startedAtMs,
    resolvedAtMs: startedAtMs + solveTimeMs,
  });
}

function openOn(dayKey: string, currentDay = 2): RecordedGame {
  const startedAtMs = startOf(dayKey);
  const guesses: Record<string, unknown> = {};
  for (let day = 1; day < currentDay; day += 1) {
    guesses[String(3000 + day)] = guess(3000 + day, 700 * day, day);
  }

  return RecordedGameSchema.parse({
    dayKey,
    currentDay,
    guesses,
    status: 'in_progress',
    startedAtMs,
  });
}

function journalOf(...games: RecordedGame[]): GameJournal {
  return Object.fromEntries(games.map((game) => [game.dayKey, game]));
}

// The five fixtures named in the plan's QA scenario.
const FIXTURE_A: GameJournal = {};

const FIXTURE_B = journalOf(
  wonOn('2026-06-01', 1),
  wonOn('2026-06-02', 2),
  wonOn('2026-06-03', 3)
);

const FIXTURE_C = journalOf(
  wonOn('2026-06-01', 2),
  wonOn('2026-06-02', 2),
  wonOn('2026-06-04', 3)
);

const FIXTURE_D = journalOf(
  wonOn('2026-06-01', 2),
  lostOn('2026-06-02'),
  wonOn('2026-06-03', 4)
);

const FIXTURE_E = journalOf(
  wonOn('2026-06-01', 1),
  wonOn('2026-06-02', 2),
  wonOn('2026-06-03', 3),
  openOn('2026-06-04', 2)
);

describe('computeStats — fixture A, zero state (gap G4)', () => {
  const stats = computeStats(FIXTURE_A);

  it('reports nothing played, won or failed', () => {
    expect(stats.played).toBe(0);
    expect(stats.won).toBe(0);
    expect(stats.failed).toBe(0);
  });

  it('reports winPercent 0 rather than NaN from a zero divisor', () => {
    expect(stats.winPercent).toBe(0);
  });

  it('reports averageDaySolved as null so the UI can render an em dash', () => {
    expect(stats.averageDaySolved).toBeNull();
  });

  it('reports averageSolveTimeMs as null rather than NaN', () => {
    expect(stats.averageSolveTimeMs).toBeNull();
  });

  it('reports both streaks as 0', () => {
    expect(stats.currentStreak).toBe(0);
    expect(stats.longestStreak).toBe(0);
  });

  it('reports every per-Day solve count as 0', () => {
    expect(stats.daySolves).toEqual({ 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 });
  });

  it('serializes without the string NaN anywhere', () => {
    expect(JSON.stringify(stats)).not.toContain('NaN');
  });
});

describe('computeStats — fixture B, three consecutive wins', () => {
  const stats = computeStats(FIXTURE_B);

  it('counts three played and three won', () => {
    expect(stats.played).toBe(3);
    expect(stats.won).toBe(3);
    expect(stats.failed).toBe(0);
  });

  it('reports a current streak of 3 and a longest streak of 3', () => {
    expect(stats.currentStreak).toBe(3);
    expect(stats.longestStreak).toBe(3);
  });

  it('reports winPercent 100', () => {
    expect(stats.winPercent).toBe(100);
  });

  it('averages the solved Days 1, 2 and 3 to 2', () => {
    expect(stats.averageDaySolved).toBe(2);
  });

  it('distributes one solve into each of Days 1, 2 and 3', () => {
    expect(stats.daySolves).toEqual({ 1: 1, 2: 1, 3: 1, 4: 0, 5: 0 });
  });
});

describe('computeStats — fixture C, a missed day breaks the streak', () => {
  const stats = computeStats(FIXTURE_C);

  it('resets the current streak to 1 after the gap', () => {
    expect(stats.currentStreak).toBe(1);
  });

  it('remembers the pre-gap run as the longest streak', () => {
    expect(stats.longestStreak).toBe(2);
  });

  it('still counts all three wins as played', () => {
    expect(stats.played).toBe(3);
    expect(stats.won).toBe(3);
  });
});

describe('computeStats — fixture D, an explicit loss', () => {
  const stats = computeStats(FIXTURE_D);

  it('counts the loss as played but not won', () => {
    expect(stats.played).toBe(3);
    expect(stats.won).toBe(2);
    expect(stats.failed).toBe(1);
  });

  it('restarts the streak at 1 on the win after the loss', () => {
    expect(stats.currentStreak).toBe(1);
  });

  it('never lets the loss day extend the longest streak', () => {
    expect(stats.longestStreak).toBe(1);
  });

  it('rounds winPercent to a whole number', () => {
    expect(stats.winPercent).toBe(67);
  });

  it('averages solve time over wins only', () => {
    expect(stats.averageSolveTimeMs).toBe(120_000);
  });
});

describe('computeStats — fixture E, an in-progress game', () => {
  const stats = computeStats(FIXTURE_E);

  it('excludes the in-progress game from played, won and failed', () => {
    expect(stats.played).toBe(3);
    expect(stats.won).toBe(3);
    expect(stats.failed).toBe(0);
  });

  it('does not let the in-progress game break the streak', () => {
    expect(stats.currentStreak).toBe(3);
    expect(stats.longestStreak).toBe(3);
  });

  it('does not add the in-progress game to the solve distribution', () => {
    expect(stats.daySolves).toEqual({ 1: 1, 2: 1, 3: 1, 4: 0, 5: 0 });
  });
});

describe('computeStats — streak folding details', () => {
  it('reports 0 when the most recent resolved game is a loss', () => {
    const stats = computeStats(
      journalOf(wonOn('2026-06-01', 1), wonOn('2026-06-02', 1), lostOn('2026-06-03'))
    );
    expect(stats.currentStreak).toBe(0);
    expect(stats.longestStreak).toBe(2);
  });

  it('extends a streak across a month boundary', () => {
    const stats = computeStats(
      journalOf(wonOn('2026-06-30', 2), wonOn('2026-07-01', 2))
    );
    expect(stats.currentStreak).toBe(2);
  });

  it('extends a streak across a year boundary', () => {
    const stats = computeStats(
      journalOf(wonOn('2026-12-31', 2), wonOn('2027-01-01', 2))
    );
    expect(stats.currentStreak).toBe(2);
  });

  it('folds chronologically regardless of insertion order', () => {
    const outOfOrder = journalOf(
      wonOn('2026-06-03', 1),
      wonOn('2026-06-01', 1),
      wonOn('2026-06-02', 1)
    );
    expect(computeStats(outOfOrder).currentStreak).toBe(3);
  });

  it('starts the streak at 1 on a first-ever win', () => {
    expect(computeStats(journalOf(wonOn('2026-06-01', 3))).currentStreak).toBe(1);
  });

  it('ignores in-progress days when testing day adjacency', () => {
    const stats = computeStats(
      journalOf(
        wonOn('2026-06-01', 1),
        openOn('2026-06-02', 3),
        wonOn('2026-06-03', 1)
      )
    );
    expect(stats.currentStreak).toBe(1);
    expect(stats.longestStreak).toBe(1);
  });
});

describe('computeStats — derived averages', () => {
  it('takes the solved Day from the correct guess, not from currentDay', () => {
    const resolvedLate = RecordedGameSchema.parse({
      dayKey: '2026-06-01',
      currentDay: 5,
      guesses: {
        '1001': guess(1001, 800, 1),
        '9999': guess(9999, 0, 2),
      },
      status: 'won',
      startedAtMs: startOf('2026-06-01'),
    });
    expect(computeStats(journalOf(resolvedLate)).daySolves[2]).toBe(1);
  });

  it('rounds averageDaySolved to one decimal place', () => {
    const stats = computeStats(
      journalOf(wonOn('2026-06-01', 1), wonOn('2026-06-02', 2), wonOn('2026-06-03', 2))
    );
    expect(stats.averageDaySolved).toBe(1.7);
  });

  it('reports averageSolveTimeMs as null when no win carries a resolution time', () => {
    const stats = computeStats(journalOf(wonOn('2026-06-01', 1, null)));
    expect(stats.averageSolveTimeMs).toBeNull();
  });

  it('averages only the wins that carry a resolution time', () => {
    const stats = computeStats(
      journalOf(
        wonOn('2026-06-01', 1, 60_000),
        wonOn('2026-06-02', 1, null),
        wonOn('2026-06-03', 1, 180_000)
      )
    );
    expect(stats.averageSolveTimeMs).toBe(120_000);
  });

  it('never produces NaN for any of the five fixtures', () => {
    for (const fixture of [FIXTURE_A, FIXTURE_B, FIXTURE_C, FIXTURE_D, FIXTURE_E]) {
      expect(JSON.stringify(computeStats(fixture))).not.toContain('NaN');
    }
  });
});

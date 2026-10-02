import { z } from 'zod';
import { DAY_MS, getPuzzleDayKey } from './dailyClock';
import { DailyGameStateSchema } from './game';

// resolvedAtMs is additive over DailyGameState: the base shape carries only startedAtMs, and
// "average solve time" (initial.txt:602) needs the other end of the interval. It is optional so
// journals written before the timer landed still parse.
export const RecordedGameSchema = DailyGameStateSchema.extend({
  resolvedAtMs: z.number().int().nonnegative().optional(),
});

export type RecordedGame = z.infer<typeof RecordedGameSchema>;

export const GameJournalSchema = z.record(z.string(), RecordedGameSchema);

export type GameJournal = z.infer<typeof GameJournalSchema>;

export type SolveDay = 1 | 2 | 3 | 4 | 5;

export interface Stats {
  played: number;
  won: number;
  winPercent: number;
  currentStreak: number;
  longestStreak: number;
  averageDaySolved: number | null;
  daySolves: Record<SolveDay, number>;
  failed: number;
  averageSolveTimeMs: number | null;
}

function isSolveDay(day: number): day is SolveDay {
  return day === 1 || day === 2 || day === 3 || day === 4 || day === 5;
}

function dayKeyToMs(dayKey: string): number {
  return Date.parse(`${dayKey}T00:00:00.000Z`);
}

function followsConsecutively(previousDayKey: string, dayKey: string): boolean {
  return getPuzzleDayKey(dayKeyToMs(previousDayKey) + DAY_MS) === dayKey;
}

function solvedDay(game: RecordedGame): number {
  const winning = Object.values(game.guesses).find((entry) => entry.distanceKm === 0);
  return winning?.dayGuessed ?? game.currentDay;
}

function roundTo(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function averageOf(values: number[], decimals = 0): number | null {
  if (values.length === 0) {
    return null;
  }

  const total = values.reduce((sum, value) => sum + value, 0);
  return roundTo(total / values.length, decimals);
}

// Statistics are always folded from the journal, never stored or incremented. That is what makes
// the zero state and a mid-game rollover fall out correctly with no special cases.
export function computeStats(games: GameJournal): Stats {
  const resolved = Object.keys(games)
    .sort()
    .map((dayKey) => games[dayKey])
    .filter((game): game is RecordedGame => game !== undefined)
    .filter((game) => game.status !== 'in_progress');

  const daySolves: Record<SolveDay, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  const solvedDays: number[] = [];
  const solveTimes: number[] = [];

  let currentStreak = 0;
  let longestStreak = 0;
  let previousDayKey: string | undefined;

  for (const game of resolved) {
    if (game.status === 'won') {
      const day = solvedDay(game);
      solvedDays.push(day);
      if (isSolveDay(day)) {
        daySolves[day] += 1;
      }
      if (game.resolvedAtMs !== undefined) {
        solveTimes.push(game.resolvedAtMs - game.startedAtMs);
      }

      const continuesStreak =
        previousDayKey === undefined || followsConsecutively(previousDayKey, game.dayKey);
      currentStreak = continuesStreak ? currentStreak + 1 : 1;
    } else {
      currentStreak = 0;
    }

    longestStreak = Math.max(longestStreak, currentStreak);
    previousDayKey = game.dayKey;
  }

  const played = resolved.length;
  const won = solvedDays.length;

  return {
    played,
    won,
    winPercent: played === 0 ? 0 : Math.round((won / played) * 100),
    currentStreak,
    longestStreak,
    averageDaySolved: averageOf(solvedDays, 1),
    daySolves,
    failed: played - won,
    averageSolveTimeMs: averageOf(solveTimes),
  };
}

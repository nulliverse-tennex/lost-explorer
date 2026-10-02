import { daysSinceEpoch } from '@/domain/dailyClock';
import type { RecordedGame, Stats } from '@/domain/stats';

// initial.txt:581 — "Never show city name." Guess display names are dropped rather than
// formatted: a wrong guess in the answer's own country is still a hint worth withholding.
const TITLE = 'The Lost Explorer';

const SOLVED = '🟩';
const PASSED = '⬜';
const UNREACHED = '⬛';
const COLD = '🟥';

const DAYS = 5;

export type ResolvedGame = RecordedGame & { status: 'won' | 'lost' };

export function isResolvedGame(game: RecordedGame): game is ResolvedGame {
  return game.status !== 'in_progress';
}

function puzzleNumber(dayKey: string): number {
  return daysSinceEpoch(Date.parse(`${dayKey}T00:00:00.000Z`)) + 1;
}

function solvedDay(game: ResolvedGame): number {
  const winning = Object.values(game.guesses).find((guess) => guess.distanceKm === 0);
  return winning?.dayGuessed ?? game.currentDay;
}

function wrongGuessCount(game: ResolvedGame): number {
  return Object.values(game.guesses).filter((guess) => guess.distanceKm !== 0).length;
}

function strip(markedDay: number, mark: string): string {
  let cells = '';
  for (let day = 1; day <= DAYS; day += 1) {
    cells += day < markedDay ? PASSED : day === markedDay ? mark : UNREACHED;
  }
  return cells;
}

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

function formatElapsed(ms: number): string {
  const totalSeconds = Math.round(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return hours > 0
    ? `${hours}:${pad(minutes)}:${pad(seconds)}`
    : `${pad(minutes)}:${pad(seconds)}`;
}

// Gap G8: a game that was restored from a transfer code, or played before the timer landed,
// has no interval to report. The time line is optional per initial.txt:577 ("Time if desired").
function elapsedMs(game: ResolvedGame): number | null {
  if (game.startedAtMs <= 0 || game.resolvedAtMs === undefined) {
    return null;
  }
  const elapsed = game.resolvedAtMs - game.startedAtMs;
  return elapsed > 0 ? elapsed : null;
}

export function buildShareString(game: ResolvedGame, stats: Stats): string {
  const won = game.status === 'won';
  const markedDay = won ? solvedDay(game) : game.currentDay;
  const wrong = wrongGuessCount(game);
  const elapsed = elapsedMs(game);

  const outcome = won ? `Found on Day ${markedDay}` : 'Trail went cold';
  const lines = [
    `${TITLE} #${puzzleNumber(game.dayKey)}`,
    strip(markedDay, won ? SOLVED : COLD),
    wrong > 0 ? `${outcome} · ${wrong} wrong turn${wrong === 1 ? '' : 's'}` : outcome,
  ];

  if (elapsed !== null) {
    lines.push(`⏱ ${formatElapsed(elapsed)}`);
  }
  lines.push(`🔥 Streak ${stats.currentStreak}`);

  return lines.join('\n');
}

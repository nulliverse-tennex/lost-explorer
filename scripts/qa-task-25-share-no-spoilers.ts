import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { toSearchKey } from '../src/domain/normalize';
import { PuzzleSchema, type Puzzle } from '../src/domain/puzzle';
import {
  computeStats,
  RecordedGameSchema,
  type GameJournal,
  type RecordedGame,
} from '../src/domain/stats';
import { buildShareString, isResolvedGame, type ResolvedGame } from '../src/share/shareString';

const PUZZLE_DIR = join(import.meta.dir, '../content/puzzles');
const SOLVED_ON_DAY = 3;
const FIVE_CELL = /^[\u2b1b\u2b1c\u{1f7e9}\u{1f7e5}]{5}$/u;

function puzzles(): Puzzle[] {
  return readdirSync(PUZZLE_DIR)
    .filter((name) => name.endsWith('.json'))
    .map((name) => PuzzleSchema.parse(JSON.parse(readFileSync(join(PUZZLE_DIR, name), 'utf8'))))
    .sort((a, b) => a.publishDate.localeCompare(b.publishDate));
}

function guess(geonameId: number, distanceKm: number, dayGuessed: number) {
  return {
    geonameId,
    displayName: `Decoy ${geonameId}`,
    country: 'Decoyland',
    distanceKm,
    band: distanceKm === 0 ? 'very-close' : 'far',
    dayGuessed,
  };
}

function asResolved(game: RecordedGame): ResolvedGame {
  if (!isResolvedGame(game)) {
    throw new Error(`fixture is unresolved: ${game.dayKey}`);
  }
  return game;
}

function winningState(dayKey: string): ResolvedGame {
  const startedAtMs = Date.parse(`${dayKey}T09:00:00.000Z`);
  const guesses: Record<string, unknown> = {};
  for (let day = 1; day < SOLVED_ON_DAY; day += 1) {
    guesses[String(1000 + day)] = guess(1000 + day, 450 * day, day);
  }
  guesses['9999'] = guess(9999, 0, SOLVED_ON_DAY);

  return asResolved(
    RecordedGameSchema.parse({
      dayKey,
      currentDay: SOLVED_ON_DAY,
      guesses,
      status: 'won',
      startedAtMs,
      resolvedAtMs: startedAtMs + 78_000,
    }),
  );
}

function losingState(dayKey: string): ResolvedGame {
  const startedAtMs = Date.parse(`${dayKey}T09:00:00.000Z`);
  const guesses: Record<string, unknown> = {};
  for (let day = 1; day <= 5; day += 1) {
    guesses[String(2000 + day)] = guess(2000 + day, 900 * day, day);
  }

  return asResolved(
    RecordedGameSchema.parse({
      dayKey,
      currentDay: 5,
      guesses,
      status: 'lost',
      startedAtMs,
      resolvedAtMs: startedAtMs + 263_000,
    }),
  );
}

function secrets(puzzle: Puzzle): Array<{ field: string; value: string }> {
  return [
    { field: 'city', value: puzzle.city },
    { field: 'country', value: puzzle.country },
    { field: 'day2.referenceCity', value: puzzle.day2.referenceCity },
    { field: 'day2.referenceCityCountry', value: puzzle.day2.referenceCityCountry },
    { field: 'day4.historicalEntity', value: puzzle.day4.historicalEntity },
    { field: 'day5.language', value: puzzle.day5.language },
    { field: 'day5.helpPhrase', value: puzzle.day5.helpPhrase },
    { field: 'day5.helpPhraseTranslation', value: puzzle.day5.helpPhraseTranslation },
  ];
}

const out: string[] = [];
const failures: string[] = [];

function log(line = ''): void {
  out.push(line);
  console.log(line);
}

function fail(line: string): void {
  failures.push(line);
  log(`  FAIL  ${line}`);
}

log('Task 25 QA — share output is provably spoiler-free for every puzzle');
log(`Run at ${new Date().toISOString()}`);
log();

const all = puzzles();
log(`Puzzles loaded: ${all.length} (${all.map((p) => p.id).join(', ')})`);
if (all.length !== 6) {
  fail(`expected 6 puzzles, found ${all.length}`);
}
log();

for (const puzzle of all) {
  const win = winningState(puzzle.publishDate);
  const loss = losingState(puzzle.publishDate);
  const journal: GameJournal = { [win.dayKey]: win };
  const stats = computeStats(journal);

  for (const [label, game] of [
    ['WIN  (solved Day 3)', win],
    ['LOSS (all five days)', loss],
  ] as const) {
    const share = buildShareString(game, stats);
    const lowered = share.toLowerCase();
    const keyed = toSearchKey(share);

    log('='.repeat(72));
    log(`${puzzle.id.toUpperCase()} — ${label}   [answer withheld: ${puzzle.city.length} chars]`);
    log('-'.repeat(72));
    for (const line of share.split('\n')) {
      log(`  | ${line}`);
    }
    log('-'.repeat(72));
    log(`  searchKey: ${keyed}`);

    for (const { field, value } of secrets(puzzle)) {
      if (lowered.includes(value.toLowerCase())) {
        fail(`${puzzle.id}/${label}: raw leak of ${field}`);
      }
      const key = toSearchKey(value);
      if (key.length > 0 && keyed.includes(key)) {
        fail(`${puzzle.id}/${label}: searchKey leak of ${field}`);
      }
    }

    if (lowered.includes('decoy')) {
      fail(`${puzzle.id}/${label}: leaked a guessed city name`);
    }

    const expectedNumber = share.match(/#(\d+)/);
    if (expectedNumber === null) {
      fail(`${puzzle.id}/${label}: no puzzle number`);
    } else {
      log(`  puzzle number: #${expectedNumber[1]}`);
    }

    const strip = share.split('\n').find((candidate) => FIVE_CELL.test(candidate));
    if (strip === undefined) {
      fail(`${puzzle.id}/${label}: no five-cell strip`);
    } else {
      log(`  five-cell strip: ${strip} (${[...strip].length} cells)`);
    }

    if (!/🔥\s*Streak\s*\d+/u.test(share)) {
      fail(`${puzzle.id}/${label}: no streak`);
    }

    const marksSolved = strip !== undefined && [...strip][SOLVED_ON_DAY - 1] === '🟩';
    if (game.status === 'won' && !marksSolved) {
      fail(`${puzzle.id}/${label}: win strip does not mark position ${SOLVED_ON_DAY}`);
    }
    if (game.status === 'lost' && share.includes('🟩')) {
      fail(`${puzzle.id}/${label}: loss strip claims a solve`);
    }
    log();
  }
}

log('='.repeat(72));
log(`Outputs inspected: ${all.length * 2}`);
log(`Leaks / violations: ${failures.length}`);
log(failures.length === 0 ? 'RESULT: PASS — zero leaks' : 'RESULT: FAIL');
for (const failure of failures) {
  log(`  - ${failure}`);
}

await Bun.write(
  join(import.meta.dir, '../.sisyphus/evidence/task-25-share-no-spoilers.txt'),
  `${out.join('\n')}\n`,
);

process.exit(failures.length === 0 ? 0 : 1);

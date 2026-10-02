import { createHmac } from 'node:crypto';

import type { Puzzle } from '@/domain/puzzle';

// Keyed by dayKey so every visitor on a day agrees, and by the secret so nobody can precompute
// tomorrow. This is the hedge for when the pool outgrows explicit date assignment; today every
// puzzle carries a publishDate, so its only live use is the collision tie-break below.
export function selectDailyIndex(secret: string, dayKey: string, poolSize: number): number {
  if (poolSize < 1) {
    throw new Error('selectDailyIndex requires a non-empty pool');
  }

  const digest = createHmac('sha256', secret).update(dayKey).digest();

  // 48 bits stays inside Number.MAX_SAFE_INTEGER, so the modulo is exact.
  return digest.readUIntBE(0, 6) % poolSize;
}

// Explicit publishDate only — never a modulo wrap over the pool (gap G1), which with six
// puzzles would show a repeat on day seven. Past the last published date this returns nothing
// and the UI renders the "explorer is resting" state.
export function resolveDailyPuzzle(
  puzzles: readonly Puzzle[],
  dayKey: string,
  secret: string,
): Puzzle | undefined {
  const published = puzzles.filter((puzzle) => puzzle.publishDate === dayKey);

  if (published.length < 2) {
    return published[0];
  }

  // Duplicate dates are an authoring mistake, but the city still must not depend on file order.
  return published[selectDailyIndex(secret, dayKey, published.length)];
}

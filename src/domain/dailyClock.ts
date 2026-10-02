// The ONLY place in this codebase permitted to compute a day boundary (gap P5: reset at 00:00
// UTC). Puzzle selection, the puzzle API and the countdown all import from here; duplicating
// this arithmetic is what makes the puzzle roll over while the streak still thinks it is
// yesterday. To move the reset to another hour, add it to EPOCH_UTC — every boundary derives
// from that one constant.

export const EPOCH_UTC = Date.UTC(2026, 5, 1);

export const DAY_MS = 86_400_000;

export function daysSinceEpoch(nowMs = Date.now()): number {
  return Math.floor((nowMs - EPOCH_UTC) / DAY_MS);
}

function dayStartMs(nowMs: number): number {
  return EPOCH_UTC + daysSinceEpoch(nowMs) * DAY_MS;
}

export function getPuzzleDayKey(nowMs = Date.now()): string {
  return new Date(dayStartMs(nowMs)).toISOString().slice(0, 10);
}

export function nextUtcMidnightMs(nowMs = Date.now()): number {
  return dayStartMs(nowMs) + DAY_MS;
}

export function secondsUntilNextUtcMidnight(nowMs = Date.now()): number {
  return Math.ceil((nextUtcMidnightMs(nowMs) - nowMs) / 1000);
}

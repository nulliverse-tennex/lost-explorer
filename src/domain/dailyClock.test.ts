import { describe, it, expect } from 'bun:test';
import {
  EPOCH_UTC,
  DAY_MS,
  daysSinceEpoch,
  getPuzzleDayKey,
  secondsUntilNextUtcMidnight,
  nextUtcMidnightMs,
} from './dailyClock';

// A boundary instant used throughout: 2026-06-15T00:00:00.000Z (plan QA scenario)
const B = Date.UTC(2026, 5, 15, 0, 0, 0, 0);

describe('EPOCH_UTC', () => {
  it('is the launch date 2026-06-01 (matches the first publishDate of Task 9)', () => {
    expect(new Date(EPOCH_UTC).toISOString()).toBe('2026-06-01T00:00:00.000Z');
  });

  it('sits exactly on a UTC midnight, with no time-of-day remainder', () => {
    expect(EPOCH_UTC % DAY_MS).toBe(0);
  });
});

describe('DAY_MS', () => {
  it('is 86_400_000 milliseconds', () => {
    expect(DAY_MS).toBe(86_400_000);
  });
});

describe('daysSinceEpoch', () => {
  it('is 0 at the epoch instant itself', () => {
    expect(daysSinceEpoch(EPOCH_UTC)).toBe(0);
  });

  it('is still 0 one millisecond before the epoch day ends', () => {
    expect(daysSinceEpoch(EPOCH_UTC + DAY_MS - 1)).toBe(0);
  });

  it('is 1 at the start of the second day', () => {
    expect(daysSinceEpoch(EPOCH_UTC + DAY_MS)).toBe(1);
  });

  it('increments by exactly 1 across a boundary (B - 1ms vs B)', () => {
    expect(daysSinceEpoch(B) - daysSinceEpoch(B - 1)).toBe(1);
  });

  it('does not increment within a day (00:00:00.000 vs 23:59:59.999)', () => {
    expect(daysSinceEpoch(B)).toBe(daysSinceEpoch(B + DAY_MS - 1));
  });

  it('counts 14 whole days from 2026-06-01 to 2026-06-15', () => {
    expect(daysSinceEpoch(B)).toBe(14);
  });

  it('floors toward negative infinity for instants before the epoch', () => {
    expect(daysSinceEpoch(EPOCH_UTC - 1)).toBe(-1);
    expect(daysSinceEpoch(EPOCH_UTC - DAY_MS)).toBe(-1);
    expect(daysSinceEpoch(EPOCH_UTC - DAY_MS - 1)).toBe(-2);
  });

  it('defaults to Date.now() when no argument is supplied', () => {
    const before = daysSinceEpoch(Date.now());
    expect(daysSinceEpoch()).toBe(before);
  });
});

describe('getPuzzleDayKey', () => {
  it('returns the UTC calendar date at exactly 00:00:00.000 UTC', () => {
    expect(getPuzzleDayKey(B)).toBe('2026-06-15');
  });

  it('returns the same key at 23:59:59.999 UTC on that day', () => {
    expect(getPuzzleDayKey(Date.UTC(2026, 5, 15, 23, 59, 59, 999))).toBe(
      '2026-06-15'
    );
  });

  it('returns the previous day one millisecond before the boundary', () => {
    expect(getPuzzleDayKey(B - 1)).toBe('2026-06-14');
  });

  it('returns the new day one millisecond after the boundary', () => {
    expect(getPuzzleDayKey(B + 1)).toBe('2026-06-15');
  });

  it('is always YYYY-MM-DD shaped', () => {
    expect(getPuzzleDayKey(B)).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('ignores local time: 23:30 UTC is already tomorrow in UTC+14 but the key is today', () => {
    // 2026-06-15T23:30Z is 2026-06-16 13:30 in Pacific/Kiritimati (UTC+14).
    // A local-midnight implementation would return "2026-06-16" here.
    expect(getPuzzleDayKey(Date.UTC(2026, 5, 15, 23, 30, 0, 0))).toBe(
      '2026-06-15'
    );
  });

  it('ignores local time: 00:30 UTC is still yesterday in UTC-11 but the key is today', () => {
    // 2026-06-15T00:30Z is 2026-06-14 13:30 in Pacific/Niue (UTC-11).
    expect(getPuzzleDayKey(Date.UTC(2026, 5, 15, 0, 30, 0, 0))).toBe(
      '2026-06-15'
    );
  });

  it('crosses a month boundary correctly', () => {
    expect(getPuzzleDayKey(Date.UTC(2026, 5, 30, 23, 59, 59, 999))).toBe(
      '2026-06-30'
    );
    expect(getPuzzleDayKey(Date.UTC(2026, 6, 1, 0, 0, 0, 0))).toBe('2026-07-01');
  });

  it('crosses a year boundary correctly', () => {
    expect(getPuzzleDayKey(Date.UTC(2026, 11, 31, 23, 59, 59, 999))).toBe(
      '2026-12-31'
    );
    expect(getPuzzleDayKey(Date.UTC(2027, 0, 1, 0, 0, 0, 0))).toBe('2027-01-01');
  });

  it('handles a leap day', () => {
    expect(getPuzzleDayKey(Date.UTC(2028, 1, 29, 12, 0, 0, 0))).toBe(
      '2028-02-29'
    );
  });

  it('equals the epoch launch date at the epoch', () => {
    expect(getPuzzleDayKey(EPOCH_UTC)).toBe('2026-06-01');
  });

  it('defaults to Date.now() when no argument is supplied', () => {
    expect(getPuzzleDayKey()).toBe(getPuzzleDayKey(Date.now()));
  });
});

describe('nextUtcMidnightMs', () => {
  it('returns the following midnight when called exactly at a boundary', () => {
    expect(nextUtcMidnightMs(B)).toBe(B + DAY_MS);
  });

  it('returns the upcoming boundary from mid-day', () => {
    expect(nextUtcMidnightMs(Date.UTC(2026, 5, 15, 12, 0, 0, 0))).toBe(
      B + DAY_MS
    );
  });

  it('returns B when called one millisecond before B', () => {
    expect(nextUtcMidnightMs(B - 1)).toBe(B);
  });

  it('always lands on a UTC midnight', () => {
    expect(nextUtcMidnightMs(Date.UTC(2026, 5, 15, 7, 23, 11, 456)) % DAY_MS).toBe(
      0
    );
  });
});

describe('secondsUntilNextUtcMidnight', () => {
  it('is 86400 at exactly a boundary, never 0', () => {
    expect(secondsUntilNextUtcMidnight(B)).toBe(86400);
  });

  it('is 1 at 23:59:59.000, one second before rollover', () => {
    expect(secondsUntilNextUtcMidnight(B - 1000)).toBe(1);
  });

  it('is 1 — never 0 — at 23:59:59.999', () => {
    expect(secondsUntilNextUtcMidnight(B - 1)).toBe(1);
  });

  it('is 43200 at mid-day', () => {
    expect(secondsUntilNextUtcMidnight(Date.UTC(2026, 5, 15, 12, 0, 0, 0))).toBe(
      43200
    );
  });

  it('never exceeds 86400 nor drops to 0 across a full sampled day', () => {
    for (let minute = 0; minute < 1440; minute += 7) {
      const seconds = secondsUntilNextUtcMidnight(B + minute * 60_000);
      expect(seconds).toBeGreaterThan(0);
      expect(seconds).toBeLessThanOrEqual(86400);
    }
  });

  it('defaults to Date.now() when no argument is supplied', () => {
    expect(secondsUntilNextUtcMidnight()).toBeGreaterThan(0);
    expect(secondsUntilNextUtcMidnight()).toBeLessThanOrEqual(86400);
  });
});

describe('timezone invariance', () => {
  const PROBE = `
    const { getPuzzleDayKey, daysSinceEpoch, secondsUntilNextUtcMidnight, nextUtcMidnightMs } =
      await import(${JSON.stringify(`${import.meta.dir}/dailyClock.ts`)});
    const t = Date.UTC(2026, 5, 15, 12, 0, 0);
    console.log([
      getPuzzleDayKey(t),
      daysSinceEpoch(t),
      secondsUntilNextUtcMidnight(t),
      nextUtcMidnightMs(t),
      getPuzzleDayKey(Date.UTC(2026, 5, 15, 0, 0, 0)),
      getPuzzleDayKey(Date.UTC(2026, 5, 14, 23, 59, 59, 999)),
    ].join('|'));
  `;

  const runUnder = (tz: string): string => {
    const result = Bun.spawnSync(['bun', '-e', PROBE], {
      env: { ...process.env, TZ: tz },
    });
    expect(result.exitCode).toBe(0);
    return result.stdout.toString().trim();
  };

  it('produces byte-identical output under UTC+14, UTC-11, a non-hour offset, and UTC', () => {
    const utc = runUnder('UTC');
    expect(runUnder('Pacific/Kiritimati')).toBe(utc);
    expect(runUnder('Pacific/Niue')).toBe(utc);
    expect(runUnder('Asia/Kathmandu')).toBe(utc);
    expect(runUnder('America/New_York')).toBe(utc);
  });

  it('produces the expected UTC values regardless of the host TZ the suite runs under', () => {
    expect(runUnder('UTC')).toBe(
      '2026-06-15|14|43200|1781568000000|2026-06-15|2026-06-14'
    );
  });
});

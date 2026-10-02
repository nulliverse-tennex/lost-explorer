'use client';

import { usePersistedGame } from '@/state/usePersistedGame';

const EM_DASH = '—';

function formatOptional(value: number | null): string {
  return value === null ? EM_DASH : String(value);
}

export default function PersistenceQaPage() {
  const { loaded, dayKey, today, stats } = usePersistedGame();

  const rows: ReadonlyArray<readonly [string, string]> = [
    ['played', String(stats.played)],
    ['won', String(stats.won)],
    ['win-percent', String(stats.winPercent)],
    ['current-streak', String(stats.currentStreak)],
    ['longest-streak', String(stats.longestStreak)],
    ['failed', String(stats.failed)],
    ['average-day', formatOptional(stats.averageDaySolved)],
    ['average-solve-time', formatOptional(stats.averageSolveTimeMs)],
  ];

  return (
    <main className="stage mx-auto max-w-xl px-5 py-7">
      <p className="face-stamp text-step--1 text-ink-faint">
        Field Journal &middot; Record Check
      </p>

      <h1 className="face-display mt-2 text-step-4 text-ink">
        The <span className="text-stamp">Record</span>
      </h1>

      <p className="face-journal mt-4 text-ink-muted">
        Day <span data-testid="day-key">{dayKey}</span> &middot; the page is{' '}
        <span data-testid="loaded">{loaded ? 'loaded' : 'loading'}</span>, today&apos;s
        entry reads <span data-testid="today-status">{today.status}</span>.
      </p>

      <dl className="mt-6 grid grid-cols-2 gap-4 border-t border-rule pt-5">
        {rows.map(([label, value]) => (
          <div key={label}>
            <dt className="face-stamp text-step--2 text-ink-faint">{label}</dt>
            <dd className="face-ui text-step-1 text-ink" data-testid={label}>
              {value}
            </dd>
          </div>
        ))}
      </dl>
    </main>
  );
}

'use client';

import { useId } from 'react';
import type { Stats } from '@/domain/stats';
import { DistributionBars } from './DistributionBars';
import { JournalTransfer } from './JournalTransfer';
import styles from './stats.module.css';

const EM_DASH = '—';

function formatInteger(value: number): string {
  return Number.isFinite(value) ? String(Math.round(value)) : EM_DASH;
}

function formatPercent(value: number): string {
  return Number.isFinite(value) ? `${Math.round(value)}%` : EM_DASH;
}

function formatAverageDay(value: number | null): string {
  return value === null || !Number.isFinite(value) ? EM_DASH : String(value);
}

function formatSolveTime(ms: number | null): string {
  if (ms === null || !Number.isFinite(ms) || ms < 0) {
    return EM_DASH;
  }

  const totalSeconds = Math.round(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  return `${minutes}:${String(totalSeconds % 60).padStart(2, '0')}`;
}

type StatsPanelProps = {
  stats: Stats;
  onExport: () => string;
  onImport: (code: string) => void;
};

export function StatsPanel({ stats, onExport, onImport }: StatsPanelProps) {
  const headingId = useId();

  const figures: ReadonlyArray<readonly [string, string, string]> = [
    ['stat-played', 'Games played', formatInteger(stats.played)],
    ['stat-won', 'Games won', formatInteger(stats.won)],
    ['stat-win-percent', 'Win rate', formatPercent(stats.winPercent)],
    ['stat-current-streak', 'Current streak', formatInteger(stats.currentStreak)],
    ['stat-longest-streak', 'Longest streak', formatInteger(stats.longestStreak)],
    ['stat-failed', 'Lost puzzles', formatInteger(stats.failed)],
    ['stat-average-solve-time', 'Average solve time', formatSolveTime(stats.averageSolveTimeMs)],
  ];

  return (
    <section className={styles.panel} aria-labelledby={headingId} data-testid="stats-panel">
      <h2 id={headingId} className={`face-display ${styles.panelHeading}`}>
        The Record
      </h2>

      <dl className={styles.figures}>
        <div className={styles.hero} data-testid="stat-average-day-figure">
          <dt className={`face-stamp ${styles.heroTerm}`}>Average Day solved</dt>
          <dd className={`face-display ${styles.heroValue}`} data-testid="stat-average-day">
            {formatAverageDay(stats.averageDaySolved)}
          </dd>
        </div>

        {figures.map(([testId, label, value]) => (
          <div key={testId} className={styles.figure}>
            <dt className={`face-stamp ${styles.figureTerm}`}>{label}</dt>
            <dd className={`face-ui ${styles.figureValue}`} data-testid={testId}>
              {value}
            </dd>
          </div>
        ))}
      </dl>

      <DistributionBars daySolves={stats.daySolves} failed={stats.failed} />

      <JournalTransfer onExport={onExport} onImport={onImport} />
    </section>
  );
}

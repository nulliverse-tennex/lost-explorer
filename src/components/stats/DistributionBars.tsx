import type { SolveDay, Stats } from '@/domain/stats';
import styles from './stats.module.css';

const SOLVE_DAYS: readonly SolveDay[] = [1, 2, 3, 4, 5];

type DistributionRow = {
  id: string;
  label: string;
  count: number;
};

type DistributionBarsProps = {
  daySolves: Stats['daySolves'];
  failed: number;
};

function safeCount(value: number): number {
  return Number.isFinite(value) && value > 0 ? Math.round(value) : 0;
}

// The max === 0 branch is the zero-state NaN guard, not a cosmetic choice: 0/0 would reach the
// style attribute as "NaN%".
function barPercent(count: number, max: number): number {
  return max === 0 ? 0 : Math.round((count / max) * 100);
}

function solvesLabel(count: number): string {
  return count === 1 ? '1 solve' : `${count} solves`;
}

export function DistributionBars({ daySolves, failed }: DistributionBarsProps) {
  const rows: DistributionRow[] = [
    ...SOLVE_DAYS.map((day) => ({
      id: `day-${day}`,
      label: `Day ${day}`,
      count: safeCount(daySolves[day]),
    })),
    { id: 'lost', label: 'Lost', count: safeCount(failed) },
  ];

  const max = rows.reduce((highest, row) => Math.max(highest, row.count), 0);

  return (
    <table className={styles.distribution} data-testid="distribution">
      <caption className={`face-stamp ${styles.distributionCaption}`}>
        Solve distribution
      </caption>
      <thead>
        <tr>
          <th scope="col">Outcome</th>
          <th scope="col">Tally</th>
          <th scope="col">Solves</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.id} data-testid={`distribution-row-${row.id}`}>
            <th scope="row" className={`face-stamp ${styles.distributionLabel}`}>
              {row.label}
            </th>
            <td className={styles.distributionTally}>
              <span
                role="img"
                aria-label={solvesLabel(row.count)}
                className={styles.bar}
                data-testid={`distribution-bar-${row.id}`}
                data-percent={barPercent(row.count, max)}
              >
                <span
                  className={styles.barFill}
                  style={{ width: `${barPercent(row.count, max)}%` }}
                />
              </span>
            </td>
            <td
              className={`face-ui ${styles.distributionCount}`}
              data-testid={`distribution-count-${row.id}`}
            >
              {row.count}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

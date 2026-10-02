import type { GameStatus } from '@/domain/gameReducer';
import type { Puzzle } from '@/domain/puzzle';
import { Day1Horizon } from '../clues/Day1Horizon';
import { Day2Sign } from '../clues/Day2Sign';
import { Day3FlagCloth } from '../clues/Day3FlagCloth';
import { Day4MapFragment } from '../clues/Day4MapFragment';
import { Day5Napkin } from '../clues/Day5Napkin';
import styles from './reveal.module.css';

export function CluesRecap({
  puzzle,
  status,
  headingId,
}: {
  puzzle: Puzzle;
  status: GameStatus;
  headingId: string;
}) {
  return (
    <section aria-labelledby={headingId} data-testid="clues-recap">
      <h2 className={`face-stamp ${styles.heading}`} id={headingId}>
        All five days of notes
      </h2>

      <ol className={styles.recapList} data-clue-count="5">
        <li className={styles.recapItem}>
          <Day1Horizon puzzle={puzzle} delayIndex={0} />
        </li>
        <li className={styles.recapItem}>
          <Day2Sign puzzle={puzzle} delayIndex={1} />
        </li>
        <li className={styles.recapItem}>
          <Day3FlagCloth puzzle={puzzle} status={status} delayIndex={2} />
        </li>
        <li className={styles.recapItem}>
          <Day4MapFragment puzzle={puzzle} delayIndex={3} />
        </li>
        <li className={styles.recapItem}>
          <Day5Napkin puzzle={puzzle} status={status} delayIndex={4} />
        </li>
      </ol>
    </section>
  );
}

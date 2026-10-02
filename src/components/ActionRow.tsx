'use client';

import type { DayNumber } from '@/domain/gameReducer';
import { MAX_DAY } from '@/domain/gameReducer';
import { cls } from './cls';
import styles from './guess.module.css';

export function ActionRow({
  day,
  canSubmit,
  onContinue,
}: {
  day: DayNumber;
  canSubmit: boolean;
  onContinue: () => void;
}) {
  const finalDay = day === MAX_DAY;

  return (
    <div className={cls(styles.actions, !finalDay && styles.actionsPair)}>
      <button
        type="submit"
        disabled={!canSubmit}
        data-action="guess"
        className={cls(
          styles.btn,
          styles.btnPrimary,
          finalDay && styles.btnFinal,
        )}
      >
        {finalDay ? 'Final Guess' : 'Guess'}
      </button>

      {/* Day 5 is the last chance by design: nothing matching /continue/i may
          reach the DOM, so this is a branch and never a `disabled` button. */}
      {finalDay ? null : (
        <button
          type="button"
          onClick={onContinue}
          data-action="continue"
          className={styles.btn}
        >
          Continue
        </button>
      )}
    </div>
  );
}

'use client';

import { daysSinceEpoch } from '@/domain/dailyClock';
import { useDailyGame } from '@/state/useDailyGame';
import { ClueStack } from './ClueStack';
import { GuessInput } from './GuessInput';
import { JournalShell } from './JournalShell';
import { RestingState } from './RestingState';
import { JournalSpread } from './reveal/JournalSpread';

function puzzleNumberFor(dayKey: string): number {
  return daysSinceEpoch(Date.parse(`${dayKey}T00:00:00.000Z`)) + 1;
}

export function GameBoard() {
  const daily = useDailyGame();

  if (daily.status === 'resting') {
    return <RestingState />;
  }

  const game = daily.game;
  if (daily.status === 'loading' || game === null || daily.clues === null) {
    return (
      <JournalShell day={1} puzzleNumber={1}>
        <p className="face-journal text-ink" role="status">
          Unpacking today&rsquo;s notes&hellip;
        </p>
      </JournalShell>
    );
  }

  if (game.status !== 'in_progress') {
    return (
      <JournalSpread
        game={game}
        resolvedAtMs={daily.resolvedAtMs}
        startedAtMs={daily.startedAtMs}
      />
    );
  }

  const guessedIds = game.guesses.map((g) => g.geonameId);
  const dayLocked = game.guesses.some((g) => g.dayGuessed === game.currentDay);

  return (
    <JournalShell
      day={game.currentDay}
      puzzleNumber={puzzleNumberFor(game.dayKey)}
      actions={
        <GuessInput
          day={game.currentDay}
          guessedIds={guessedIds}
          locked={dayLocked}
          onGuess={daily.submitGuess}
          onContinue={daily.continueDay}
        />
      }
    >
      <ClueStack
        clues={daily.clues}
        revealedDays={game.revealedDays}
        guesses={game.guesses}
        countryCode={daily.countryCode}
        status={game.status}
        translation={daily.resolution?.helpPhraseTranslation ?? ''}
      />
    </JournalShell>
  );
}

'use client';

import { daysSinceEpoch } from '@/domain/dailyClock';
import type { GameState } from '@/domain/gameReducer';
import { useDailyGame, type ResolutionPayload } from '@/state/useDailyGame';
import { ClueStack } from './ClueStack';
import { GuessInput } from './GuessInput';
import { JournalShell } from './JournalShell';
import { RestingState } from './RestingState';
import { RubberStamp } from './RubberStamp';

function puzzleNumberFor(dayKey: string): number {
  return daysSinceEpoch(Date.parse(`${dayKey}T00:00:00.000Z`)) + 1;
}

function formatElapsed(ms: number): string {
  const totalSeconds = Math.round(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}m ${seconds}s`;
}

function ResultPanel({
  game,
  resolution,
  startedAtMs,
  resolvedAtMs,
}: {
  game: GameState;
  resolution: ResolutionPayload | null;
  startedAtMs: number;
  resolvedAtMs: number | null;
}) {
  const won = game.status === 'won';
  const elapsed =
    resolvedAtMs !== null && startedAtMs > 0 ? resolvedAtMs - startedAtMs : null;
  const wrongCount = game.wrongGuesses.length;

  return (
    <section
      className="ink-layer mt-6 flex flex-col items-center gap-4 border-t-2 border-rule-strong pt-6 text-center"
      data-testid="result-panel"
      data-status={game.status}
    >
      <RubberStamp variant={won ? 'found' : 'lost'} rotate={won ? -2.4 : 3.1}>
        {won ? 'Found' : 'Lost'}
      </RubberStamp>

      {resolution ? (
        <div className="face-journal text-ink" data-testid="result-details">
          <p className="face-display text-step-2">
            {resolution.city}, {resolution.country}
          </p>
          <p className="face-ui text-step--1 text-ink-muted">
            {won ? `Solved on Day ${game.daySolved}` : 'Not solved'} &middot; {wrongCount}{' '}
            wrong guess{wrongCount === 1 ? '' : 'es'}
            {elapsed !== null ? <> &middot; {formatElapsed(elapsed)}</> : null}
          </p>
        </div>
      ) : (
        <p className="face-journal text-ink" role="status">
          Sealing the entry&hellip;
        </p>
      )}
    </section>
  );
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

  const resolved = game.status !== 'in_progress';
  const guessedIds = game.guesses.map((g) => g.geonameId);
  const dayLocked = game.guesses.some((g) => g.dayGuessed === game.currentDay);

  return (
    <JournalShell
      day={game.currentDay}
      puzzleNumber={puzzleNumberFor(game.dayKey)}
      actions={
        resolved ? null : (
          <GuessInput
            day={game.currentDay}
            guessedIds={guessedIds}
            locked={dayLocked}
            onGuess={daily.submitGuess}
            onContinue={daily.continueDay}
          />
        )
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

      {resolved ? (
        <ResultPanel
          game={game}
          resolution={daily.resolution}
          startedAtMs={daily.startedAtMs}
          resolvedAtMs={daily.resolvedAtMs}
        />
      ) : null}
    </JournalShell>
  );
}

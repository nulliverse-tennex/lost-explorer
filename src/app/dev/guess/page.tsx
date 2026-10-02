'use client';

import { useMemo, useReducer } from 'react';
import { GuessInput } from '@/components/GuessInput';
import { PaperFilters } from '@/components/PaperFilters';
import { RubberStamp } from '@/components/RubberStamp';
import { createGame, gameReducer } from '@/domain/gameReducer';

const TBILISI = { geonameId: 611717, lat: 41.69143, lng: 44.83412 };

export default function GuessDevPage() {
  const [state, dispatch] = useReducer(gameReducer, TBILISI, (answer) =>
    createGame('dev', answer),
  );

  const guessedIds = useMemo(
    () => state.guesses.map((guess) => guess.geonameId),
    [state.guesses],
  );

  const daySpent = state.guesses.some(
    (guess) => guess.dayGuessed === state.currentDay,
  );

  return (
    <main className="stage mx-auto flex min-h-full max-w-xl flex-col px-4 py-7">
      <PaperFilters />

      <p className="face-stamp text-step--2 text-ink-faint">
        Field Journal &middot; Guess Composer
      </p>
      <h1 className="face-display mt-2 text-step-3 text-ink">
        Where <span className="text-stamp">am I?</span>
      </h1>

      <div className="mt-5 flex items-center gap-4">
        <RubberStamp variant="day">Day {state.currentDay}</RubberStamp>
        <span
          className="face-ui text-step--1 text-ink-muted"
          data-testid="guess-count"
        >
          {state.guesses.length} guesses
        </span>
        <span className="face-stamp text-step--2 text-ink-faint" data-testid="status">
          {state.status}
        </span>
      </div>

      <ol
        className="face-ui mt-5 flex flex-col gap-2 text-step--1 text-ink"
        data-testid="guess-log"
      >
        {state.guesses.map((guess) => (
          <li key={guess.geonameId} data-city-id={guess.geonameId}>
            {guess.displayName}, {guess.country} &middot; day {guess.dayGuessed}{' '}
            &middot; {guess.correct ? 'correct' : guess.band}
          </li>
        ))}
      </ol>

      <div className="mt-auto pt-7">
        {state.status === 'in_progress' ? (
          <GuessInput
            day={state.currentDay}
            guessedIds={guessedIds}
            locked={daySpent}
            onGuess={(guess) => dispatch({ type: 'SUBMIT_GUESS', guess })}
            onContinue={() => dispatch({ type: 'CONTINUE' })}
          />
        ) : (
          <RubberStamp variant={state.status === 'won' ? 'found' : 'lost'}>
            {state.status === 'won' ? 'Found' : 'Lost'}
          </RubberStamp>
        )}
      </div>
    </main>
  );
}

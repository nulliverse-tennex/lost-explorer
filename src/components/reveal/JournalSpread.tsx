'use client';

import { useEffect, useId, useMemo, useState, type ReactNode } from 'react';
import AntiqueWorldMap, { type MapPlace } from '@/components/map/AntiqueWorldMap';
import type { GameState } from '@/domain/gameReducer';
import { PuzzleSchema, type Puzzle } from '@/domain/puzzle';
import type { ResolutionPayload, ServerDayClues } from '@/state/useDailyGame';
import { cls } from '../cls';
import { Countdown } from '../Countdown';
import { CluesRecap } from './CluesRecap';
import { useGuessPlaces } from './guessPlaces';
import { ResultSummary } from './ResultSummary';
import styles from './reveal.module.css';

const REVEAL_URL = '/api/daily?stage=5&resolved=true';

type RevealResponse = {
  clues: ServerDayClues;
  resolved?: ResolutionPayload;
};

/* useDailyGame keeps only the `resolved` half of this payload and leaves
   `clues` at whatever stage the player reached, so a Day 3 win never holds the
   Day 4 and Day 5 artefacts the recap must re-present. Re-requesting the one
   endpoint that carries all five is the only way to assemble a whole Puzzle
   without reaching into state/. It is fetched on mount of this screen and
   nowhere earlier, so the answer still cannot leak mid-game. */
function assemblePuzzle(
  dayKey: string,
  clues: ServerDayClues,
  resolved: ResolutionPayload,
): Puzzle | null {
  const { day1, day2, day3, day4, day5 } = clues;
  if (!day2 || !day3 || !day4 || !day5) {
    return null;
  }

  const candidate = PuzzleSchema.safeParse({
    id: `reveal-${dayKey}`,
    city: resolved.city,
    country: resolved.country,
    countryCode: resolved.countryCode,
    geonameId: resolved.geonameId,
    coordinates: resolved.coordinates,
    publishDate: dayKey,
    day1: { ...day1, populationSource: resolved.populationSource },
    day2,
    day3,
    day4: { ...day4, historicalSourceUrl: resolved.historicalSourceUrl },
    day5: { ...day5, helpPhraseTranslation: resolved.helpPhraseTranslation },
  });

  return candidate.success ? candidate.data : null;
}

function useRevealPuzzle(dayKey: string): Puzzle | null {
  const [puzzle, setPuzzle] = useState<Puzzle | null>(null);

  useEffect(() => {
    let live = true;

    fetch(REVEAL_URL)
      .then((response) => {
        if (!response.ok) {
          throw new Error(`reveal request failed with ${response.status}`);
        }
        return response.json() as Promise<RevealResponse>;
      })
      .then((payload) => {
        if (live && payload.resolved) {
          setPuzzle(assemblePuzzle(dayKey, payload.clues, payload.resolved));
        }
      })
      .catch(() => {
        if (live) {
          setPuzzle(null);
        }
      });

    return () => {
      live = false;
    };
  }, [dayKey]);

  return puzzle;
}

export function JournalSpread({
  game,
  startedAtMs,
  resolvedAtMs,
  share,
}: {
  game: GameState;
  startedAtMs: number;
  resolvedAtMs: number | null;
  share?: ReactNode;
}) {
  const uid = useId().replace(/:/g, '');
  const puzzle = useRevealPuzzle(game.dayKey);
  const wrongPlaces = useGuessPlaces(game.wrongGuesses);

  const trueCity: MapPlace | null = useMemo(
    () =>
      puzzle
        ? {
            id: String(puzzle.geonameId),
            name: `${puzzle.city}, ${puzzle.country}`,
            lat: puzzle.coordinates.lat,
            lng: puzzle.coordinates.lng,
          }
        : null,
    [puzzle],
  );

  if (!puzzle || !trueCity) {
    return (
      <div className="stage">
        <p className={cls('face-journal', styles.pending)} role="status">
          Sealing the entry&hellip;
        </p>
      </div>
    );
  }

  const plotted = wrongPlaces.length;

  return (
    <div
      className={cls('stage', styles.spread)}
      data-status={game.status}
      data-testid="journal-spread"
    >
      <section
        aria-labelledby={`${uid}-chart`}
        className={styles.page}
        data-testid="spread-chart"
      >
        <h2 className={cls('face-stamp', styles.heading)} id={`${uid}-chart`}>
          The chart, unrolled
        </h2>

        <figure className={styles.chartFigure}>
          <AntiqueWorldMap trueCity={trueCity} wrongGuesses={wrongPlaces} />
          <figcaption className={cls('face-journal', styles.chartCaption)}>
            {puzzle.city} marked at last
            {plotted > 0
              ? `, with a route traced back to ${plotted === 1 ? 'the one place' : `each of the ${plotted} places`} you reckoned instead.`
              : ', with no wrong reckonings to trace.'}
          </figcaption>
        </figure>
      </section>

      <div className={styles.page} data-testid="spread-reveal">
        <ResultSummary
          game={game}
          headingId={`${uid}-result`}
          puzzle={puzzle}
          resolvedAtMs={resolvedAtMs}
          startedAtMs={startedAtMs}
        />

        <CluesRecap
          headingId={`${uid}-recap`}
          puzzle={puzzle}
          status={game.status}
        />

        <footer className={styles.closing}>
          <Countdown />
          <div className={styles.shareSlot} data-slot="share">
            {share}
          </div>
        </footer>
      </div>
    </div>
  );
}

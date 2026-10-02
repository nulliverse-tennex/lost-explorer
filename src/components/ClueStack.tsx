import type { ReactNode } from 'react';
import type { DayNumber, GameStatus, GuessRecord } from '@/domain/gameReducer';
import { formatBand } from '@/domain/geo';
import type { Puzzle } from '@/domain/puzzle';
import type { ServerDayClues } from '@/state/useDailyGame';
import { Day1Horizon } from './clues/Day1Horizon';
import { Day2Sign } from './clues/Day2Sign';
import { Day3FlagCloth } from './clues/Day3FlagCloth';
import { Day4MapFragment } from './clues/Day4MapFragment';
import { Day5Napkin } from './clues/Day5Napkin';
import { RubberStamp } from './RubberStamp';

const PLACEHOLDER_URL = 'https://lostexplorer.example/pending';

// Every clue component declares `puzzle: Puzzle` (the full answer shape), but the daily
// route only ever sends the fields for days already unlocked. Days not yet revealed are
// filled with inert placeholders here — never rendered, since each day's component is
// only mounted once its own day is in revealedDays.
function buildClientPuzzle(
  clues: ServerDayClues,
  countryCode: string | null,
  translation: string,
): Puzzle {
  return {
    id: 'daily-entry',
    city: '',
    country: '',
    countryCode: countryCode ?? 'xx',
    geonameId: 1,
    coordinates: { lat: 0, lng: 0 },
    publishDate: '2026-01-01',
    day1: {
      landscape: clues.day1.landscape as Puzzle['day1']['landscape'],
      metroPopulationMillions: clues.day1.metroPopulationMillions,
      populationSource: { name: '', url: PLACEHOLDER_URL, asOfYear: 2026 },
    },
    day2: clues.day2
      ? {
          referenceCity: clues.day2.referenceCity,
          referenceCityCountry: clues.day2.referenceCityCountry,
          referenceCityCoordinates: clues.day2.referenceCityCoordinates,
          distanceKm: clues.day2.distanceKm,
          recognisability: clues.day2.recognisability as Puzzle['day2']['recognisability'],
        }
      : {
          referenceCity: '',
          referenceCityCountry: '',
          referenceCityCoordinates: { lat: 0, lng: 0 },
          distanceKm: 1,
          recognisability: 'global',
        },
    day3: clues.day3
      ? { flagColours: clues.day3.flagColours as Puzzle['day3']['flagColours'] }
      : { flagColours: ['red'] },
    day4: clues.day4
      ? { ...clues.day4, historicalSourceUrl: PLACEHOLDER_URL }
      : { mapYear: 2000, historicalEntity: '', historicalSourceUrl: PLACEHOLDER_URL },
    day5: clues.day5
      ? { ...clues.day5, helpPhraseTranslation: translation }
      : { language: '', languageCode: 'xx', helpPhrase: '', helpPhraseTranslation: '' },
  };
}

function renderDayCard(
  day: DayNumber,
  puzzle: Puzzle,
  status: GameStatus,
  delayIndex: number,
): ReactNode {
  switch (day) {
    case 1:
      return <Day1Horizon key="day1" puzzle={puzzle} delayIndex={delayIndex} />;
    case 2:
      return <Day2Sign key="day2" puzzle={puzzle} delayIndex={delayIndex} />;
    case 3:
      return <Day3FlagCloth key="day3" puzzle={puzzle} status={status} delayIndex={delayIndex} />;
    case 4:
      return <Day4MapFragment key="day4" puzzle={puzzle} delayIndex={delayIndex} />;
    case 5:
      return <Day5Napkin key="day5" puzzle={puzzle} status={status} delayIndex={delayIndex} />;
  }
}

export function ClueStack({
  clues,
  revealedDays,
  guesses,
  countryCode,
  status,
  translation,
}: {
  clues: ServerDayClues;
  revealedDays: readonly DayNumber[];
  guesses: readonly GuessRecord[];
  countryCode: string | null;
  status: GameStatus;
  translation: string;
}) {
  const puzzle = buildClientPuzzle(clues, countryCode, translation);
  const guessByDay = new Map(guesses.map((g) => [g.dayGuessed, g]));

  const cards: ReactNode[] = [];
  revealedDays.forEach((day, index) => {
    cards.push(renderDayCard(day, puzzle, status, index));

    const guess = guessByDay.get(day);
    if (guess && !guess.correct) {
      cards.push(
        <p key={`wrong-${day}`} className="flex justify-end" data-wrong-guess={day}>
          <RubberStamp variant="wrong" rotate={-3.2}>
            {guess.displayName}, {guess.country} &mdash; {formatBand(guess.band)}
          </RubberStamp>
        </p>,
      );
    }
  });

  return <div className="flex flex-col gap-6" data-testid="clue-stack">{cards}</div>;
}

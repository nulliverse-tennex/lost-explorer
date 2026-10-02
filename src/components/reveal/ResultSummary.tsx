import { formatPopulation } from '@/domain/clueText';
import type { GameState } from '@/domain/gameReducer';
import type { Puzzle } from '@/domain/puzzle';
import { cls } from '../cls';
import { flagSvgUrl } from '../clues/flagAsset';
import { RubberStamp } from '../RubberStamp';
import styles from './reveal.module.css';

/* Deliberately not arcs.ts's identical formatKm: arcs.ts pulls in d3-geo, and
   Task 21 dynamic-imports the whole map precisely to keep d3 out of this
   bundle. Importing it here for one string would undo that. */
function formatKm(km: number): string {
  return `${Math.round(km).toLocaleString('en-US')} km`;
}

function formatClock(ms: number): string {
  const totalSeconds = Math.max(0, Math.round(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function educationalFact(puzzle: Puzzle): string {
  const { city } = puzzle;
  const { mapYear, historicalEntity } = puzzle.day4;
  const { language } = puzzle.day5;
  const people = formatPopulation(puzzle.day1.metroPopulationMillions);

  return `In ${mapYear} the ground under ${city} was governed as part of ${historicalEntity}. Today around ${people} live in its metropolitan area, and the language you heard offered at your elbow was ${language}.`;
}

export function ResultSummary({
  game,
  puzzle,
  startedAtMs,
  resolvedAtMs,
  headingId,
}: {
  game: GameState;
  puzzle: Puzzle;
  startedAtMs: number;
  resolvedAtMs: number | null;
  headingId: string;
}) {
  const won = game.status === 'won';
  const wrongCount = game.wrongGuesses.length;
  const finalGuess = game.guesses[game.guesses.length - 1];
  const elapsedMs =
    resolvedAtMs !== null && startedAtMs > 0 ? resolvedAtMs - startedAtMs : null;
  const { populationSource } = puzzle.day1;

  return (
    <section
      aria-labelledby={headingId}
      className={styles.page}
      data-testid="result-summary"
      data-status={game.status}
    >
      <p>
        <RubberStamp variant={won ? 'found' : 'lost'} rotate={won ? -2.4 : 3.1}>
          {won ? 'Found' : 'Lost'}
        </RubberStamp>
      </p>

      <h2
        className={cls('face-display', 'ink-layer', styles.title)}
        id={headingId}
      >
        {won ? 'You found yourself in ' : 'The explorer was in '}
        <strong data-testid="true-city">
          {puzzle.city}, {puzzle.country}
        </strong>
      </h2>

      {!won && finalGuess ? (
        <p className={cls('face-journal', styles.lede)} data-testid="final-guess">
          Your final guess: {finalGuess.displayName}, {finalGuess.country}
          {' — '}
          <span data-testid="final-guess-distance">
            {formatKm(finalGuess.distanceKm)}
          </span>{' '}
          away.
        </p>
      ) : null}

      <dl className={cls('face-ui', styles.facts)}>
        <div>
          <dt className={cls('face-stamp', styles.factTerm)}>Solved on</dt>
          <dd className={styles.factValue} data-testid="day-solved">
            {won && game.daySolved !== null ? `Day ${game.daySolved}` : 'Not solved'}
          </dd>
        </div>
        <div>
          <dt className={cls('face-stamp', styles.factTerm)}>Wrong guesses</dt>
          <dd className={styles.factValue} data-testid="wrong-count">
            {wrongCount}
          </dd>
        </div>
        <div>
          <dt className={cls('face-stamp', styles.factTerm)}>Time</dt>
          <dd className={styles.factValue} data-testid="elapsed-time">
            {elapsedMs === null ? '—' : formatClock(elapsedMs)}
          </dd>
        </div>
      </dl>

      {game.guesses.length > 0 ? (
        <ol className={cls('face-ui', styles.log)} data-testid="guess-log">
          {game.guesses.map((guess) => (
            <li
              className={styles.logEntry}
              key={guess.geonameId}
              data-guess-day={guess.dayGuessed}
            >
              Day {guess.dayGuessed}: {guess.displayName}, {guess.country}
              {' — '}
              {guess.correct ? 'the city itself' : `${formatKm(guess.distanceKm)} off`}
            </li>
          ))}
        </ol>
      ) : null}

      <p className={styles.flagStamp} data-testid="reveal-flag">
        <img
          alt={`Flag of ${puzzle.country}`}
          className={styles.flagImage}
          height={120}
          src={flagSvgUrl(puzzle.countryCode)}
          width={160}
        />
        <span className={cls('face-stamp', styles.flagLabel)}>
          {puzzle.country}
        </span>
      </p>

      <p
        className={cls('face-journal', styles.fact)}
        data-testid="educational-fact"
      >
        {educationalFact(puzzle)}
      </p>

      <ul className={cls('face-ui', styles.sources)} data-testid="reveal-sources">
        <li>
          Population:{' '}
          <cite>
            <a
              data-testid="population-source"
              href={populationSource.url}
              rel="noreferrer noopener"
              target="_blank"
            >
              {populationSource.name}
            </a>
          </cite>{' '}
          ({populationSource.asOfYear})
        </li>
        <li>
          The old map, {puzzle.day4.mapYear} &mdash;{' '}
          <cite>
            <a
              data-testid="historical-source"
              href={puzzle.day4.historicalSourceUrl}
              rel="noreferrer noopener"
              target="_blank"
            >
              {puzzle.day4.historicalEntity}
            </a>
          </cite>
        </li>
      </ul>
    </section>
  );
}

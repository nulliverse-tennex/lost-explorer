import { distanceBand, haversineKm, type DistanceBand } from './geo';

export const MAX_DAY = 5;
export const MAX_GUESSES = 5;

export type DayNumber = 1 | 2 | 3 | 4 | 5;

export type GameStatus = 'in_progress' | 'won' | 'lost';

export type GameAnswer = {
  geonameId: number;
  lat: number;
  lng: number;
};

export type GuessCandidate = {
  geonameId: number;
  displayName: string;
  country: string;
  lat: number;
  lng: number;
};

export type GuessRecord = {
  geonameId: number;
  displayName: string;
  country: string;
  dayGuessed: DayNumber;
  correct: boolean;
  distanceKm: number;
  band: DistanceBand;
};

export type GameState = {
  dayKey: string;
  answer: GameAnswer;
  currentDay: DayNumber;
  revealedDays: DayNumber[];
  guesses: GuessRecord[];
  wrongGuesses: GuessRecord[];
  status: GameStatus;
  daySolved: DayNumber | null;
};

export type GameAction =
  | { type: 'REVEAL_DAY'; day: DayNumber }
  | { type: 'SUBMIT_GUESS'; guess: GuessCandidate }
  | { type: 'CONTINUE' }
  | { type: 'RESOLVE' };

export function createGame(dayKey: string, answer: GameAnswer): GameState {
  return {
    dayKey,
    answer,
    currentDay: 1,
    revealedDays: [1],
    guesses: [],
    wrongGuesses: [],
    status: 'in_progress',
    daySolved: null,
  };
}

function nextDay(day: DayNumber): DayNumber {
  return (day + 1) as DayNumber;
}

function reveal(state: GameState, day: DayNumber): DayNumber[] {
  if (state.revealedDays.includes(day)) return state.revealedDays;
  return [...state.revealedDays, day].sort((a, b) => a - b);
}

function withGuess(state: GameState, record: GuessRecord): GameState {
  const guesses = [...state.guesses, record];
  return {
    ...state,
    guesses,
    wrongGuesses: guesses.filter((guess) => !guess.correct),
  };
}

function submitGuess(state: GameState, candidate: GuessCandidate): GameState {
  const alreadyGuessed = state.guesses.some(
    (guess) => guess.geonameId === candidate.geonameId
  );
  const dayGuessSpent = state.guesses.some(
    (guess) => guess.dayGuessed === state.currentDay
  );
  if (alreadyGuessed || dayGuessSpent || state.guesses.length >= MAX_GUESSES) {
    return state;
  }

  const distanceKm = haversineKm(
    candidate.lat,
    candidate.lng,
    state.answer.lat,
    state.answer.lng
  );
  const record: GuessRecord = {
    geonameId: candidate.geonameId,
    displayName: candidate.displayName,
    country: candidate.country,
    dayGuessed: state.currentDay,
    correct: candidate.geonameId === state.answer.geonameId,
    distanceKm,
    band: distanceBand(distanceKm),
  };
  const guessed = withGuess(state, record);

  if (record.correct) {
    return { ...guessed, status: 'won', daySolved: record.dayGuessed };
  }
  if (state.currentDay === MAX_DAY) {
    return { ...guessed, status: 'lost' };
  }
  const advanced = nextDay(state.currentDay);
  return {
    ...guessed,
    currentDay: advanced,
    revealedDays: reveal(guessed, advanced),
  };
}

export function gameReducer(state: GameState, action: GameAction): GameState {
  if (state.status !== 'in_progress') return state;

  switch (action.type) {
    case 'REVEAL_DAY': {
      if (action.day > state.currentDay) return state;
      const revealedDays = reveal(state, action.day);
      if (revealedDays === state.revealedDays) return state;
      return { ...state, revealedDays };
    }

    case 'SUBMIT_GUESS':
      return submitGuess(state, action.guess);

    case 'CONTINUE': {
      if (state.currentDay === MAX_DAY) return state;
      const advanced = nextDay(state.currentDay);
      return {
        ...state,
        currentDay: advanced,
        revealedDays: reveal(state, advanced),
      };
    }

    // Clock-driven: the UTC puzzle day ended with the game unfinished. This is
    // not a player-initiated forfeit and no in-game control dispatches it.
    case 'RESOLVE':
      return { ...state, status: 'lost' };
  }
}

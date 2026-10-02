'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { nextUtcMidnightMs } from '@/domain/dailyClock';
import {
  gameReducer,
  type DayNumber,
  type GameAction,
  type GameAnswer,
  type GameState,
  type GuessCandidate,
  type GuessRecord,
} from '@/domain/gameReducer';
import { loadCityIndex, search } from '@/search/cityIndex';
import { RecordedGameSchema, type RecordedGame } from '@/domain/stats';
import { usePersistedGame } from './usePersistedGame';

export type ServerDayClues = {
  day1: { landscape: string; metroPopulationMillions: number };
  day2?: {
    referenceCity: string;
    referenceCityCountry: string;
    referenceCityCoordinates: { lat: number; lng: number };
    distanceKm: number;
    recognisability: string;
  };
  day3?: { flagColours: string[] };
  day4?: { mapYear: number; historicalEntity: string };
  day5?: { language: string; languageCode: string; helpPhrase: string };
};

export type ResolutionPayload = {
  city: string;
  country: string;
  countryCode: string;
  geonameId: number;
  coordinates: { lat: number; lng: number };
  helpPhraseTranslation: string;
  populationSource: { name: string; url: string; asOfYear: number };
  historicalSourceUrl: string;
};

type DailyApiResponse = {
  day: string;
  isToday: boolean;
  stage: number;
  clues: ServerDayClues;
  resolved?: ResolutionPayload;
  dev?: boolean;
  answer?: { city: string; country: string; coordinates: { lat: number; lng: number } };
};

type FetchOutcome =
  | { kind: 'ok'; data: DailyApiResponse }
  | { kind: 'not-found' };

async function fetchDaily(stage: number, resolved = false): Promise<FetchOutcome> {
  const params = new URLSearchParams({ stage: String(stage) });
  if (resolved) {
    params.set('resolved', 'true');
  }

  const response = await fetch(`/api/daily?${params.toString()}`);
  if (response.status === 404) {
    return { kind: 'not-found' };
  }
  if (!response.ok) {
    throw new Error(`daily puzzle request failed with ${response.status}`);
  }

  const data = (await response.json()) as DailyApiResponse;
  return { kind: 'ok', data };
}

// Only available in dev mode (see api/daily/route.ts), where the answer ships early by
// design. Keyed through the same search index GuessInput uses, so the geonameId matches
// the identity a player's own pick would carry.
async function resolveAnswerIdentity(
  city: string,
  country: string,
): Promise<{ geonameId: number; countryCode: string } | null> {
  try {
    await loadCityIndex();
  } catch {
    return null;
  }
  const matches = search(city, 10);
  const exact = matches.find((m) => m.name === city && m.country === country);
  const best = exact ?? matches[0];
  return best ? { geonameId: best.id, countryCode: best.cc } : null;
}

function asDayNumber(day: number): DayNumber {
  return day as DayNumber;
}

function buildGameState(recorded: RecordedGame, answer: GameAnswer): GameState {
  const guesses: GuessRecord[] = Object.values(recorded.guesses)
    .map((g) => ({
      geonameId: g.geonameId,
      displayName: g.displayName,
      country: g.country,
      dayGuessed: asDayNumber(g.dayGuessed),
      correct: g.distanceKm === 0,
      distanceKm: g.distanceKm,
      band: g.band,
    }))
    .sort((a, b) => a.dayGuessed - b.dayGuessed);

  const correctGuess = guesses.find((g) => g.correct);
  const revealedDays = Array.from(
    { length: recorded.currentDay },
    (_, i) => asDayNumber(i + 1),
  );

  return {
    dayKey: recorded.dayKey,
    answer,
    currentDay: asDayNumber(recorded.currentDay),
    revealedDays,
    guesses,
    wrongGuesses: guesses.filter((g) => !g.correct),
    status: recorded.status,
    daySolved: correctGuess ? correctGuess.dayGuessed : null,
  };
}

function toRecordedGame(game: GameState, base: RecordedGame): RecordedGame {
  const guesses: Record<string, unknown> = {};
  for (const g of game.guesses) {
    guesses[String(g.geonameId)] = {
      geonameId: g.geonameId,
      displayName: g.displayName,
      country: g.country,
      distanceKm: g.distanceKm,
      band: g.band,
      dayGuessed: g.dayGuessed,
    };
  }

  const resolvedAtMs =
    game.status === 'in_progress' ? undefined : base.resolvedAtMs ?? Date.now();

  return RecordedGameSchema.parse({
    dayKey: game.dayKey,
    currentDay: game.currentDay,
    guesses,
    status: game.status,
    startedAtMs: base.startedAtMs,
    ...(resolvedAtMs !== undefined ? { resolvedAtMs } : {}),
  });
}

export type DailyGameStatus = 'loading' | 'resting' | 'ready';

export interface DailyGameApi {
  status: DailyGameStatus;
  clues: ServerDayClues | null;
  countryCode: string | null;
  resolution: ResolutionPayload | null;
  game: GameState | null;
  startedAtMs: number;
  resolvedAtMs: number | null;
  submitGuess: (candidate: GuessCandidate) => void;
  continueDay: () => void;
}

// The integration point: drives gameReducer with persisted state, fetches exactly the
// stage the player has unlocked (never ahead), and reveals the resolution payload only
// once the reducer itself has resolved the game.
export function useDailyGame(): DailyGameApi {
  const persisted = usePersistedGame();

  const [loadStatus, setLoadStatus] = useState<DailyGameStatus>('loading');
  const [clues, setClues] = useState<ServerDayClues | null>(null);
  const [countryCode, setCountryCode] = useState<string | null>(null);
  const [resolution, setResolution] = useState<ResolutionPayload | null>(null);
  const [game, setGame] = useState<GameState | null>(null);

  const bootstrappedRef = useRef(false);
  const fetchedStagesRef = useRef<Set<number>>(new Set());
  const resolutionRequestedRef = useRef(false);

  const requestResolution = useCallback(() => {
    if (resolutionRequestedRef.current) {
      return;
    }
    resolutionRequestedRef.current = true;

    fetchDaily(5, true)
      .then((result) => {
        if (result.kind === 'ok' && result.data.resolved) {
          setResolution(result.data.resolved);
        }
      })
      .catch(() => {
        resolutionRequestedRef.current = false;
      });
  }, []);

  // Bootstrap: fetch exactly the stage the persisted game is already on (1 for a fresh
  // game), derive the reducer's answer from the dev-mode payload, and build GameState.
  useEffect(() => {
    if (!persisted.loaded || bootstrappedRef.current) {
      return;
    }
    bootstrappedRef.current = true;
    let cancelled = false;

    (async () => {
      const recorded = persisted.today;
      const stage = recorded.currentDay;

      const result = await fetchDaily(stage);
      if (cancelled) {
        return;
      }
      if (result.kind === 'not-found') {
        setLoadStatus('resting');
        return;
      }

      fetchedStagesRef.current.add(stage);
      setClues(result.data.clues);

      let answer: GameAnswer = { geonameId: -1, lat: 0, lng: 0 };
      if (result.data.answer) {
        const identity = await resolveAnswerIdentity(
          result.data.answer.city,
          result.data.answer.country,
        );
        if (cancelled) {
          return;
        }
        if (identity) {
          answer = {
            geonameId: identity.geonameId,
            lat: result.data.answer.coordinates.lat,
            lng: result.data.answer.coordinates.lng,
          };
          setCountryCode(identity.countryCode);
        }
      }

      if (cancelled) {
        return;
      }

      setGame(buildGameState(recorded, answer));
      setLoadStatus('ready');
      persisted.markFirstClueViewed();
    })();

    return () => {
      cancelled = true;
    };
    // persisted.today / markFirstClueViewed are read once at bootstrap time only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [persisted.loaded]);

  // Progressive fetch: request the next stage only once the reducer has actually
  // advanced the player to it. Never requests a stage ahead of currentDay.
  useEffect(() => {
    if (game === null) {
      return;
    }
    const stage = game.currentDay;
    if (fetchedStagesRef.current.has(stage)) {
      return;
    }
    let cancelled = false;

    fetchDaily(stage)
      .then((result) => {
        if (cancelled) {
          return;
        }
        if (result.kind === 'not-found') {
          setLoadStatus('resting');
          return;
        }
        fetchedStagesRef.current.add(stage);
        setClues(result.data.clues);
      })
      .catch(() => {
        // Leave the previous clue set in place rather than crash the board.
      });

    return () => {
      cancelled = true;
    };
  }, [game?.currentDay]);

  // Once the reducer resolves the game (won or lost), reveal the answer exactly once —
  // never before, and never speculatively.
  useEffect(() => {
    if (game === null || game.status === 'in_progress') {
      return;
    }
    requestResolution();
  }, [game?.status, requestResolution]);

  const dispatch = useCallback(
    (action: GameAction) => {
      setGame((prev) => {
        if (prev === null) {
          return prev;
        }
        const next = gameReducer(prev, action);
        if (next === prev) {
          return prev;
        }
        persisted.saveToday(toRecordedGame(next, persisted.today));
        return next;
      });
    },
    [persisted],
  );

  const submitGuess = useCallback(
    (candidate: GuessCandidate) => dispatch({ type: 'SUBMIT_GUESS', guess: candidate }),
    [dispatch],
  );

  const continueDay = useCallback(() => dispatch({ type: 'CONTINUE' }), [dispatch]);

  // Mid-session UTC rollover (gap: a tab left open across midnight). A full reload
  // re-mounts usePersistedGame, which recomputes getPuzzleDayKey() fresh and looks up
  // today's journal entry — naturally presenting a new board without touching the
  // abandoned entry, which computeStats already excludes via its in_progress filter.
  useEffect(() => {
    const delay = Math.max(nextUtcMidnightMs() - Date.now(), 0);
    const timer = window.setTimeout(() => {
      window.location.reload();
    }, delay);
    return () => window.clearTimeout(timer);
  }, []);

  return {
    status: loadStatus,
    clues,
    countryCode,
    resolution,
    game,
    startedAtMs: persisted.today.startedAtMs,
    resolvedAtMs: persisted.today.resolvedAtMs ?? null,
    submitGuess,
    continueDay,
  };
}

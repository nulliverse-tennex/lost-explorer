'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { getPuzzleDayKey } from '@/domain/dailyClock';
import {
  computeStats,
  type GameJournal,
  type RecordedGame,
  type Stats,
} from '@/domain/stats';
import { exportJournal, importJournal, readJournal, writeJournal } from './persistence';

const EMPTY_JOURNAL: GameJournal = {};

const NOT_STARTED = 0;

function freshGame(dayKey: string): RecordedGame {
  return {
    dayKey,
    currentDay: 1,
    guesses: {},
    status: 'in_progress',
    startedAtMs: NOT_STARTED,
  };
}

export interface PersistedGame {
  loaded: boolean;
  dayKey: string;
  today: RecordedGame;
  stats: Stats;
  saveToday: (next: RecordedGame) => void;
  markFirstClueViewed: () => void;
  exportCode: () => string;
  restoreFrom: (code: string) => void;
}

// The only module in the app permitted to touch localStorage, and it does so from effects alone:
// the first render must be identical on the server and the client or React discards the markup.
export function usePersistedGame(): PersistedGame {
  const [dayKey] = useState(getPuzzleDayKey);
  const [journal, setJournal] = useState<GameJournal>(EMPTY_JOURNAL);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setJournal(readJournal());
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) {
      return;
    }
    writeJournal(journal);
  }, [loaded, journal]);

  const today = useMemo(
    () => journal[dayKey] ?? freshGame(dayKey),
    [journal, dayKey]
  );

  const saveToday = useCallback((next: RecordedGame) => {
    setJournal((current) => ({ ...current, [next.dayKey]: next }));
  }, []);

  // Gap G8: the clock starts when the explorer first reads a clue and is never restarted, so a
  // reload cannot rewind it and an idle tab cannot be paused.
  const markFirstClueViewed = useCallback(() => {
    if (!loaded) {
      return;
    }

    setJournal((current) => {
      const existing = current[dayKey] ?? freshGame(dayKey);
      if (existing.startedAtMs !== NOT_STARTED) {
        return current;
      }

      return { ...current, [dayKey]: { ...existing, startedAtMs: Date.now() } };
    });
  }, [loaded, dayKey]);

  const exportCode = useCallback(() => exportJournal(journal), [journal]);

  const restoreFrom = useCallback((code: string) => {
    const imported = importJournal(code);
    setJournal((current) => ({ ...current, ...imported }));
  }, []);

  const stats = useMemo(() => computeStats(journal), [journal]);

  return {
    loaded,
    dayKey,
    today,
    stats,
    saveToday,
    markFirstClueViewed,
    exportCode,
    restoreFrom,
  };
}

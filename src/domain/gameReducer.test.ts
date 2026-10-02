import { describe, it, expect } from 'bun:test';
import {
  createGame,
  gameReducer,
  MAX_DAY,
  MAX_GUESSES,
  type DayNumber,
  type GameState,
  type GuessCandidate,
} from './gameReducer';

const TBILISI = {
  geonameId: 611717,
  displayName: 'Tbilisi',
  country: 'Georgia',
  lat: 41.6938,
  lng: 44.8015,
};

const MUNICH: GuessCandidate = {
  geonameId: 2867714,
  displayName: 'München',
  country: 'Germany',
  lat: 48.1374,
  lng: 11.5755,
};

// Same city, English exonym and a different display string — must still be
// recognised as already guessed, because identity is the geonameId (gap G3).
const MUNICH_ENGLISH: GuessCandidate = {
  geonameId: 2867714,
  displayName: 'Munich',
  country: 'Germany',
  lat: 48.1374,
  lng: 11.5755,
};

const YEREVAN: GuessCandidate = {
  geonameId: 616052,
  displayName: 'Yerevan',
  country: 'Armenia',
  lat: 40.1792,
  lng: 44.4991,
};

const WRONG_CITIES: GuessCandidate[] = [
  MUNICH,
  YEREVAN,
  { geonameId: 745044, displayName: 'Istanbul', country: 'Turkey', lat: 41.0082, lng: 28.9784 },
  { geonameId: 360630, displayName: 'Cairo', country: 'Egypt', lat: 30.0444, lng: 31.2357 },
  { geonameId: 1850147, displayName: 'Tokyo', country: 'Japan', lat: 35.6762, lng: 139.6503 },
  { geonameId: 3936456, displayName: 'Lima', country: 'Peru', lat: -12.0464, lng: -77.0428 },
];

const CORRECT: GuessCandidate = {
  geonameId: TBILISI.geonameId,
  displayName: TBILISI.displayName,
  country: TBILISI.country,
  lat: TBILISI.lat,
  lng: TBILISI.lng,
};

function freshGame(): GameState {
  return createGame('2026-10-02', {
    geonameId: TBILISI.geonameId,
    lat: TBILISI.lat,
    lng: TBILISI.lng,
  });
}

function continueTo(day: DayNumber): GameState {
  let state = freshGame();
  for (let i = 1; i < day; i += 1) {
    state = gameReducer(state, { type: 'CONTINUE' });
  }
  return state;
}

describe('createGame', () => {
  it('starts on Day 1 with the Day 1 clue revealed and nothing guessed', () => {
    const state = freshGame();
    expect(state.currentDay).toBe(1);
    expect(state.revealedDays).toEqual([1]);
    expect(state.guesses).toEqual([]);
    expect(state.wrongGuesses).toEqual([]);
    expect(state.status).toBe('in_progress');
    expect(state.daySolved).toBeNull();
  });

  it('produces no numeric score field (Day solved plus wrong-guess count is the metric)', () => {
    expect(Object.keys(freshGame())).not.toContain('score');
  });
});

describe('CONTINUE', () => {
  it('advances the Day without spending the Day guess', () => {
    const state = gameReducer(freshGame(), { type: 'CONTINUE' });
    expect(state.currentDay).toBe(2);
    expect(state.guesses).toHaveLength(0);
    expect(state.wrongGuesses).toHaveLength(0);
  });

  it('reveals the clue of the Day it advances to', () => {
    const state = gameReducer(freshGame(), { type: 'CONTINUE' });
    expect(state.revealedDays).toEqual([1, 2]);
  });

  it('is rejected on Day 5 because there is no Day 6', () => {
    const day5 = continueTo(5);
    const after = gameReducer(day5, { type: 'CONTINUE' });
    expect(after).toBe(day5);
    expect(after.currentDay).toBe(MAX_DAY);
    expect(after.status).toBe('in_progress');
  });

  it('walks all five Days and still allows a final correct guess', () => {
    const day5 = continueTo(5);
    expect(day5.currentDay).toBe(5);
    expect(day5.revealedDays).toEqual([1, 2, 3, 4, 5]);
    expect(day5.guesses).toHaveLength(0);

    const won = gameReducer(day5, { type: 'SUBMIT_GUESS', guess: CORRECT });
    expect(won.status).toBe('won');
    expect(won.daySolved).toBe(5);
    expect(won.wrongGuesses).toHaveLength(0);
  });
});

describe('P1: a wrong guess and a CONTINUE must not be interchangeable', () => {
  it('both advance the Day but only the wrong guess leaves a record', () => {
    const fresh = freshGame();
    const sContinue = gameReducer(fresh, { type: 'CONTINUE' });
    const sWrong = gameReducer(fresh, { type: 'SUBMIT_GUESS', guess: MUNICH });

    expect(sContinue.currentDay).toBe(2);
    expect(sWrong.currentDay).toBe(2);

    expect(sContinue.guesses).toHaveLength(0);
    expect(sWrong.guesses).toHaveLength(1);
    expect(sContinue.wrongGuesses).toHaveLength(0);
    expect(sWrong.wrongGuesses).toHaveLength(1);

    expect(sContinue).not.toEqual(sWrong);
  });
});

describe('SUBMIT_GUESS — winning', () => {
  const days: DayNumber[] = [1, 2, 3, 4, 5];

  for (const day of days) {
    it(`records a win on Day ${day}`, () => {
      const state = gameReducer(continueTo(day), {
        type: 'SUBMIT_GUESS',
        guess: CORRECT,
      });
      expect(state.status).toBe('won');
      expect(state.daySolved).toBe(day);
      expect(state.currentDay).toBe(day);
      expect(state.guesses).toHaveLength(1);
      expect(state.wrongGuesses).toHaveLength(0);
    });
  }
});

describe('SUBMIT_GUESS — wrong guesses', () => {
  it('attaches the distance and band measured against the answer', () => {
    const state = gameReducer(freshGame(), { type: 'SUBMIT_GUESS', guess: YEREVAN });
    const record = state.wrongGuesses[0]!;
    expect(record.geonameId).toBe(YEREVAN.geonameId);
    expect(record.dayGuessed).toBe(1);
    expect(record.correct).toBe(false);
    // Yerevan to Tbilisi is roughly 175 km.
    expect(record.distanceKm).toBeGreaterThan(150);
    expect(record.distanceKm).toBeLessThan(200);
    expect(record.band).toBe('very-close');
  });

  it('bands a distant miss as very-far', () => {
    const state = gameReducer(freshGame(), { type: 'SUBMIT_GUESS', guess: MUNICH });
    expect(state.wrongGuesses[0]!.band).toBe('very-far');
  });

  it('loses the puzzle when the Day 5 guess is wrong', () => {
    const state = gameReducer(continueTo(5), { type: 'SUBMIT_GUESS', guess: MUNICH });
    expect(state.status).toBe('lost');
    expect(state.daySolved).toBeNull();
    expect(state.currentDay).toBe(5);
    expect(state.wrongGuesses).toHaveLength(1);
  });

  it('allows exactly five wrong guesses before the puzzle is lost', () => {
    let state = freshGame();
    for (let i = 0; i < MAX_GUESSES; i += 1) {
      state = gameReducer(state, { type: 'SUBMIT_GUESS', guess: WRONG_CITIES[i]! });
    }
    expect(state.status).toBe('lost');
    expect(state.guesses).toHaveLength(MAX_GUESSES);
    expect(state.wrongGuesses).toHaveLength(MAX_GUESSES);
    expect(state.wrongGuesses.map((g) => g.dayGuessed)).toEqual([1, 2, 3, 4, 5]);
  });

  it('never grows the wrong-guess record past five', () => {
    let state = freshGame();
    for (const city of WRONG_CITIES) {
      state = gameReducer(state, { type: 'SUBMIT_GUESS', guess: city });
      expect(state.wrongGuesses.length).toBeLessThanOrEqual(MAX_GUESSES);
    }
    expect(state.wrongGuesses).toHaveLength(MAX_GUESSES);
  });
});

describe('SUBMIT_GUESS — duplicate rejection by geonameId', () => {
  it('rejects the same geonameId under a different display name', () => {
    const afterFirst = gameReducer(freshGame(), { type: 'SUBMIT_GUESS', guess: MUNICH });
    expect(afterFirst.guesses).toHaveLength(1);
    expect(afterFirst.currentDay).toBe(2);

    const afterDuplicate = gameReducer(afterFirst, {
      type: 'SUBMIT_GUESS',
      guess: MUNICH_ENGLISH,
    });
    expect(afterDuplicate).toBe(afterFirst);
    expect(afterDuplicate.guesses).toHaveLength(1);
    expect(afterDuplicate.currentDay).toBe(2);
  });

  it('allows only one guess per Day', () => {
    const afterFirst = gameReducer(freshGame(), { type: 'SUBMIT_GUESS', guess: MUNICH });
    const forced: GameState = { ...afterFirst, currentDay: 1 };
    const afterSecond = gameReducer(forced, { type: 'SUBMIT_GUESS', guess: YEREVAN });
    expect(afterSecond).toBe(forced);
    expect(afterSecond.guesses).toHaveLength(1);
  });
});

describe('REVEAL_DAY', () => {
  it('is idempotent for an already revealed Day', () => {
    const fresh = freshGame();
    const after = gameReducer(fresh, { type: 'REVEAL_DAY', day: 1 });
    expect(after.revealedDays).toEqual([1]);
    expect(after).toBe(fresh);
  });

  it('refuses to reveal a Day the player has not reached', () => {
    const fresh = freshGame();
    const after = gameReducer(fresh, { type: 'REVEAL_DAY', day: 4 });
    expect(after).toBe(fresh);
    expect(after.revealedDays).toEqual([1]);
  });

  it('reveals an earlier Day that is missing after rehydration', () => {
    const day3 = continueTo(3);
    const partial: GameState = { ...day3, revealedDays: [1, 3] };
    const after = gameReducer(partial, { type: 'REVEAL_DAY', day: 2 });
    expect(after.revealedDays).toEqual([1, 2, 3]);
  });
});

describe('RESOLVE', () => {
  it('marks an unfinished puzzle lost when its UTC day has ended', () => {
    const state = gameReducer(continueTo(3), { type: 'RESOLVE' });
    expect(state.status).toBe('lost');
    expect(state.daySolved).toBeNull();
    expect(state.currentDay).toBe(3);
  });

  it('leaves a won puzzle untouched', () => {
    const won = gameReducer(freshGame(), { type: 'SUBMIT_GUESS', guess: CORRECT });
    expect(gameReducer(won, { type: 'RESOLVE' })).toBe(won);
  });
});

describe('actions after resolution', () => {
  it('ignores every action once the puzzle is won', () => {
    const won = gameReducer(freshGame(), { type: 'SUBMIT_GUESS', guess: CORRECT });
    expect(gameReducer(won, { type: 'CONTINUE' })).toBe(won);
    expect(gameReducer(won, { type: 'SUBMIT_GUESS', guess: MUNICH })).toBe(won);
    expect(gameReducer(won, { type: 'REVEAL_DAY', day: 1 })).toBe(won);
  });

  it('ignores every action once the puzzle is lost', () => {
    const lost = gameReducer(continueTo(5), { type: 'SUBMIT_GUESS', guess: MUNICH });
    expect(lost.status).toBe('lost');
    expect(gameReducer(lost, { type: 'CONTINUE' })).toBe(lost);
    expect(gameReducer(lost, { type: 'SUBMIT_GUESS', guess: YEREVAN })).toBe(lost);
    expect(gameReducer(lost, { type: 'RESOLVE' })).toBe(lost);
  });
});

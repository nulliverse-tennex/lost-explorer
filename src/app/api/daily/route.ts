import { NextResponse } from 'next/server';

import { getPuzzleDayKey, secondsUntilNextUtcMidnight } from '@/domain/dailyClock';
import type { Puzzle } from '@/domain/puzzle';
import { resolveDailyPuzzle } from '@/server/dailySelection';
import { puzzlePool } from '@/server/puzzleRepository';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const STAGE_PATTERN = /^[1-5]$/;
const FINAL_STAGE = 5;

type Clues = {
  day1: {
    landscape: Puzzle['day1']['landscape'];
    metroPopulationMillions: number;
  };
  day2?: {
    referenceCity: string;
    referenceCityCountry: string;
    referenceCityCoordinates: Puzzle['day2']['referenceCityCoordinates'];
    distanceKm: number;
    recognisability: Puzzle['day2']['recognisability'];
  };
  day3?: {
    flagColours: Puzzle['day3']['flagColours'];
  };
  day4?: {
    mapYear: number;
    historicalEntity: string;
  };
  day5?: {
    language: string;
    languageCode: string;
    helpPhrase: string;
  };
};

// Every field is listed out rather than spread from the puzzle, so a field added to the schema
// later cannot leak by default. Days past the requested stage are never assigned, so they are
// absent from the JSON rather than present and null. Provenance URLs are held back until the
// reveal because several of them name the answer outright (".../iceland/reykjavik/",
// ".../wiki/Tiflis_Governorate"), and so is the puzzle id, which is the city name lowercased.
function buildClues(puzzle: Puzzle, stage: number): Clues {
  const clues: Clues = {
    day1: {
      landscape: puzzle.day1.landscape,
      metroPopulationMillions: puzzle.day1.metroPopulationMillions,
    },
  };

  if (stage >= 2) {
    clues.day2 = {
      referenceCity: puzzle.day2.referenceCity,
      referenceCityCountry: puzzle.day2.referenceCityCountry,
      referenceCityCoordinates: puzzle.day2.referenceCityCoordinates,
      distanceKm: puzzle.day2.distanceKm,
      recognisability: puzzle.day2.recognisability,
    };
  }

  if (stage >= 3) {
    clues.day3 = { flagColours: puzzle.day3.flagColours };
  }

  if (stage >= 4) {
    clues.day4 = {
      mapYear: puzzle.day4.mapYear,
      historicalEntity: puzzle.day4.historicalEntity,
    };
  }

  if (stage >= FINAL_STAGE) {
    clues.day5 = {
      language: puzzle.day5.language,
      languageCode: puzzle.day5.languageCode,
      helpPhrase: puzzle.day5.helpPhrase,
    };
  }

  return clues;
}

function buildResolution(puzzle: Puzzle) {
  return {
    city: puzzle.city,
    country: puzzle.country,
    countryCode: puzzle.countryCode,
    geonameId: puzzle.geonameId,
    coordinates: puzzle.coordinates,
    helpPhraseTranslation: puzzle.day5.helpPhraseTranslation,
    populationSource: puzzle.day1.populationSource,
    historicalSourceUrl: puzzle.day4.historicalSourceUrl,
  };
}

// Non-production escape hatch so QA and the "explorer is resting" state can point the app at a
// day other than the real one. Ignored in production, so the live clock can never be faked.
function resolveToday(): string {
  const override = process.env.LOST_EXPLORER_TODAY_OVERRIDE;

  if (process.env.NODE_ENV !== 'production' && override && DATE_PATTERN.test(override)) {
    return override;
  }

  return getPuzzleDayKey();
}

function errorResponse(error: string, status: number): NextResponse {
  return NextResponse.json({ error }, { status, headers: { 'Cache-Control': 'no-store' } });
}

export async function GET(request: Request): Promise<Response> {
  const secret = process.env.LOST_EXPLORER_DAILY_SECRET;

  // Fail closed. Without a secret the dev-mode branch below ships the answer, so a production
  // deploy that forgot to set it must break loudly instead of quietly serving answers.
  if (!secret && process.env.NODE_ENV === 'production') {
    console.error(
      '[api/daily] LOST_EXPLORER_DAILY_SECRET is not set. Refusing to serve: the dev-mode fallback would expose the answer.',
    );
    return errorResponse('Daily puzzle service is misconfigured.', 500);
  }

  const devMode = !secret;
  const signingSecret = secret || 'dev-secret';

  const { searchParams } = new URL(request.url);

  const rawStage = searchParams.get('stage');
  if (rawStage !== null && !STAGE_PATTERN.test(rawStage)) {
    return errorResponse('Invalid stage. Use 1-5.', 400);
  }
  const stage = rawStage === null ? 1 : Number(rawStage);

  const requestedDate = searchParams.get('date');
  if (requestedDate !== null && !DATE_PATTERN.test(requestedDate)) {
    return errorResponse('Invalid date format. Use YYYY-MM-DD.', 400);
  }

  const today = resolveToday();

  // Comparing YYYY-MM-DD as strings is chronological, so no day boundary is recomputed here —
  // that arithmetic belongs to src/domain/dailyClock.ts and nowhere else. A past day is fair
  // game; a future one is the leak this route exists to stop, refused before any clue is read.
  if (requestedDate !== null && requestedDate > today) {
    return errorResponse('Cannot access future puzzles.', 400);
  }

  const dayKey = requestedDate ?? today;
  const isToday = dayKey === today;

  const puzzle = resolveDailyPuzzle(puzzlePool, dayKey, signingSecret);
  if (!puzzle) {
    return errorResponse('No puzzle is published for this date.', 404);
  }

  // Chosen over a separate /api/answer because it is simpler. Requiring stage 5 *and*
  // resolved=true keeps the answer out of every normal game payload. With no accounts there is
  // nothing stronger to verify, so a hand-crafted URL can read today's answer early — accepted,
  // because the leak that matters is future puzzles and the date gate above blocks those.
  const resolution =
    stage === FINAL_STAGE && searchParams.get('resolved') === 'true'
      ? buildResolution(puzzle)
      : undefined;

  // The city for a day is identical for every visitor and fixed until the next UTC midnight, so
  // today's response can sit on the CDN until exactly that rollover and past days can be cached
  // hard. Dev-mode and resolved responses carry the answer, so they are never cached.
  const cacheControl =
    devMode || resolution
      ? 'no-store'
      : isToday
        ? `public, s-maxage=${secondsUntilNextUtcMidnight()}, stale-while-revalidate=60`
        : 'public, max-age=3600, s-maxage=86400';

  return NextResponse.json(
    {
      day: dayKey,
      isToday,
      stage,
      clues: buildClues(puzzle, stage),
      ...(resolution ? { resolved: resolution } : {}),
      ...(devMode
        ? {
            dev: true,
            answer: {
              city: puzzle.city,
              country: puzzle.country,
              coordinates: puzzle.coordinates,
            },
          }
        : {}),
    },
    { headers: { 'Cache-Control': cacheControl } },
  );
}

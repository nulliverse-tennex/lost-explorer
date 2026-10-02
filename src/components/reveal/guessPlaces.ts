'use client';

import { useEffect, useState } from 'react';
import type { MapPlace } from '@/components/map/arcs';
import type { GuessRecord } from '@/domain/gameReducer';
import { loadCityIndex, search } from '@/search/cityIndex';

const NO_PLACES: readonly MapPlace[] = [];

const LOOKUP_LIMIT = 50;

/* A GuessRecord carries no coordinates — guess identity is the geonameid and
   nothing else (gap G3) — so the arcs have to be re-derived from the same city
   index the guess was picked from. An exact primary-name hit ranks first there,
   so the record is always inside LOOKUP_LIMIT; the label fallback covers a
   journal imported with a stale geonameid. */
function locate(guess: GuessRecord): MapPlace | null {
  const matches = search(guess.displayName, LOOKUP_LIMIT);
  const label = `${guess.displayName}, ${guess.country}`;
  const hit =
    matches.find((match) => match.id === guess.geonameId) ??
    matches.find((match) => match.label === label);

  if (!hit) {
    return null;
  }

  return {
    id: String(guess.geonameId),
    name: hit.label,
    lat: hit.lat,
    lng: hit.lng,
  };
}

export function useGuessPlaces(
  guesses: readonly GuessRecord[],
): readonly MapPlace[] {
  const [places, setPlaces] = useState<readonly MapPlace[]>(NO_PLACES);

  useEffect(() => {
    let live = true;

    loadCityIndex()
      .then(() => {
        if (!live) {
          return;
        }
        setPlaces(
          guesses
            .map(locate)
            .filter((place): place is MapPlace => place !== null),
        );
      })
      .catch(() => {
        if (live) {
          setPlaces(NO_PLACES);
        }
      });

    return () => {
      live = false;
    };
  }, [guesses]);

  return places;
}

'use client';

import { Suspense, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import AntiqueWorldMap, { type MapPlace } from '@/components/map/AntiqueWorldMap';

const DEFAULT_TRUE = 'Tbilisi,41.72,44.83';
const DEFAULT_WRONG = 'Paris,48.86,2.35|Cairo,30.04,31.24|Delhi,28.61,77.21';

function parsePlace(raw: string, index: number): MapPlace | null {
  const [name, lat, lng] = raw.split(',');
  const latitude = Number(lat);
  const longitude = Number(lng);
  if (!name || !Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return null;
  }
  return { id: `${index}-${name}`, name, lat: latitude, lng: longitude };
}

function parsePlaces(raw: string): MapPlace[] {
  return raw
    .split('|')
    .map((entry, index) => parsePlace(entry, index + 1))
    .filter((place): place is MapPlace => place !== null);
}

function Chart() {
  const params = useSearchParams();
  const trueRaw = params.get('true') ?? DEFAULT_TRUE;
  const wrongRaw = params.get('wrong') ?? DEFAULT_WRONG;

  const trueCity = useMemo(() => parsePlace(trueRaw, 0), [trueRaw]);
  const wrongGuesses = useMemo(() => parsePlaces(wrongRaw), [wrongRaw]);

  if (!trueCity) {
    return (
      <p className="face-journal mt-5 text-ink-muted" data-testid="bad-input">
        No readable coordinates.
      </p>
    );
  }

  return (
    <figure className="mt-5">
      <AntiqueWorldMap trueCity={trueCity} wrongGuesses={wrongGuesses} />
      <figcaption className="face-journal mt-3 text-ink-muted">
        {trueCity.name} against {wrongGuesses.length} wrong{' '}
        {wrongGuesses.length === 1 ? 'reckoning' : 'reckonings'}.
      </figcaption>
    </figure>
  );
}

export default function MapQaPage() {
  return (
    <main className="stage mx-auto max-w-5xl px-5 py-7">
      <p className="face-stamp text-step--1 text-ink-faint">
        Field Journal &middot; Chart Check
      </p>

      <h1 className="face-display mt-2 text-step-3 text-ink">
        The <span className="text-stamp">Reckoning</span>
      </h1>

      <Suspense fallback={null}>
        <Chart />
      </Suspense>
    </main>
  );
}

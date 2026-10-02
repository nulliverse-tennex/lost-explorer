'use client';

import { useEffect, useState } from 'react';
import {
  isLoaded,
  loadCityIndex,
  search,
  type CitySearchResult,
} from '@/search/cityIndex';

const PROBE_QUERY = 'tbil';

export default function SearchQaPage() {
  const [ready, setReady] = useState(false);
  const [results, setResults] = useState<readonly CitySearchResult[]>([]);

  useEffect(() => {
    let active = true;
    loadCityIndex().then(() => {
      if (active) {
        setReady(isLoaded());
        setResults(search(PROBE_QUERY, 3));
      }
    });
    return () => {
      active = false;
    };
  }, []);

  return (
    <main className="stage mx-auto max-w-xl px-5 py-7">
      <p className="face-stamp text-step--1 text-ink-faint">
        Field Journal &middot; Index Check
      </p>

      <h1 className="face-display mt-2 text-step-4 text-ink">
        The <span className="text-stamp">Gazetteer</span>
      </h1>

      <p className="face-journal mt-4 text-ink-muted">
        The index is{' '}
        <span data-testid="index-status">{ready ? 'ready' : 'loading'}</span>.
      </p>

      <ol data-testid="probe-results" className="face-ui mt-5 text-step--1 text-ink">
        {results.map((result) => (
          <li key={result.id} data-city-id={result.id}>
            {result.label}
          </li>
        ))}
      </ol>
    </main>
  );
}

'use client';

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from 'react';
import type { DayNumber, GuessCandidate } from '@/domain/gameReducer';
import {
  MIN_QUERY_LENGTH,
  isLoaded,
  loadCityIndex,
  search,
  type CitySearchResult,
} from '@/search/cityIndex';
import { ActionRow } from './ActionRow';
import { CityDropdown, cityOptionId, type CityOption } from './CityDropdown';
import styles from './guess.module.css';

const MAX_OPTIONS = 8;

type IndexStatus = 'loading' | 'ready' | 'failed';

export function GuessInput({
  day,
  guessedIds,
  onGuess,
  onContinue,
  locked = false,
}: {
  day: DayNumber;
  guessedIds: readonly number[];
  onGuess: (candidate: GuessCandidate) => void;
  onContinue: () => void;
  locked?: boolean;
}) {
  const idPrefix = useId();
  const listboxId = `${idPrefix}-listbox`;

  const [status, setStatus] = useState<IndexStatus>('loading');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<CitySearchResult | null>(null);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  useEffect(() => {
    let live = true;
    loadCityIndex().then(
      () => {
        if (live) {
          setStatus(isLoaded() ? 'ready' : 'failed');
        }
      },
      () => {
        if (live) {
          setStatus('failed');
        }
      },
    );
    return () => {
      live = false;
    };
  }, []);

  const options = useMemo<readonly CityOption[]>(() => {
    if (status !== 'ready' || query.trim().length < MIN_QUERY_LENGTH) {
      return [];
    }
    return search(query, MAX_OPTIONS).map((result) => ({
      ...result,
      alreadyGuessed: guessedIds.includes(result.id),
    }));
  }, [status, query, guessedIds]);

  const expanded = open && options.length > 0;
  const selectedIsSpent = selected !== null && guessedIds.includes(selected.id);
  const canSubmit =
    status === 'ready' && !locked && selected !== null && !selectedIsSpent;

  const pick = useCallback((option: CityOption) => {
    if (option.alreadyGuessed) {
      return;
    }
    setQuery(option.label);
    setSelected(option);
    setOpen(false);
    setActiveIndex(-1);
  }, []);

  // Wraps, and steps over already-guessed rows so the arrow keys can never
  // land on an option that Enter would then silently refuse.
  const nextSelectable = (from: number, step: number): number => {
    const count = options.length;
    for (let hop = 1; hop <= count; hop += 1) {
      const index = (((from + step * hop) % count) + count) % count;
      if (options[index]?.alreadyGuessed === false) {
        return index;
      }
    }
    return -1;
  };

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (options.length === 0) {
        return;
      }
      const step = event.key === 'ArrowDown' ? 1 : -1;
      const from = activeIndex < 0 ? (step > 0 ? -1 : 0) : activeIndex;
      setOpen(true);
      setActiveIndex(nextSelectable(from, step));
      return;
    }

    if (event.key === 'Enter') {
      if (expanded && activeIndex >= 0) {
        event.preventDefault();
        const option = options[activeIndex];
        if (option !== undefined) {
          pick(option);
        }
      }
      return;
    }

    if (event.key === 'Escape') {
      event.preventDefault();
      if (expanded) {
        setOpen(false);
        setActiveIndex(-1);
        return;
      }
      setQuery('');
      setSelected(null);
      setActiveIndex(-1);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit || selected === null) {
      return;
    }
    onGuess({
      geonameId: selected.id,
      displayName: selected.name,
      country: selected.country,
      lat: selected.lat,
      lng: selected.lng,
    });
    setQuery('');
    setSelected(null);
    setOpen(false);
    setActiveIndex(-1);
  }

  return (
    <form className={styles.composer} onSubmit={handleSubmit} noValidate>
      <label className={styles.label} htmlFor={`${idPrefix}-field`}>
        <span>Day {day} &middot; name the city</span>
        <span className={styles.labelLeader} aria-hidden="true" />
      </label>

      <div className={styles.fieldWrap}>
        {expanded ? (
          <CityDropdown
            listboxId={listboxId}
            idPrefix={idPrefix}
            options={options}
            activeIndex={activeIndex}
            onPick={pick}
            onPointerActivate={setActiveIndex}
          />
        ) : null}

        <input
          id={`${idPrefix}-field`}
          className={styles.field}
          type="text"
          role="combobox"
          autoComplete="off"
          autoCapitalize="words"
          spellCheck={false}
          enterKeyHint="search"
          aria-autocomplete="list"
          aria-controls={listboxId}
          aria-expanded={expanded}
          aria-activedescendant={
            expanded && activeIndex >= 0
              ? cityOptionId(idPrefix, activeIndex)
              : undefined
          }
          disabled={status !== 'ready' || locked}
          placeholder={
            status === 'ready' ? 'Tbilisi, Valparaíso, Hội An…' : 'one moment…'
          }
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setSelected(null);
            setOpen(true);
            setActiveIndex(-1);
          }}
          onKeyDown={handleKeyDown}
          onBlur={() => {
            setOpen(false);
            setActiveIndex(-1);
          }}
        />
      </div>

      <p className={styles.note} data-testid="guess-hint">
        {hintFor({ status, locked, selected, selectedIsSpent, query })}
      </p>

      <p role="status" aria-live="polite" className={styles.srOnly}>
        {announce({ status, expanded, optionCount: options.length, selected, query })}
      </p>

      <ActionRow day={day} canSubmit={canSubmit} onContinue={onContinue} />
    </form>
  );
}

function hintFor({
  status,
  locked,
  selected,
  selectedIsSpent,
  query,
}: {
  status: IndexStatus;
  locked: boolean;
  selected: CitySearchResult | null;
  selectedIsSpent: boolean;
  query: string;
}): string {
  if (status === 'loading') {
    return 'Unpacking the gazetteer…';
  }
  if (status === 'failed') {
    return 'The gazetteer would not open. Reload the page to try again.';
  }
  if (locked) {
    return 'This day’s guess is already spent.';
  }
  if (selectedIsSpent) {
    return 'You have already spent a guess on that city.';
  }
  if (selected !== null) {
    return `Marked: ${selected.label}.`;
  }
  if (query.trim().length === 0) {
    return 'Type a city, then pick it from the list.';
  }
  return 'Pick a city from the list — typed text alone will not do.';
}

function announce({
  status,
  expanded,
  optionCount,
  selected,
  query,
}: {
  status: IndexStatus;
  expanded: boolean;
  optionCount: number;
  selected: CitySearchResult | null;
  query: string;
}): string {
  if (status !== 'ready') {
    return '';
  }
  if (selected !== null) {
    return `${selected.label} selected.`;
  }
  if (expanded) {
    return `${optionCount} ${optionCount === 1 ? 'city' : 'cities'} found.`;
  }
  if (query.trim().length >= MIN_QUERY_LENGTH) {
    return 'No cities match.';
  }
  return '';
}

'use client';

import { useEffect, useRef } from 'react';
import type { CitySearchResult } from '@/search/cityIndex';
import { cls } from './cls';
import styles from './guess.module.css';

export interface CityOption extends CitySearchResult {
  readonly alreadyGuessed: boolean;
}

export function cityOptionId(prefix: string, index: number): string {
  return `${prefix}-option-${index}`;
}

export function CityDropdown({
  listboxId,
  idPrefix,
  options,
  activeIndex,
  onPick,
  onPointerActivate,
}: {
  listboxId: string;
  idPrefix: string;
  options: readonly CityOption[];
  activeIndex: number;
  onPick: (option: CityOption) => void;
  onPointerActivate: (index: number) => void;
}) {
  const listRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    if (activeIndex < 0) {
      return;
    }
    listRef.current
      ?.querySelector<HTMLElement>('[data-active="true"]')
      ?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex]);

  return (
    <ul
      ref={listRef}
      id={listboxId}
      role="listbox"
      aria-label="Matching cities"
      className={styles.listbox}
    >
      {options.map((option, index) => {
        const active = index === activeIndex;
        return (
          <li
            key={option.id}
            id={cityOptionId(idPrefix, index)}
            role="option"
            aria-selected={active}
            aria-disabled={option.alreadyGuessed || undefined}
            data-active={active}
            data-city-id={option.id}
            data-already-guessed={option.alreadyGuessed || undefined}
            className={cls(
              styles.option,
              option.alreadyGuessed && styles.optionSpent,
            )}
            // pointerdown, and prevented: a click would blur the combobox
            // first, closing this list before the pick could be read.
            onPointerDown={(event) => {
              event.preventDefault();
              onPick(option);
            }}
            onPointerMove={() => {
              if (!option.alreadyGuessed) {
                onPointerActivate(index);
              }
            }}
          >
            <span className={styles.optionName}>{option.name}</span>
            <span className={styles.optionCountry}>{option.country}</span>
            {option.alreadyGuessed ? (
              <span className={styles.optionSpentMark}>already guessed</span>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

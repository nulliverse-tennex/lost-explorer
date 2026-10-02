import { describe, it, expect } from 'bun:test';
import { toSearchKey, matchesAnyAlias } from './normalize';

// Every row here is a named Unicode failure mode, not a sample.
const CITY_TABLE: ReadonlyArray<readonly [string, string]> = [
  ['København', 'kobenhavn'], // ø has no NFD decomposition
  ['Łódź', 'lodz'], // ł has no NFD decomposition; ó and ź do
  ['Reykjavík', 'reykjavik'],
  ['München', 'munchen'],
  ['Malmö', 'malmo'],
  ['Tromsø', 'tromso'],
  ['Đà Nẵng', 'da nang'], // Đ has no NFD decomposition; ẵ is double-marked
  ['İzmir', 'izmir'], // U+0130 lowercases to i + U+0307
  ['Kraków', 'krakow'],
  ['Mỹ Tho', 'my tho'],
];

const FOLD_TABLE: ReadonlyArray<readonly [string, string]> = [
  ['ø', 'o'],
  ['Ø', 'o'],
  ['ł', 'l'],
  ['Ł', 'l'],
  ['đ', 'd'],
  ['Đ', 'd'],
  ['ß', 'ss'],
  ['æ', 'ae'],
  ['Æ', 'ae'],
  ['œ', 'oe'],
  ['Œ', 'oe'],
  ['þ', 'th'],
  ['Þ', 'th'],
  ['ð', 'd'],
  ['Ð', 'd'],
  ['ı', 'i'],
  ['İ', 'i'],
  ['ħ', 'h'],
  ['ŋ', 'n'],
];

describe('toSearchKey city-name table', () => {
  for (const [input, expected] of CITY_TABLE) {
    it(`maps ${input} to ${expected}`, () => {
      expect(toSearchKey(input)).toBe(expected);
    });
  }
});

describe('toSearchKey fold map', () => {
  for (const [input, expected] of FOLD_TABLE) {
    it(`folds ${input} to ${expected}`, () => {
      expect(toSearchKey(input)).toBe(expected);
    });
  }

  it('leaves no non-decomposing letter unfolded in a mixed string', () => {
    expect(toSearchKey('Øłđßæœþðıİħŋ')).toBe('oldssaeoethdiihn');
  });
});

describe('toSearchKey punctuation and whitespace', () => {
  it('strips periods', () => {
    expect(toSearchKey('St. Louis')).toBe('st louis');
  });

  it('strips apostrophes, both ASCII and typographic', () => {
    expect(toSearchKey("N'Djamena")).toBe('ndjamena');
    expect(toSearchKey('N\u2019Djamena')).toBe('ndjamena');
  });

  it('strips hyphens and unicode dashes', () => {
    expect(toSearchKey('Vitoria-Gasteiz')).toBe('vitoriagasteiz');
    expect(toSearchKey('Port\u2010au\u2010Prince')).toBe('portauprince');
  });

  it('collapses runs of whitespace and trims', () => {
    expect(toSearchKey('  Rio   de \t Janeiro \n')).toBe('rio de janeiro');
  });

  it('does not lose the word boundary in multi-word names', () => {
    expect(toSearchKey('Buenos Aires')).toBe('buenos aires');
  });
});

describe('toSearchKey invariants', () => {
  const ALL_INPUTS = [
    ...CITY_TABLE.map(([input]) => input),
    ...FOLD_TABLE.map(([input]) => input),
    'St. Louis',
    "N'Djamena",
    'Vitoria-Gasteiz',
    '  Rio   de \t Janeiro \n',
    'Buenos Aires',
    'Øłđßæœþðıİħŋ',
    '北京',
    'Αθήνα',
    'Київ',
  ];

  for (const input of ALL_INPUTS) {
    it(`is idempotent for ${JSON.stringify(input)}`, () => {
      const once = toSearchKey(input);
      expect(toSearchKey(once)).toBe(once);
    });
  }

  it('never returns an empty string for a non-empty run of letters', () => {
    for (const input of ALL_INPUTS) {
      expect(toSearchKey(input).length).toBeGreaterThan(0);
    }
  });

  it('returns an empty string for empty or punctuation-only input', () => {
    expect(toSearchKey('')).toBe('');
    expect(toSearchKey('   ')).toBe('');
    expect(toSearchKey('--.')).toBe('');
  });

  it('is case-insensitive', () => {
    expect(toSearchKey('IZMIR')).toBe(toSearchKey('izmir'));
    expect(toSearchKey('KØBENHAVN')).toBe(toSearchKey('københavn'));
  });

  it('preserves non-Latin scripts rather than dropping them', () => {
    expect(toSearchKey('北京')).toBe('北京');
    expect(toSearchKey('Αθήνα')).toBe('αθηνα');
  });
});

describe('toSearchKey is exact normalization, not fuzzy matching', () => {
  it('does not equate distinct names that differ by more than diacritics', () => {
    expect(toSearchKey('Kyiv')).not.toBe(toSearchKey('Kiev'));
    expect(toSearchKey('München')).not.toBe(toSearchKey('Munich'));
  });

  it('does not tolerate typos', () => {
    expect(toSearchKey('Krakow')).not.toBe(toSearchKey('Krakov'));
  });
});

describe('matchesAnyAlias', () => {
  const kyivAliases = ['kyiv', 'kiev', 'kyyiv'];

  it('returns true when the key is one of the alias keys', () => {
    expect(matchesAnyAlias(toSearchKey('Kiev'), kyivAliases)).toBe(true);
    expect(matchesAnyAlias(toSearchKey('KYIV'), kyivAliases)).toBe(true);
  });

  it('returns false when the key is not an alias', () => {
    expect(matchesAnyAlias(toSearchKey('Lviv'), kyivAliases)).toBe(false);
  });

  it('returns false for an empty alias list', () => {
    expect(matchesAnyAlias('kyiv', [])).toBe(false);
  });

  it('returns false for an empty search key even if aliases exist', () => {
    expect(matchesAnyAlias('', kyivAliases)).toBe(false);
  });

  it('normalizes the incoming search key defensively so callers cannot pass raw text', () => {
    expect(matchesAnyAlias('København', ['kobenhavn'])).toBe(true);
  });
});

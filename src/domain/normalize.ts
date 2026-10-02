// NFD decomposition silently does nothing for letters with no canonical
// decomposition, so these must be folded by hand or they survive unchanged
// ("københavn" instead of "kobenhavn"). Uppercase forms are included so the map
// stays correct regardless of whether lowercasing ran first.
const FOLD_MAP: Readonly<Record<string, string>> = {
  ø: 'o',
  Ø: 'o',
  ł: 'l',
  Ł: 'l',
  đ: 'd',
  Đ: 'd',
  ß: 'ss',
  æ: 'ae',
  Æ: 'ae',
  œ: 'oe',
  Œ: 'oe',
  þ: 'th',
  Þ: 'th',
  ð: 'd',
  Ð: 'd',
  ı: 'i',
  İ: 'i',
  ħ: 'h',
  ŋ: 'n',
};

const COMBINING_MARKS = /\p{M}/gu;
const PUNCTUATION = /[\p{P}\p{S}]/gu;
const WHITESPACE_RUN = /\s+/gu;

// Plain `toLowerCase` only. A locale-aware lowercase maps I to ı under Turkish,
// which would make the key depend on the runtime locale.
export function toSearchKey(s: string): string {
  const unmarked = s.toLowerCase().normalize('NFD').replace(COMBINING_MARKS, '');
  return [...unmarked]
    .map((ch) => FOLD_MAP[ch] ?? ch)
    .join('')
    .replace(PUNCTUATION, '')
    .replace(WHITESPACE_RUN, ' ')
    .trim();
}

// Kyiv/Kiev, München/Munich and Firenze/Florence are ALIAS problems, solved by
// the GeoNames alternateNames join in the city-pool build. They are deliberately
// not in FOLD_MAP and must never be added to it.
export function matchesAnyAlias(
  searchKey: string,
  aliasSearchKeys: readonly string[],
): boolean {
  const key = toSearchKey(searchKey);
  return key.length > 0 && aliasSearchKeys.some((alias) => toSearchKey(alias) === key);
}

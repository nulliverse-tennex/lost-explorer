import { describe, it, expect } from 'bun:test';
import {
  populationDescription,
  formatPopulation,
  formatDistance,
  renderDay1,
  renderDay2,
  renderDay3,
  renderDay4,
  renderDay5,
} from './clueText';
import type { Puzzle } from './puzzle';

describe('populationDescription', () => {
  // Test band boundaries exactly as per initial.txt:138-146
  it('returns "small" for values under 0.2', () => {
    expect(populationDescription(0.19)).toBe('small');
    expect(populationDescription(0.1)).toBe('small');
  });

  it('returns "fairly small" for 0.2-0.5', () => {
    expect(populationDescription(0.2)).toBe('fairly small');
    expect(populationDescription(0.35)).toBe('fairly small');
    expect(populationDescription(0.49)).toBe('fairly small');
  });

  it('returns "medium-sized" for 0.5-1', () => {
    expect(populationDescription(0.5)).toBe('medium-sized');
    expect(populationDescription(0.75)).toBe('medium-sized');
    expect(populationDescription(0.99)).toBe('medium-sized');
  });

  it('returns "fairly busy" for 1-2', () => {
    expect(populationDescription(1)).toBe('fairly busy');
    expect(populationDescription(1.5)).toBe('fairly busy');
    expect(populationDescription(1.99)).toBe('fairly busy');
  });

  it('returns "big" for 2-5', () => {
    expect(populationDescription(2)).toBe('big');
    expect(populationDescription(3.5)).toBe('big');
    expect(populationDescription(4.99)).toBe('big');
  });

  it('returns "huge" for 5-10', () => {
    expect(populationDescription(5)).toBe('huge');
    expect(populationDescription(7.5)).toBe('huge');
    expect(populationDescription(9.99)).toBe('huge');
  });

  it('returns "enormous" for 10+', () => {
    expect(populationDescription(10)).toBe('enormous');
    expect(populationDescription(14)).toBe('enormous');
    expect(populationDescription(20)).toBe('enormous');
  });
});

describe('formatPopulation', () => {
  // Test exact examples from initial.txt:152-158
  it('formats 0.18 as "0.2 million"', () => {
    expect(formatPopulation(0.18)).toBe('0.2 million');
  });

  it('formats 0.74 as "0.7 million"', () => {
    expect(formatPopulation(0.74)).toBe('0.7 million');
  });

  it('formats 1.26 as "1.3 million"', () => {
    expect(formatPopulation(1.26)).toBe('1.3 million');
  });

  it('formats 4.7 as "approximately 5 million"', () => {
    expect(formatPopulation(4.7)).toBe('approximately 5 million');
  });

  it('formats 13.8 as "approximately 14 million"', () => {
    expect(formatPopulation(13.8)).toBe('approximately 14 million');
  });

  // Additional boundary tests
  it('uses one decimal for values < 2', () => {
    expect(formatPopulation(0.5)).toBe('0.5 million');
    expect(formatPopulation(1.9)).toBe('1.9 million');
  });

  it('uses "approximately N million" for values >= 2', () => {
    expect(formatPopulation(2)).toMatch(/^approximately \d+ million$/);
    expect(formatPopulation(5)).toMatch(/^approximately \d+ million$/);
    expect(formatPopulation(10)).toMatch(/^approximately \d+ million$/);
  });
});

describe('formatDistance', () => {
  it('avoids false precision like 173.4 km', () => {
    const result = formatDistance(173.4);
    expect(result).not.toContain('.');
  });

  it('rounds to nearest 10 under 500 km', () => {
    expect(formatDistance(100)).toBe('100 km');
    expect(formatDistance(104)).toBe('100 km');
    expect(formatDistance(105)).toBe('110 km');
    expect(formatDistance(250)).toBe('250 km');
  });

  it('rounds to nearest 50 under 2000 km', () => {
    expect(formatDistance(500)).toBe('500 km');
    expect(formatDistance(524)).toBe('500 km');
    expect(formatDistance(525)).toBe('550 km');
    expect(formatDistance(1000)).toBe('1000 km');
  });

  it('rounds to nearest 100 above 2000 km', () => {
    expect(formatDistance(2000)).toBe('2000 km');
    expect(formatDistance(2049)).toBe('2000 km');
    expect(formatDistance(2050)).toBe('2100 km');
    expect(formatDistance(10000)).toBe('10000 km');
  });
});

describe('renderDay1', () => {
  const basePuzzle: Puzzle = {
    id: 'test-1',
    city: 'Test City',
    country: 'Test Country',
    countryCode: 'TC',
    geonameId: 123456,
    coordinates: { lat: 0, lng: 0 },
    publishDate: '2026-01-01',
    day1: {
      landscape: 'hilly',
      metroPopulationMillions: 1.2,
      populationSource: {
        name: 'Test Source',
        url: 'https://example.com',
        asOfYear: 2020,
      },
    },
    day2: {
      referenceCity: 'Reference',
      referenceCityCountry: 'Ref Country',
      referenceCityCoordinates: { lat: 0, lng: 0 },
      distanceKm: 100,
      recognisability: 'global',
    },
    day3: { flagColours: ['red'] },
    day4: {
      mapYear: 1900,
      historicalEntity: 'Empire',
      historicalSourceUrl: 'https://example.com',
    },
    day5: {
      language: 'Test',
      languageCode: 'ts',
      helpPhrase: 'Help?',
      helpPhraseTranslation: 'Do you need help?',
    },
  };

  it('returns a string containing landscape and population', () => {
    const result = renderDay1(basePuzzle);
    expect(typeof result).toBe('string');
    expect(result).toContain('hilly');
    expect(result).toContain('1.2 million');
  });

  it('uses the Day 1 template structure', () => {
    const result = renderDay1(basePuzzle);
    expect(result).toContain("I've had a look around");
    expect(result).toContain('fairly busy');
  });
});

describe('renderDay2', () => {
  const basePuzzle: Puzzle = {
    id: 'test-2',
    city: 'Test City',
    country: 'Test Country',
    countryCode: 'TC',
    geonameId: 123456,
    coordinates: { lat: 0, lng: 0 },
    publishDate: '2026-01-01',
    day1: {
      landscape: 'flat',
      metroPopulationMillions: 0.5,
      populationSource: {
        name: 'Test Source',
        url: 'https://example.com',
        asOfYear: 2020,
      },
    },
    day2: {
      referenceCity: 'Yerevan',
      referenceCityCountry: 'Armenia',
      referenceCityCoordinates: { lat: 40.1, lng: 44.5 },
      distanceKm: 170,
      recognisability: 'global',
    },
    day3: { flagColours: ['red'] },
    day4: {
      mapYear: 1900,
      historicalEntity: 'Empire',
      historicalSourceUrl: 'https://example.com',
    },
    day5: {
      language: 'Test',
      languageCode: 'ts',
      helpPhrase: 'Help?',
      helpPhraseTranslation: 'Do you need help?',
    },
  };

  it('returns a string with reference city and distance', () => {
    const result = renderDay2(basePuzzle);
    expect(typeof result).toBe('string');
    expect(result).toContain('Yerevan');
    expect(result).toContain('170 km');
  });

  it('uses the Day 2 template structure', () => {
    const result = renderDay2(basePuzzle);
    expect(result).toContain('I found a sign');
    expect(result).toContain('is about');
  });
});

describe('renderDay3', () => {
  const basePuzzle: Puzzle = {
    id: 'test-3',
    city: 'Test City',
    country: 'Test Country',
    countryCode: 'TC',
    geonameId: 123456,
    coordinates: { lat: 0, lng: 0 },
    publishDate: '2026-01-01',
    day1: {
      landscape: 'flat',
      metroPopulationMillions: 0.5,
      populationSource: {
        name: 'Test Source',
        url: 'https://example.com',
        asOfYear: 2020,
      },
    },
    day2: {
      referenceCity: 'Reference',
      referenceCityCountry: 'Ref Country',
      referenceCityCoordinates: { lat: 0, lng: 0 },
      distanceKm: 100,
      recognisability: 'global',
    },
    day3: { flagColours: ['red'] },
    day4: {
      mapYear: 1900,
      historicalEntity: 'Empire',
      historicalSourceUrl: 'https://example.com',
    },
    day5: {
      language: 'Test',
      languageCode: 'ts',
      helpPhrase: 'Help?',
      helpPhraseTranslation: 'Do you need help?',
    },
  };

  it('renders one colour correctly', () => {
    const result = renderDay3(basePuzzle);
    expect(result).toContain('red');
    expect(result).toContain('and no other colours');
  });

  it('renders two colours with "and"', () => {
    const puzzle = { ...basePuzzle, day3: { flagColours: ['red', 'white'] } };
    const result = renderDay3(puzzle);
    expect(result).toContain('red and white');
    expect(result).toContain('and no other colours');
  });

  it('renders three colours with serial comma absent', () => {
    const puzzle = { ...basePuzzle, day3: { flagColours: ['red', 'white', 'blue'] } };
    const result = renderDay3(puzzle);
    // Should be "red, white and blue" (no serial comma before "and")
    expect(result).toContain('red, white and blue');
    expect(result).toContain('and no other colours');
  });

  it('uses the Day 3 template structure', () => {
    const result = renderDay3(basePuzzle);
    expect(result).toContain('I saw a flag');
  });
});

describe('renderDay4', () => {
  const basePuzzle: Puzzle = {
    id: 'test-4',
    city: 'Tbilisi',
    country: 'Georgia',
    countryCode: 'GE',
    geonameId: 611717,
    coordinates: { lat: 41.7151, lng: 44.8271 },
    publishDate: '2026-01-01',
    day1: {
      landscape: 'mountainous',
      metroPopulationMillions: 1.2,
      populationSource: {
        name: 'Test Source',
        url: 'https://example.com',
        asOfYear: 2020,
      },
    },
    day2: {
      referenceCity: 'Yerevan',
      referenceCityCountry: 'Armenia',
      referenceCityCoordinates: { lat: 40.1, lng: 44.5 },
      distanceKm: 170,
      recognisability: 'global',
    },
    day3: { flagColours: ['red', 'white'] },
    day4: {
      mapYear: 1900,
      historicalEntity: 'Russian Empire',
      historicalSourceUrl: 'https://example.com/history',
    },
    day5: {
      language: 'Georgian',
      languageCode: 'ka',
      helpPhrase: 'დახმარება ხომ არ გჭირდება?',
      helpPhraseTranslation: 'Do you need help?',
    },
  };

  it('returns a string with year and historical entity', () => {
    const result = renderDay4(basePuzzle);
    expect(typeof result).toBe('string');
    expect(result).toContain('1900');
    expect(result).toContain('Russian Empire');
  });

  it('uses the Day 4 template structure', () => {
    const result = renderDay4(basePuzzle);
    expect(result).toContain('I found an old map');
    expect(result).toContain('was part of');
  });
});

describe('renderDay5', () => {
  const basePuzzle: Puzzle = {
    id: 'test-5',
    city: 'Tbilisi',
    country: 'Georgia',
    countryCode: 'GE',
    geonameId: 611717,
    coordinates: { lat: 41.7151, lng: 44.8271 },
    publishDate: '2026-01-01',
    day1: {
      landscape: 'mountainous',
      metroPopulationMillions: 1.2,
      populationSource: {
        name: 'Test Source',
        url: 'https://example.com',
        asOfYear: 2020,
      },
    },
    day2: {
      referenceCity: 'Yerevan',
      referenceCityCountry: 'Armenia',
      referenceCityCoordinates: { lat: 40.1, lng: 44.5 },
      distanceKm: 170,
      recognisability: 'global',
    },
    day3: { flagColours: ['red', 'white'] },
    day4: {
      mapYear: 1900,
      historicalEntity: 'Russian Empire',
      historicalSourceUrl: 'https://example.com/history',
    },
    day5: {
      language: 'Georgian',
      languageCode: 'ka',
      helpPhrase: 'დახმარება ხომ არ გჭირდება?',
      helpPhraseTranslation: 'Do you need help?',
    },
  };

  it('returns a string containing the help phrase', () => {
    const result = renderDay5(basePuzzle);
    expect(typeof result).toBe('string');
    expect(result).toContain('დახმარება ხომ არ გჭირდება?');
  });

  it('does NOT contain the English translation before guess', () => {
    const result = renderDay5(basePuzzle);
    expect(result.toLowerCase()).not.toContain('do you need help');
  });

  it('does NOT contain place names (Georgia, Tbilisi)', () => {
    const result = renderDay5(basePuzzle);
    expect(result).not.toContain('Georgia');
    expect(result).not.toContain('Tbilisi');
  });

  it('uses the Day 5 template structure', () => {
    const result = renderDay5(basePuzzle);
    expect(result).toContain('Someone finally noticed');
    expect(result).toContain('FINAL GUESS');
  });
});

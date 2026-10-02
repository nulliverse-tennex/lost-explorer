import { PuzzleSchema } from '../src/domain/puzzle';

const validPuzzle = {
  id: 'tbilisi-001',
  city: 'Tbilisi',
  country: 'Georgia',
  countryCode: 'GE',
  geonameId: 611717,
  coordinates: {
    lat: 41.7151,
    lng: 44.8271,
  },
  publishDate: '2024-01-01',
  day1: {
    landscape: 'mountains-surrounding',
    metroPopulationMillions: 1.2,
    populationSource: {
      name: 'UN World Urbanization Prospects',
      url: 'https://population.un.org/wup/',
      asOfYear: 2023,
    },
  },
  day2: {
    referenceCity: 'Yerevan',
    referenceCityCountry: 'Armenia',
    referenceCityCoordinates: {
      lat: 40.1792,
      lng: 44.5086,
    },
    distanceKm: 170,
    recognisability: 'regional',
  },
  day3: {
    flagColours: ['red', 'white', 'black'],
  },
  day4: {
    mapYear: 1900,
    historicalEntity: 'the Russian Empire',
    historicalSourceUrl: 'https://example.com/source',
  },
  day5: {
    language: 'Georgian',
    languageCode: 'ka',
    helpPhrase: 'დახმარება ხომ არ გჭირდება?',
    helpPhraseTranslation: 'Do you need help?',
  },
};

let passed = 0;
let failed = 0;

// Test 1: Valid puzzle
const result1 = PuzzleSchema.safeParse(validPuzzle);
if (result1.success) {
  console.log('✓ Test 1: Valid puzzle accepted');
  passed++;
} else {
  console.log('✗ Test 1: Valid puzzle rejected');
  console.log(result1.error);
  failed++;
}

// Test 2: Missing historicalSourceUrl (required)
const missingSourceUrl = { ...validPuzzle, day4: { ...validPuzzle.day4, historicalSourceUrl: undefined } };
const result2 = PuzzleSchema.safeParse(missingSourceUrl);
if (!result2.success) {
  console.log('✓ Test 2: Missing historicalSourceUrl rejected');
  passed++;
} else {
  console.log('✗ Test 2: Missing historicalSourceUrl accepted (should reject)');
  failed++;
}

// Test 3: Invalid landscape enum
const invalidLandscape = { ...validPuzzle, day1: { ...validPuzzle.day1, landscape: 'banana' } };
const result3 = PuzzleSchema.safeParse(invalidLandscape);
if (!result3.success) {
  console.log('✓ Test 3: Invalid landscape enum rejected');
  passed++;
} else {
  console.log('✗ Test 3: Invalid landscape enum accepted (should reject)');
  failed++;
}

// Test 4: Invalid coordinates (lat > 90)
const invalidCoords = { ...validPuzzle, coordinates: { lat: 200, lng: 44.8271 } };
const result4 = PuzzleSchema.safeParse(invalidCoords);
if (!result4.success) {
  console.log('✓ Test 4: Invalid coordinates rejected');
  passed++;
} else {
  console.log('✗ Test 4: Invalid coordinates accepted (should reject)');
  failed++;
}

console.log(`\nResults: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);

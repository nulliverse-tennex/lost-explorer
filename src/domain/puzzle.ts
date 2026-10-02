import { z } from 'zod';

// Day 1 landscape enum from initial.txt:160-177
const LandscapeEnum = z.enum([
  'flat',
  'hilly',
  'mountainous',
  'mountains-visible',
  'mountains-surrounding',
  'coastal',
  'lakeside',
  'river',
  'dry',
  'tropical',
  'green-hills',
  'desert',
  'high-altitude',
]);

// Population source with provenance (gap P9)
const PopulationSourceSchema = z.object({
  name: z.string().min(1),
  url: z.string().url(),
  asOfYear: z.number().int().min(1900).max(2100),
});

// Day 1 clue
const Day1Schema = z.object({
  landscape: LandscapeEnum,
  metroPopulationMillions: z.number().positive(),
  populationSource: PopulationSourceSchema,
});

// Day 2 clue (gap P3: recognisability tier)
const RecognisabilityEnum = z.enum(['global', 'regional']);

const Day2Schema = z.object({
  referenceCity: z.string().min(1),
  referenceCityCountry: z.string().min(1),
  referenceCityCoordinates: z.object({
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
  }),
  distanceKm: z.number().positive(),
  recognisability: RecognisabilityEnum,
});

// Day 3 clue (decision P2: full colour set, not single colour)
const ColourEnum = z.enum([
  'red',
  'white',
  'blue',
  'green',
  'yellow',
  'orange',
  'purple',
  'black',
  'brown',
  'pink',
  'gray',
  'gold',
  'silver',
  'cyan',
  'magenta',
]);

const Day3Schema = z.object({
  flagColours: z.array(ColourEnum).min(1),
});

// Day 4 clue (gap P10: required source URL)
const Day4Schema = z.object({
  mapYear: z.number().int().min(1000).max(2100),
  historicalEntity: z.string().min(1),
  historicalSourceUrl: z.string().url(),
});

// Day 5 clue
const Day5Schema = z.object({
  language: z.string().min(1),
  languageCode: z.string().length(2).or(z.string().length(3)),
  helpPhrase: z.string().min(1),
  helpPhraseTranslation: z.string().min(1),
});

// Full puzzle schema
export const PuzzleSchema = z.object({
  id: z.string().min(1),
  city: z.string().min(1),
  country: z.string().min(1),
  countryCode: z.string().length(2),
  geonameId: z.number().int().positive(),
  coordinates: z.object({
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
  }),
  publishDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  day1: Day1Schema,
  day2: Day2Schema,
  day3: Day3Schema,
  day4: Day4Schema,
  day5: Day5Schema,
});

export type Puzzle = z.infer<typeof PuzzleSchema>;

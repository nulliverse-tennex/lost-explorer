import { z } from 'zod';

// Gap G3: All guess identity keyed on geonameId, never on display string
const GeonameIdBrand = z.number().int().positive().brand<'GeonameId'>();

const GuessRecordSchema = z.object({
  geonameId: GeonameIdBrand,
  displayName: z.string().min(1),
  country: z.string().min(1),
  distanceKm: z.number().nonnegative(),
  band: z.enum(['very-close', 'close', 'far', 'very-far']),
  dayGuessed: z.number().int().min(1).max(5),
});

export type GuessRecord = z.infer<typeof GuessRecordSchema>;
export type GeonameId = z.infer<typeof GeonameIdBrand>;

const GameStatusEnum = z.enum(['in_progress', 'won', 'lost']);

export const DailyGameStateSchema = z.object({
  dayKey: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  currentDay: z.number().int().min(1).max(5),
  guesses: z.record(z.string(), GuessRecordSchema),
  status: GameStatusEnum,
  startedAtMs: z.number().int().nonnegative(),
});

export type DailyGameState = z.infer<typeof DailyGameStateSchema>;

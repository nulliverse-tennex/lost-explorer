import { PuzzleSchema, type Puzzle } from '@/domain/puzzle';

import barcelona from '../../content/puzzles/barcelona.json';
import cusco from '../../content/puzzles/cusco.json';
import hanoi from '../../content/puzzles/hanoi.json';
import reykjavik from '../../content/puzzles/reykjavik.json';
import sarajevo from '../../content/puzzles/sarajevo.json';
import tbilisi from '../../content/puzzles/tbilisi.json';

// Imported rather than read with fs: Next.js cannot trace a runtime readdir under
// process.cwd(), so a disk read works locally and 404s every puzzle once deployed. Adding a
// puzzle means adding a line here, which is fine while authoring is hand-edited JSON.
const PUZZLE_SOURCES: readonly unknown[] = [
  barcelona,
  cusco,
  hanoi,
  reykjavik,
  sarajevo,
  tbilisi,
];

export const puzzlePool: readonly Puzzle[] = PUZZLE_SOURCES.map((source) =>
  PuzzleSchema.parse(source),
);

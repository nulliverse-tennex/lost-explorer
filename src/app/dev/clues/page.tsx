import type { Metadata } from "next";
import { Day1Horizon } from "@/components/clues/Day1Horizon";
import { Day2Sign } from "@/components/clues/Day2Sign";
import { Day3FlagCloth } from "@/components/clues/Day3FlagCloth";
import {
  horizonMotif,
  LANDSCAPES,
  type Landscape,
} from "@/components/clues/horizons/motifs";
import { PaperFilters } from "@/components/PaperFilters";
import type { Puzzle } from "@/domain/puzzle";
import { puzzlePool } from "@/server/puzzleRepository";

export const metadata: Metadata = {
  title: "Clue artefacts, Days 1-3 — The Lost Explorer",
  robots: { index: false, follow: false },
};

const FIXTURE_ID = "tbilisi";

function fixture(): Puzzle {
  const puzzle = puzzlePool.find((candidate) => candidate.id === FIXTURE_ID);
  if (!puzzle) {
    throw new Error(`Demo fixture ${FIXTURE_ID} is missing from the puzzle pool`);
  }
  return puzzle;
}

function withLandscape(puzzle: Puzzle, landscape: Landscape): Puzzle {
  return { ...puzzle, day1: { ...puzzle.day1, landscape } };
}

function resolveLandscape(raw: string | undefined, fallback: Landscape): Landscape {
  return LANDSCAPES.find((value) => value === raw) ?? fallback;
}

export default function CluesDemoPage({
  searchParams,
}: {
  searchParams: { landscape?: string };
}) {
  const puzzle = fixture();
  const landscape = resolveLandscape(searchParams.landscape, puzzle.day1.landscape);
  const shown = withLandscape(puzzle, landscape);

  return (
    <main className="stage mx-auto flex max-w-2xl flex-col gap-8 px-5 py-7">
      <PaperFilters />

      <header className="flex flex-col gap-2">
        <p className="face-stamp text-step--2 text-ink-faint">
          Field Kit &middot; Artefact Sheet
        </p>
        <h1 className="face-display text-step-4 text-ink">
          Days <span className="text-stamp">One to Three</span>
        </h1>
        <p className="face-journal max-w-prose text-ink-muted">
          Pasted in from the {puzzle.city} entry. Every word below is live text;
          the paper, tape and pencil are the only things that are drawn.
        </p>
      </header>

      <section className="flex flex-col gap-8" data-section="artefacts">
        <Day1Horizon puzzle={shown} delayIndex={0} />
        <Day2Sign puzzle={shown} delayIndex={1} />
        <Day3FlagCloth puzzle={shown} delayIndex={2} />
      </section>

      <section className="flex flex-col gap-4" data-section="motif-sheet">
        <p className="face-stamp text-step--2 text-ink-faint">
          Horizon motifs &middot; {LANDSCAPES.length} of {LANDSCAPES.length}
        </p>
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          {LANDSCAPES.map((value) => (
            <li key={value} className="flex flex-col gap-1">
              <a
                className="block border border-rule bg-paper-shade p-2 text-ink-muted"
                href={`/dev/clues?landscape=${value}`}
                aria-label={`Show the ${value} horizon`}
              >
                <svg
                  viewBox="0 0 240 96"
                  className="block h-auto w-full"
                  aria-hidden="true"
                  focusable="false"
                  data-motif-thumb={value}
                >
                  <g
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    data-decorative-filter=""
                  >
                    {horizonMotif(value).sketch}
                  </g>
                </svg>
              </a>
              <span className="face-ui text-step--2 text-ink-faint">{value}</span>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}

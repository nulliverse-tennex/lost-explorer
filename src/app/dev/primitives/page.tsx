import type { Metadata } from "next";
import { PaperCard } from "@/components/PaperCard";
import { PaperFilters } from "@/components/PaperFilters";
import { RubberStamp } from "@/components/RubberStamp";
import { TornEdge } from "@/components/TornEdge";
import { WashiTape } from "@/components/WashiTape";

/* Routed at /dev/primitives, not /_dev/primitives: a leading underscore makes
   a Next.js App Router folder private and removes it from routing entirely,
   so the QA scenarios would have had nothing to navigate to. */
export const metadata: Metadata = {
  title: "Primitives — The Lost Explorer",
  robots: { index: false, follow: false },
};

function Caption({ children }: { children: React.ReactNode }) {
  return (
    <p className="face-stamp text-step--2 text-ink-faint">{children}</p>
  );
}

export default function PrimitivesPage() {
  return (
    <main className="stage mx-auto flex max-w-4xl flex-col gap-7 px-5 py-7">
      <PaperFilters />

      <header className="flex flex-col gap-2">
        <Caption>Field Kit &middot; Reference Sheet</Caption>
        <h1 className="face-display text-step-4 text-ink">Primitives</h1>
        <p className="face-journal max-w-prose text-ink-muted">
          Four physical objects. Everything the journal is built from gets
          pressed, taped or torn out of these.
        </p>
      </header>

      <section className="flex flex-col gap-5">
        <Caption>01 &middot; Rubber Stamp</Caption>
        <div className="flex flex-wrap items-center gap-x-8 gap-y-7 py-4">
          <RubberStamp variant="day">DAY 3</RubberStamp>
          <RubberStamp variant="wrong">WRONG</RubberStamp>
        </div>
        <div className="flex flex-wrap items-center gap-x-9 gap-y-8 py-5">
          <RubberStamp variant="found">FOUND</RubberStamp>
          <RubberStamp variant="lost">LOST</RubberStamp>
        </div>
      </section>

      <section className="flex flex-col gap-5">
        <Caption>02 &middot; Washi Tape</Caption>
        <div className="flex flex-wrap items-center gap-8 py-4">
          <WashiTape corners={["loose"]} />
          <span className="face-ui text-step--1 text-ink-faint">
            one strip &middot; two strips below
          </span>
        </div>
      </section>

      <section className="flex flex-col gap-5">
        <Caption>03 &middot; Torn Edge</Caption>
        <TornEdge
          edges="both"
          className="bg-paper-high px-5 py-6 text-ink-muted shadow-lift"
        >
          <p className="face-journal">
            A deckled strip. The mask repeats a fixed-height fibre pattern, so
            the rag stays the same size however wide this grows.
          </p>
        </TornEdge>
      </section>

      <section className="flex flex-col gap-7">
        <Caption>04 &middot; Paper Card</Caption>

        <PaperCard tilt={-1.2} tape={["top-left", "bottom-right"]}>
          <h2 className="face-display text-step-1 text-ink">Day One</h2>
          <p className="face-journal mt-3 text-ink-muted">
            Taped in at two corners. The sheet carries the drop shadow of a
            thing resting on the page, tilted a degree off true.
          </p>
        </PaperCard>

        <PaperCard tilt={1.4} torn="both" tape={["top-center"]} delayIndex={1}>
          <h2 className="face-display text-step-1 text-ink">
            Torn from the log
          </h2>
          <p className="face-journal mt-3 text-ink-muted">
            Both edges deckled, held by a single strip across the top.
          </p>
          <div className="mt-5">
            <RubberStamp variant="day" rotate={-5.5}>
              DAY 4
            </RubberStamp>
          </div>
        </PaperCard>
      </section>
    </main>
  );
}

import type { ReactNode } from "react";

const TOTAL_DAYS = 5;

type JournalShellProps = {
  day: number;
  puzzleNumber: number;
  actions?: ReactNode;
  children: ReactNode;
};

export function JournalShell({
  day,
  puzzleNumber,
  actions,
  children,
}: JournalShellProps) {
  return (
    <div className="journal stage">
      <div className="journal__surface" aria-hidden="true" />
      <div className="journal__binding" aria-hidden="true" />

      <main className="journal__column">
        <header className="journal__masthead">
          <p className="journal__eyebrow face-stamp">
            Field Notes of a Missing Cartographer
          </p>
          <h1 className="journal__title face-display ink-layer">
            The Lost
            <br />
            <span className="journal__title-accent">Explorer</span>
          </h1>
          <p className="journal__strap face-stamp">
            Five days of notes &middot; One city
          </p>
        </header>

        <div className="journal__dayslot">
          <span className="journal__daystamp face-stamp">
            Day {day} of {TOTAL_DAYS}
          </span>
          <span className="journal__puzzleno face-ui">
            Entry No. {String(puzzleNumber).padStart(3, "0")}
          </span>
        </div>

        <div
          id="journal-content"
          className="journal__content"
          data-slot="clues"
        >
          {children}
        </div>

        <div className="journal__actions" data-slot="actions">
          {actions}
        </div>
      </main>

      <footer className="journal__footer" data-slot="attribution" />
    </div>
  );
}

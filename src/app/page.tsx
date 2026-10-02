import { JournalShell } from "@/components/JournalShell";

export default function Home() {
  return (
    <JournalShell
      day={1}
      puzzleNumber={1}
      actions={
        <div className="flex w-full gap-3">
          <button
            type="button"
            className="face-stamp flex-1 rounded-md border border-rule-strong px-4 py-4 text-step--1 text-ink"
          >
            Continue
          </button>
          <button
            type="button"
            className="face-stamp flex-1 rounded-md border-2 border-stamp bg-stamp px-4 py-4 text-step--1 text-paper-high"
          >
            Guess
          </button>
        </div>
      }
    >
      <article className="ink-layer border-l-2 border-brass pl-4">
        <p className="face-stamp text-step--2 text-brass">Day 1 &mdash; Where</p>
        <p className="face-journal mt-2 text-ink">
          I have lost the name of the place. The notes remain &mdash; five days
          of them. Read carefully and you may find it before I do.
        </p>
      </article>
    </JournalShell>
  );
}

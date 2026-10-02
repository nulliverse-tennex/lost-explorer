'use client';

import { Countdown } from './Countdown';

export function RestingState() {
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

        <div className="journal__content space-y-6 py-8">
          <article className="ink-layer border-l-2 border-brass pl-4">
            <p className="face-stamp text-step--2 text-brass">The Journal Closes</p>
            <p className="face-journal mt-4 text-ink leading-body">
              The explorer has returned from their journey and the journal rests, closed and waiting.
              Between expeditions, there is time for reflection, for maps to be studied, for the next
              mystery to be prepared.
            </p>
            <p className="face-journal mt-4 text-ink leading-body">
              Return when the next entry is ready.
            </p>
          </article>

          <div className="border-t border-rule pt-6">
            <Countdown />
          </div>
        </div>
      </main>

      <footer className="journal__footer" data-slot="attribution" />
    </div>
  );
}

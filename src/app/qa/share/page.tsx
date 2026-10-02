'use client';

import { JournalShell } from '@/components/JournalShell';
import { ShareButton } from '@/components/ShareButton';
import { daysSinceEpoch } from '@/domain/dailyClock';
import { computeStats, RecordedGameSchema, type GameJournal } from '@/domain/stats';
import { buildShareString, isResolvedGame } from '@/share/shareString';

const SOLVED_DAY = 3;

function decoy(geonameId: number, distanceKm: number, dayGuessed: number) {
  return {
    geonameId,
    displayName: `Decoy ${geonameId}`,
    country: 'Decoyland',
    distanceKm,
    band: distanceKm === 0 ? 'very-close' : 'far',
    dayGuessed,
  };
}

function wonOn(dayKey: string) {
  const startedAtMs = Date.parse(`${dayKey}T09:00:00.000Z`);
  return RecordedGameSchema.parse({
    dayKey,
    currentDay: SOLVED_DAY,
    guesses: {
      '1001': decoy(1001, 450, 1),
      '1002': decoy(1002, 900, 2),
      '9999': decoy(9999, 0, SOLVED_DAY),
    },
    status: 'won',
    startedAtMs,
    resolvedAtMs: startedAtMs + 78_000,
  });
}

const JOURNAL: GameJournal = {
  '2026-10-02': wonOn('2026-10-02'),
  '2026-10-03': wonOn('2026-10-03'),
  '2026-10-04': wonOn('2026-10-04'),
};

const TODAY = JOURNAL['2026-10-04'];

export default function ShareQaPage() {
  if (TODAY === undefined || !isResolvedGame(TODAY)) {
    throw new Error('share QA fixture must be a resolved game');
  }

  const stats = computeStats(JOURNAL);
  const puzzleNumber = daysSinceEpoch(Date.parse(`${TODAY.dayKey}T00:00:00.000Z`)) + 1;

  return (
    <JournalShell day={SOLVED_DAY} puzzleNumber={puzzleNumber}>
      <div className="ink-layer flex flex-col items-center gap-4">
        <pre
          className="face-ui whitespace-pre-wrap text-step--2 text-ink"
          data-testid="expected-share"
        >
          {buildShareString(TODAY, stats)}
        </pre>

        <ShareButton game={TODAY} stats={stats} />
      </div>
    </JournalShell>
  );
}

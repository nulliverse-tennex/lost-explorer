'use client';

import { daysSinceEpoch } from '@/domain/dailyClock';
import { JournalShell } from '@/components/JournalShell';
import { StatsPanel } from '@/components/stats/StatsPanel';
import { usePersistedGame } from '@/state/usePersistedGame';

export default function StatsQaPage() {
  const { loaded, dayKey, today, stats, exportCode, restoreFrom } = usePersistedGame();

  const puzzleNumber = daysSinceEpoch(Date.parse(`${dayKey}T00:00:00.000Z`)) + 1;

  return (
    <JournalShell day={today.currentDay} puzzleNumber={puzzleNumber}>
      <div data-testid="stats-ready" data-ready={String(loaded)}>
        <StatsPanel stats={stats} onExport={exportCode} onImport={restoreFrom} />
      </div>
    </JournalShell>
  );
}

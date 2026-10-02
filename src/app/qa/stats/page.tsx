'use client';

import { daysSinceEpoch } from '@/domain/dailyClock';
import { JournalShell } from '@/components/JournalShell';
import { StatsPanel } from '@/components/stats/StatsPanel';
import { usePersistedGame } from '@/state/usePersistedGame';

export default function StatsQaPage() {
  const { dayKey, today, stats, exportCode, restoreFrom } = usePersistedGame();

  const puzzleNumber = daysSinceEpoch(Date.parse(`${dayKey}T00:00:00.000Z`)) + 1;

  return (
    <JournalShell day={today.currentDay} puzzleNumber={puzzleNumber}>
      <StatsPanel stats={stats} onExport={exportCode} onImport={restoreFrom} />
    </JournalShell>
  );
}

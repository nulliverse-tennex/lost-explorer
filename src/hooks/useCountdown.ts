'use client';

import { useEffect, useState } from 'react';
import { nextUtcMidnightMs } from '@/domain/dailyClock';

/**
 * Countdown to the next UTC midnight.
 *
 * Captures the target timestamp ONCE on mount, then ticks client-side with setInterval
 * against that fixed target. This avoids the naive bug of recomputing from a date string
 * each tick, which drifts and misbehaves across the boundary.
 *
 * Pattern reference: https://github.com/nexu-io/nexu/blob/main/apps/web/src/hooks/use-countdown.ts
 */
export function useCountdown() {
  const [secondsRemaining, setSecondsRemaining] = useState<number | null>(null);

  useEffect(() => {
    // Capture the target timestamp once on mount.
    const targetMs = nextUtcMidnightMs();

    // Compute initial value immediately.
    const updateCountdown = () => {
      const nowMs = Date.now();
      const remainingMs = Math.max(0, targetMs - nowMs);
      const remainingSeconds = Math.ceil(remainingMs / 1000);
      setSecondsRemaining(remainingSeconds);
    };

    updateCountdown();

    // Tick once per second against the fixed target.
    const interval = setInterval(updateCountdown, 1000);

    return () => {
      clearInterval(interval);
    };
  }, []);

  return secondsRemaining;
}

export function formatCountdown(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

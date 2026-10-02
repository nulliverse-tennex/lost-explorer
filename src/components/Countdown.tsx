'use client';

import { useCountdown, formatCountdown } from '@/hooks/useCountdown';

export function Countdown() {
  const secondsRemaining = useCountdown();

  if (secondsRemaining === null) {
    return null;
  }

  const formatted = formatCountdown(secondsRemaining);

  return (
    <div className="text-center space-y-2">
      <p className="text-sm text-ink-muted">the next entry begins in</p>
      <time
        dateTime={`PT${Math.floor(secondsRemaining / 3600)}H${Math.floor((secondsRemaining % 3600) / 60)}M${secondsRemaining % 60}S`}
        className="block font-mono text-step-2 font-bold text-ink"
        aria-live="polite"
        aria-label={`${Math.floor(secondsRemaining / 3600)} hours, ${Math.floor((secondsRemaining % 3600) / 60)} minutes, ${secondsRemaining % 60} seconds remaining`}
      >
        {formatted}
      </time>
    </div>
  );
}

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Stats } from '@/domain/stats';
import { buildShareString, type ResolvedGame } from '@/share/shareString';

const NOTICE_MS = 2600;

const COPIED = 'Copied — stamped and ready to post.';
const SENT = 'Handed to the courier.';
const FAILED = 'The ink smudged. Copy it by hand instead.';

type ShareButtonProps = {
  game: ResolvedGame;
  stats: Stats;
};

// Firefox ships navigator.share on desktop but resolves it without reaching any target, so
// the chain must skip it there and land on the clipboard (same exclusion as Globle's).
function canUseNativeShare(text: string): boolean {
  if (typeof navigator.share !== 'function') {
    return false;
  }
  if (navigator.userAgent.includes('Firefox')) {
    return false;
  }
  return typeof navigator.canShare !== 'function' || navigator.canShare({ text });
}

function copyViaSelection(text: string): boolean {
  const field = document.createElement('textarea');
  field.value = text;
  field.readOnly = true;
  field.style.position = 'fixed';
  field.style.top = '-10rem';
  field.style.opacity = '0';
  document.body.appendChild(field);
  field.select();
  field.setSelectionRange(0, text.length);

  let copied: boolean;
  try {
    copied = document.execCommand('copy');
  } catch {
    copied = false;
  }

  field.remove();
  return copied;
}

export function ShareButton({ game, stats }: ShareButtonProps) {
  const [notice, setNotice] = useState('');
  const timerRef = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
      }
    },
    [],
  );

  const announce = useCallback((message: string) => {
    setNotice(message);
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
    }
    timerRef.current = window.setTimeout(() => setNotice(''), NOTICE_MS);
  }, []);

  // Everything before the clipboard call is synchronous and reads in-memory state only.
  // A single `await` here makes iOS Safari reject writeText with NotAllowedError, because
  // the write would no longer sit inside the user-gesture callstack (n8n#28081).
  const handleShare = useCallback(() => {
    const text = buildShareString(game, stats);

    if (canUseNativeShare(text)) {
      navigator.share({ text }).then(
        () => announce(SENT),
        () => setNotice(''),
      );
      return;
    }

    if (window.isSecureContext && typeof navigator.clipboard?.writeText === 'function') {
      navigator.clipboard.writeText(text).then(
        () => announce(COPIED),
        () => announce(copyViaSelection(text) ? COPIED : FAILED),
      );
      return;
    }

    announce(copyViaSelection(text) ? COPIED : FAILED);
  }, [game, stats, announce]);

  return (
    <div className="flex flex-col items-center gap-2">
      <button
        type="button"
        className="face-stamp rounded-sm border border-rule-strong bg-paper-high px-4 py-2 text-step--2 text-ink shadow-lift transition-colors duration-fast ease-paper hover:bg-paper-shade"
        data-testid="share-button"
        onClick={handleShare}
      >
        Copy the dispatch
      </button>

      <p
        role="status"
        aria-live="polite"
        className="face-ui min-h-5 text-step--2 text-ink-muted"
        data-testid="share-notice"
      >
        {notice}
      </p>
    </div>
  );
}

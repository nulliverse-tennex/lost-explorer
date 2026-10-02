'use client';

import { useId, useState } from 'react';
import styles from './stats.module.css';

type JournalTransferProps = {
  onExport: () => string;
  onImport: (code: string) => void;
};

const SEALED = 'Envelope sealed. Copy the code below and keep it somewhere dry.';
const OPENED = 'Envelope opened. The record above is restored.';
const EMPTY = 'Nothing to open — paste a transfer code first.';

export function JournalTransfer({ onExport, onImport }: JournalTransferProps) {
  const fieldId = useId();
  const [code, setCode] = useState('');
  const [status, setStatus] = useState('');

  function handleSeal() {
    setCode(onExport());
    setStatus(SEALED);
  }

  function handleOpen() {
    const trimmed = code.trim();
    if (trimmed === '') {
      setStatus(EMPTY);
      return;
    }

    onImport(trimmed);
    setStatus(OPENED);
  }

  return (
    <section className={styles.transfer} aria-labelledby={`${fieldId}-heading`}>
      <h3 id={`${fieldId}-heading`} className={`face-stamp ${styles.sectionHeading}`}>
        Sealed envelope
      </h3>

      <p className={`face-journal ${styles.transferHint}`}>
        Seal this journal into a code to carry it to another device, or open a code to
        restore it here.
      </p>

      <label htmlFor={fieldId} className={`face-stamp ${styles.transferLabel}`}>
        Transfer code
      </label>
      <textarea
        id={fieldId}
        className={`face-ui ${styles.transferField}`}
        data-testid="transfer-code"
        rows={3}
        spellCheck={false}
        value={code}
        onChange={(event) => setCode(event.target.value)}
      />

      <div className={styles.transferActions}>
        <button
          type="button"
          className={`face-stamp ${styles.button}`}
          data-testid="transfer-export"
          onClick={handleSeal}
        >
          Seal envelope
        </button>
        <button
          type="button"
          className={`face-stamp ${styles.button}`}
          data-testid="transfer-import"
          onClick={handleOpen}
        >
          Open envelope
        </button>
      </div>

      <p role="status" className={`face-ui ${styles.transferStatus}`} data-testid="transfer-status">
        {status}
      </p>
    </section>
  );
}

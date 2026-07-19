'use client';

import { CheckIcon, CopyIcon } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

interface CopyChipProps {
  command: string;
  className?: string;
  /** Hide the $ prompt (for tight spots like the header). */
  bare?: boolean;
}

/** A shell command rendered as a click-to-copy chip. */
export function CopyChip({ command, className, bare = false }: CopyChipProps) {
  const [status, setStatus] = useState<'idle' | 'copied' | 'failed'>('idle');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  const flash = useCallback((next: 'copied' | 'failed') => {
    setStatus(next);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setStatus('idle'), 1400);
  }, []);

  const copy = useCallback(() => {
    void navigator.clipboard.writeText(command).then(
      () => flash('copied'),
      (error) => {
        // biome-ignore lint/suspicious/noConsole: clipboard failures are actionable in demos
        console.error('[copy-chip]', error);
        flash('failed');
      }
    );
  }, [command, flash]);

  return (
    <button
      type="button"
      onClick={copy}
      aria-label={`Copy command: ${command}`}
      className={cn(
        'group inline-flex min-w-0 max-w-full items-center gap-2.5 rounded-md border border-input bg-card px-3.5 py-2',
        'font-mono text-[13px] text-foreground transition-colors hover:border-ledger/50',
        className
      )}
    >
      {!bare && (
        <span aria-hidden className="shrink-0 select-none text-muted-foreground">
          $
        </span>
      )}
      <span className="min-w-0 truncate">{command}</span>
      <span className="shrink-0 text-muted-foreground transition-colors group-hover:text-ledger">
        {status === 'copied' ? (
          <CheckIcon className="size-3.5 text-ledger" />
        ) : (
          <CopyIcon className="size-3.5" />
        )}
      </span>
      <span className="sr-only" aria-live="polite">
        {status === 'copied' ? 'Copied' : status === 'failed' ? 'Copy failed' : ''}
      </span>
    </button>
  );
}

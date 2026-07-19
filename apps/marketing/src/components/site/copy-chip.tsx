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
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  const copy = useCallback(() => {
    navigator.clipboard.writeText(command).then(() => {
      setCopied(true);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 1400);
    });
  }, [command]);

  return (
    <button
      type="button"
      onClick={copy}
      aria-label={`Copy command: ${command}`}
      className={cn(
        'group inline-flex items-center gap-2.5 rounded-md border border-input bg-card px-3.5 py-2',
        'font-mono text-[13px] text-foreground transition-colors hover:border-ledger/50',
        className
      )}
    >
      {!bare && (
        <span aria-hidden className="select-none text-muted-foreground">
          $
        </span>
      )}
      <span className="whitespace-nowrap">{command}</span>
      <span className="text-muted-foreground transition-colors group-hover:text-ledger">
        {copied ? (
          <CheckIcon className="size-3.5 text-ledger" />
        ) : (
          <CopyIcon className="size-3.5" />
        )}
      </span>
      <span className="sr-only" aria-live="polite">
        {copied ? 'Copied' : ''}
      </span>
    </button>
  );
}

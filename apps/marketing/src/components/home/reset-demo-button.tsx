'use client';

import { RotateCcwIcon } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { cn } from '@/lib/utils';

/** Re-seeds the shared in-memory demo database. */
export function ResetDemoButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const reset = async () => {
    setBusy(true);
    try {
      await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reset' }),
      });
      router.refresh();
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      onClick={reset}
      disabled={busy}
      className={cn(
        'inline-flex items-center gap-1.5 font-mono text-[11px] tracking-wide',
        'text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50'
      )}
    >
      <RotateCcwIcon className={cn('size-3', busy && 'animate-spin')} />
      reset demo data
    </button>
  );
}

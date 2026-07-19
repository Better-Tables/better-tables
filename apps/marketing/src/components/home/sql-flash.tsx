'use client';

import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

/**
 * Wraps the SQL readout and flashes its edge whenever the generated SQL
 * changes, so the cause→effect of clicking a filter is visible.
 */
export function SqlFlash({
  signature,
  children,
}: {
  signature: string;
  children: React.ReactNode;
}) {
  const [flash, setFlash] = useState(false);
  const last = useRef(signature);

  useEffect(() => {
    if (last.current === signature) return;
    last.current = signature;
    setFlash(true);
    const t = setTimeout(() => setFlash(false), 700);
    return () => clearTimeout(t);
  }, [signature]);

  return (
    <div
      className={cn(
        'rounded-md transition-shadow duration-700',
        flash && 'shadow-[0_0_0_2px_var(--ledger)]'
      )}
    >
      {children}
    </div>
  );
}

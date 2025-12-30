'use client';

import type { UrlSyncAdapter } from '@better-tables/core';
import { useRouter, useSearchParams } from 'next/navigation';
import { useMemo } from 'react';

/**
 * Next.js App Router URL sync adapter
 * Provides URL synchronization for Next.js applications
 */
export function useNextjsUrlAdapter(): UrlSyncAdapter {
  const router = useRouter();
  const searchParams = useSearchParams();

  return useMemo(
    () => ({
      getParam: (key: string) => {
        return searchParams.get(key);
      },

      setParams: (updates: Record<string, string | null>) => {
        const params = new URLSearchParams(searchParams);

        for (const [key, value] of Object.entries(updates)) {
          if (value === null) {
            params.delete(key);
          } else {
            params.set(key, value);
          }
        }

        // Preserve hash fragment when updating URL
        const hash = typeof window !== 'undefined' ? window.location.hash : '';
        const newUrl = `?${params.toString()}${hash}`;

        // Push the new URL to trigger server re-fetch
        router.push(newUrl, { scroll: false });
      },
    }),
    [router, searchParams]
  );
}


import type { UrlSyncAdapter } from '@better-tables/ui';
import { useRouter, useSearchParams } from 'next/navigation';

/**
 * Next.js App Router URL sync adapter
 * Provides URL synchronization for Next.js applications
 *
 * @returns UrlSyncAdapter implementation for Next.js
 *
 * @example
 * ```tsx
 * import { useTableUrlSync } from '@better-tables/ui';
 * import { useNextjsUrlAdapter } from '@/lib/nextjs-url-adapter';
 *
 * function MyTable() {
 *   const urlAdapter = useNextjsUrlAdapter();
 *
 *   useTableUrlSync('my-table', {
 *     filters: true,
 *     pagination: true,
 *     sorting: true
 *   }, urlAdapter);
 *
 *   return <BetterTable id="my-table" ... />;
 * }
 * ```
 */
export function useNextjsUrlAdapter(): UrlSyncAdapter {
  const router = useRouter();
  const searchParams = useSearchParams();

  return {
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

      const newUrl = `?${params.toString()}`;

      // Push the new URL and refresh to trigger server re-fetch
      router.push(newUrl, { scroll: false });
      router.refresh();
    },
  };
}

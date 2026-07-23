'use client';

import type { UrlSyncAdapter } from '@better-tables/core';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useMemo } from 'react';

/**
 * URL params the server (the `LiveDemo` RSC) reads to build its query. A change
 * to any of these must re-run the server component, so it goes through the
 * router. Every other synced param — column visibility, column order — is a
 * client-only view preference the server ignores.
 */
const SERVER_AFFECTING_PARAMS = ['page', 'limit', 'filters', 'sorting'] as const;

/**
 * Next.js App Router URL sync adapter.
 *
 * The table's URL-sync writes state out on *every* store change (including ones
 * that don't touch any synced URL param, e.g. row selection). A naive
 * `router.push` on each write therefore fired a full RSC round-trip — refetch +
 * re-render of the whole page — even to tick a checkbox or toggle a column. To
 * avoid that, `setParams`:
 *
 *  - does nothing when the resulting query string is identical to the current
 *    one (selection changes, redundant writes) — no navigation at all;
 *  - uses `router.replace` (not `push`, so an interaction isn't a back-button
 *    stop) only when a *server-affecting* param actually changed value, since
 *    only then does the server need to refetch;
 *  - otherwise updates the URL with a shallow `history.replaceState`, keeping
 *    client-only view state (column visibility/order) shareable in the URL
 *    without paying a server round-trip the server would ignore.
 */
export function useNextjsUrlAdapter(): UrlSyncAdapter {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  return useMemo(
    () => ({
      getParam: (key: string) => searchParams.get(key),

      setParams: (updates: Record<string, string | null>) => {
        const nextParams = new URLSearchParams(searchParams);
        for (const [key, value] of Object.entries(updates)) {
          if (value === null) {
            nextParams.delete(key);
          } else {
            nextParams.set(key, value);
          }
        }

        // Nothing the URL cares about changed (e.g. a row-selection write):
        // don't navigate at all.
        const nextQuery = nextParams.toString();
        if (nextQuery === searchParams.toString()) {
          return;
        }

        // Did any param that the server reads change value? Compare against the
        // current URL rather than trusting `updates` keys — the write-out always
        // includes the (often unchanged) page/limit, so key presence alone would
        // always look server-affecting.
        const serverChanged = SERVER_AFFECTING_PARAMS.some(
          (key) => (searchParams.get(key) ?? '') !== (nextParams.get(key) ?? '')
        );

        const hash = typeof window !== 'undefined' ? window.location.hash : '';
        const newUrl = `${pathname}${nextQuery ? `?${nextQuery}` : ''}${hash}`;

        if (serverChanged) {
          router.replace(newUrl, { scroll: false });
        } else if (typeof window !== 'undefined') {
          // Client-only view state: keep it in the URL without a server
          // round-trip. Preserve Next's history state so routing stays intact;
          // Next syncs `useSearchParams` from this entry.
          window.history.replaceState(window.history.state, '', newUrl);
        }
      },
    }),
    [router, pathname, searchParams]
  );
}

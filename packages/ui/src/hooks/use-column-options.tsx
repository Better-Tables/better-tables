'use client';

import type { ColumnDefinition, FilterOption, TableAdapter } from '@better-tables/core';
import * as React from 'react';

/**
 * Facet-fallback options for option dropdowns (plan 054 Step 5).
 *
 * Precedence: declared options (including enum options enriched in by
 * `resolveTableColumns`) always win and never trigger a fetch. An
 * option-typed column with NO options lazily fetches
 * `adapter.getFilterOptions(columnId)` when the consuming dropdown first
 * opens (these leaf components mount on open), cached per (adapter,
 * columnId) so reopening never refetches. A failed fetch resolves to an
 * empty list — consumers keep their "No options" fallback for that case.
 */

/** The one adapter member the fallback needs — structural, any adapter fits. */
export type ColumnOptionsAdapter = Pick<TableAdapter<unknown>, 'getFilterOptions'>;

const TableAdapterContext = React.createContext<ColumnOptionsAdapter | null>(null);

/**
 * Provide the table's adapter to leaf inputs (option editor, option filter
 * input). Mounted by `BetterTable` and `VirtualizedTable`; a `null`/absent
 * adapter simply disables the facet fallback.
 */
export function TableAdapterProvider({
  adapter,
  children,
}: {
  adapter: ColumnOptionsAdapter | null | undefined;
  children: React.ReactNode;
}) {
  return (
    <TableAdapterContext.Provider value={adapter ?? null}>{children}</TableAdapterContext.Provider>
  );
}

/** Fetch-once cache per (adapter, columnId) — reopen never refetches. */
const optionsCache = new WeakMap<object, Map<string, Promise<FilterOption[]>>>();

function fetchOptionsOnce(
  adapter: ColumnOptionsAdapter,
  columnId: string
): Promise<FilterOption[]> {
  let perColumn = optionsCache.get(adapter);
  if (!perColumn) {
    perColumn = new Map();
    optionsCache.set(adapter, perColumn);
  }
  let pending = perColumn.get(columnId);
  if (!pending) {
    // Failures resolve to [] — the dropdown shows its "No options" fallback
    // instead of crashing, and the result is cached like a success (schema
    // facets are stable; a transient failure shouldn't hammer the endpoint
    // on every reopen).
    pending = adapter.getFilterOptions(columnId).catch(() => []);
    perColumn.set(columnId, pending);
  }
  return pending;
}

const EMPTY_OPTIONS: FilterOption[] = [];

export interface ColumnOptionsResult {
  options: FilterOption[];
  /** True while the facet fallback is fetching (declared options never load). */
  loading: boolean;
}

/**
 * The options an option/multiOption dropdown should show for `column`:
 * declared > inferred-enum (already on the column via enrichment) >
 * facet-fetched via the context adapter. See the module docs for caching
 * and failure semantics.
 */
export function useColumnOptions<TData>(
  column: ColumnDefinition<TData, unknown>
): ColumnOptionsResult {
  const adapter = React.useContext(TableAdapterContext);
  const declared = column.filter?.options;
  const hasDeclared = !!declared && declared.length > 0;
  const canFetch =
    !hasDeclared &&
    (column.type === 'option' || column.type === 'multiOption') &&
    typeof adapter?.getFilterOptions === 'function';
  const [fetched, setFetched] = React.useState<FilterOption[] | null>(null);

  React.useEffect(() => {
    if (!canFetch || !adapter) return undefined;
    let cancelled = false;
    fetchOptionsOnce(adapter, column.id).then((options) => {
      if (!cancelled) setFetched(options);
    });
    return () => {
      cancelled = true;
    };
  }, [canFetch, adapter, column.id]);

  if (hasDeclared) return { options: declared, loading: false };
  if (!canFetch) return { options: EMPTY_OPTIONS, loading: false };
  return { options: fetched ?? EMPTY_OPTIONS, loading: fetched === null };
}

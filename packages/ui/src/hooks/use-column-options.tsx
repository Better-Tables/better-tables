'use client';

import type { ColumnDefinition, FilterOption, TableAdapter } from '@better-tables/core';
import * as React from 'react';

/**
 * Facet-fallback options for option dropdowns (plan 054 Step 5).
 *
 * Precedence: declared options (including enum options enriched by
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

/**
 * Fetch-once cache per (adapter, columnId) — reopen never refetches.
 *
 * Alongside the in-flight `promise`, each entry tracks its settled `value`
 * once resolved so a later (re)mount can read the result synchronously
 * instead of waiting a tick for a `.then()` callback (see `useColumnOptions`).
 */
interface OptionsCacheEntry {
  promise: Promise<FilterOption[]>;
  value?: FilterOption[];
}

const optionsCache = new WeakMap<object, Map<string, OptionsCacheEntry>>();

function getOptionsEntry(adapter: ColumnOptionsAdapter, columnId: string): OptionsCacheEntry {
  let perColumn = optionsCache.get(adapter);
  if (!perColumn) {
    perColumn = new Map();
    optionsCache.set(adapter, perColumn);
  }
  let entry = perColumn.get(columnId);
  if (!entry) {
    // Failures resolve to [] — the dropdown shows its "No options" fallback
    // instead of crashing, and the result is cached like a success (schema
    // facets are stable; a transient failure shouldn't hammer the endpoint
    // on every reopen).
    const promise = adapter.getFilterOptions(columnId).catch(() => []);
    const newEntry: OptionsCacheEntry = { promise };
    entry = newEntry;
    perColumn.set(columnId, newEntry);
    promise.then((options) => {
      newEntry.value = options;
    });
  }
  return entry;
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

  // Tracks which (adapter, columnId) `fetched` currently belongs to, so a
  // column/adapter switch is detected — and `fetched` reset — before this
  // render commits, instead of one effect-cycle later (Bug A: stale options
  // leaking across columns).
  const keyRef = React.useRef<{ adapter: ColumnOptionsAdapter; columnId: string } | null>(null);
  const [fetched, setFetched] = React.useState<FilterOption[] | null>(null);

  const keyChanged =
    canFetch &&
    !!adapter &&
    (keyRef.current === null ||
      keyRef.current.adapter !== adapter ||
      keyRef.current.columnId !== column.id);

  if (keyChanged && adapter) {
    keyRef.current = { adapter, columnId: column.id };
    // Adjusting state during render (React-supported pattern): read the
    // cache synchronously so an already-settled value is available on the
    // very first render for this column — no "Loading options…" flash on
    // remount (Bug B) — while an unsettled entry correctly starts `null`.
    const entry = getOptionsEntry(adapter, column.id);
    setFetched(entry.value ?? null);
  }

  React.useEffect(() => {
    if (!canFetch || !adapter) return undefined;
    const entry = getOptionsEntry(adapter, column.id);
    if (entry.value !== undefined) return undefined;
    let cancelled = false;
    entry.promise.then((options) => {
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

'use client';

import type { FilterState, PaginationState, SortingState, TableAdapter } from '@better-tables/core';
import { defineTableRow } from '@better-tables/core';
import * as React from 'react';
import { useTableData } from '../../hooks/use-table-data';
import { cn } from '../../lib/utils';
import { BetterTable, type BetterTableProps } from './table';

const DEFAULT_PAGINATION: PaginationState = {
  page: 1,
  limit: 20,
  totalPages: 1,
  hasNext: false,
  hasPrev: false,
};

/** `listTables` made non-optional — the one capability this component requires. */
type ListTablesAdapter<TData> = TableAdapter<TData> & {
  listTables: NonNullable<TableAdapter<TData>['listTables']>;
};

/**
 * Props forwarded to the mounted `<BetterTable>` for the selected table.
 * Everything TableNavigator itself owns (schema/data/loading wiring, the
 * per-table filter/sort/pagination lift, and FK-click table-switching) is
 * excluded — pass table-level behavior only (`features`, `editing`, slots,
 * `onRowClick`, etc.).
 */
type TableNavigatorTableProps<TData> = Omit<
  BetterTableProps<TData>,
  | 'id'
  | 'name'
  | 'table'
  | 'columns'
  | 'data'
  | 'adapter'
  | 'loading'
  | 'error'
  | 'totalCount'
  | 'initialFilters'
  | 'initialSorting'
  | 'initialPagination'
  | 'onFiltersChange'
  | 'onSortingChange'
  | 'onPaginationChange'
  | 'onNavigateToRelated'
>;

export interface TableNavigatorProps<TData = Record<string, unknown>> {
  /** Must implement `listTables` (plan 065 Phase 5) in addition to the usual reads. */
  adapter: ListTablesAdapter<TData>;
  className?: string;
  /** Forwarded to the mounted `<BetterTable>` — see {@link TableNavigatorTableProps}. */
  tableProps?: TableNavigatorTableProps<TData>;
}

/**
 * Table catalog / navigator (plan 065 Phase 5): lists every table
 * `adapter.listTables()` reports, and mounts a fully-typed `<BetterTable>`
 * for whichever one is selected using `t.auto()` (plan 054) — zero
 * per-table code required by the consumer. Selecting a table gets its OWN
 * store (keyed by table name, `BetterTable`'s own `id` default) and its own
 * fresh filter/sort/pagination state; a resolved FK column's click
 * navigation (plan 065 Phase 3) switches the selection to the FK's target
 * table, closing the loop this component's own doc comment on
 * `onNavigateToRelated` describes.
 */
export function TableNavigator<TData = Record<string, unknown>>({
  adapter,
  className,
  tableProps,
}: TableNavigatorProps<TData>) {
  const [tables, setTables] = React.useState<Awaited<
    ReturnType<ListTablesAdapter<TData>['listTables']>
  > | null>(null);
  const [listError, setListError] = React.useState<Error | null>(null);
  const [selectedTable, setSelectedTable] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    adapter
      .listTables()
      .then((list) => {
        if (cancelled) return;
        setTables(list);
        setSelectedTable((prev) => prev ?? list[0]?.table ?? null);
      })
      .catch((err: unknown) => {
        if (!cancelled) setListError(err instanceof Error ? err : new Error(String(err)));
      });
    return () => {
      cancelled = true;
    };
  }, [adapter]);

  const [filters, setFilters] = React.useState<FilterState[]>([]);
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [pagination, setPagination] = React.useState<PaginationState>(DEFAULT_PAGINATION);

  // A table switch must never leak the previous table's filter/sort/page
  // state into the newly selected one.
  React.useEffect(() => {
    setFilters([]);
    setSorting([]);
    setPagination(DEFAULT_PAGINATION);
  }, [selectedTable]);

  // Always an object (never `undefined`) — `enabled` below gates whether a
  // fetch happens at all while `selectedTable` is still null, so an empty
  // `primaryTable` placeholder here is never actually sent anywhere.
  const fetchParams = React.useMemo(
    () => ({ primaryTable: selectedTable ?? '', sorting }),
    [selectedTable, sorting]
  );

  const { data, loading, error, totalCount } = useTableData<TData>({
    adapter,
    filters,
    pagination,
    params: fetchParams,
    enabled: selectedTable != null,
  });

  const tableDef = React.useMemo(
    () => (selectedTable ? defineTableRow<TData>()(selectedTable) : null),
    [selectedTable]
  );

  return (
    <div className={cn('flex h-full min-h-0 gap-4', className)}>
      <nav aria-label="Tables" className="w-48 shrink-0 overflow-y-auto border-r pr-2">
        {listError ? (
          <p role="alert" className="text-xs text-destructive">
            {listError.message}
          </p>
        ) : tables === null ? (
          <p className="text-xs text-muted-foreground">Loading tables…</p>
        ) : (
          <ul className="flex flex-col gap-0.5">
            {tables.map((t) => (
              <li key={t.table}>
                <button
                  type="button"
                  aria-current={t.table === selectedTable ? 'true' : undefined}
                  className={cn(
                    'w-full rounded-md px-2 py-1 text-left text-xs hover:bg-muted/60',
                    t.table === selectedTable && 'bg-muted font-medium'
                  )}
                  onClick={() => setSelectedTable(t.table)}
                >
                  {t.label}
                  {t.rowCountEstimate != null ? (
                    <span className="ml-1 text-muted-foreground">({t.rowCountEstimate})</span>
                  ) : null}
                </button>
              </li>
            ))}
          </ul>
        )}
      </nav>
      <div className="min-w-0 flex-1">
        {tableDef ? (
          // `key`: force a fully fresh <BetterTable> instance per table — belt
          // and suspenders alongside the store already being keyed by table
          // name (BetterTable's own `id` default), so switching can NEVER
          // leak component-local or store state from the previous table.
          <BetterTable
            key={selectedTable ?? undefined}
            table={tableDef}
            data={data}
            adapter={adapter}
            loading={loading}
            error={error}
            totalCount={totalCount}
            initialFilters={filters}
            initialSorting={sorting}
            initialPagination={pagination}
            onFiltersChange={setFilters}
            onSortingChange={setSorting}
            onPaginationChange={setPagination}
            onNavigateToRelated={(target) => setSelectedTable(target.table)}
            {...tableProps}
          />
        ) : null}
      </div>
    </div>
  );
}

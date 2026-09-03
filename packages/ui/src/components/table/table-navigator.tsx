'use client';

import type {
  ColumnDefinition,
  FilterState,
  PaginationState,
  SortingState,
  TableAdapter,
} from '@better-tables/core';
import { defineTableRow, resolveTableColumns } from '@better-tables/core';
import * as React from 'react';
import { useTableData } from '../../hooks/use-table-data';
import { cn } from '../../lib/utils';
import { RecordFormDialog } from './record-form-dialog';
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
 * Per-table configuration overrides (plan 065 Phase 6), keyed by table id
 * (the same string `listTables()` reports). Composition over the existing
 * "declared values always win" seam (plan 054) — no new precedence rules.
 */
export interface TableOverrideConfig<TData = unknown> {
  /** Excluded from the table list entirely. */
  hidden?: boolean;
  /** Grid still renders; the create/edit triggers this component owns don't. */
  readOnly?: boolean;
  /** Overrides the table's sidebar label (not `listTables()`'s own label). */
  label?: string;
  /**
   * Field-level overrides merged onto the auto-resolved column with the
   * matching `id` — override wins per field (NOT `resolveTableColumns`'s
   * gap-filling direction: a `columnOverrides` entry is a partial column,
   * missing required fields like `accessor`, so it can't be treated as an
   * explicit declaration the way `t.text(...)` can — it's a plain
   * `{ ...resolved, ...override }` shallow merge instead).
   *
   * `hidden: true` is the one field NOT part of `ColumnDefinition` — it
   * drops the column from the resolved list entirely rather than setting a
   * property on it. (`ColumnDefinition.defaultVisible` alone does NOT hide a
   * column here: `<BetterTable>` only consults it when the table-level
   * `defaultVisibleColumns` prop is also set, which this component doesn't
   * use — omission from the column list is the mechanism that actually
   * works, independent of that prop.)
   */
  columnOverrides?: (Partial<ColumnDefinition<TData, unknown>> & { hidden?: boolean })[];
}

export type TableOverrides<TData = unknown> = Record<string, TableOverrideConfig<TData>>;

/**
 * Props forwarded to the mounted `<BetterTable>` for the selected table.
 * Everything TableNavigator itself owns (schema/data/loading wiring, the
 * per-table filter/sort/pagination lift, FK-click table-switching, and the
 * create/edit-record triggers) is excluded — pass table-level behavior only
 * (`features`, `editing`, slots, etc.).
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
  | 'onRowClick'
>;

export interface TableNavigatorProps<TData = Record<string, unknown>> {
  /** Must implement `listTables` (plan 065 Phase 5) in addition to the usual reads. */
  adapter: ListTablesAdapter<TData>;
  className?: string;
  /** Per-table `hidden`/`readOnly`/`label`/`columnOverrides` (plan 065 Phase 6). */
  overrides?: TableOverrides<TData>;
  /** Forwarded to the mounted `<BetterTable>` — see {@link TableNavigatorTableProps}. */
  tableProps?: TableNavigatorTableProps<TData>;
}

type FormState<TData> = { mode: 'create' } | { mode: 'edit'; row: TData };

/**
 * Table catalog / navigator (plan 065 Phases 5-6): lists every table
 * `adapter.listTables()` reports, and mounts a fully-typed `<BetterTable>`
 * for whichever one is selected using `t.auto()` (plan 054) — zero
 * per-table code required by the consumer. Selecting a table gets its OWN
 * store (keyed by table name, `BetterTable`'s own `id` default) and its own
 * fresh filter/sort/pagination state; a resolved FK column's click
 * navigation (plan 065 Phase 3) switches the selection to the FK's target
 * table. A "+ New" toolbar action and row-click open `<RecordFormDialog>`
 * (plan 065 Phase 4) for create/edit — both absent for a table marked
 * `readOnly` via `overrides`.
 */
export function TableNavigator<TData = Record<string, unknown>>({
  adapter,
  className,
  overrides,
  tableProps,
}: TableNavigatorProps<TData>) {
  const [tables, setTables] = React.useState<Awaited<
    ReturnType<ListTablesAdapter<TData>['listTables']>
  > | null>(null);
  const [listError, setListError] = React.useState<Error | null>(null);
  const [selectedTable, setSelectedTable] = React.useState<string | null>(null);

  const visibleTables = React.useMemo(
    () => (tables ?? []).filter((t) => !overrides?.[t.table]?.hidden),
    [tables, overrides]
  );

  React.useEffect(() => {
    let cancelled = false;
    adapter
      .listTables()
      .then((list) => {
        if (cancelled) return;
        setTables(list);
        const firstVisible = list.find((t) => !overrides?.[t.table]?.hidden);
        setSelectedTable((prev) => prev ?? firstVisible?.table ?? null);
      })
      .catch((err: unknown) => {
        if (!cancelled) setListError(err instanceof Error ? err : new Error(String(err)));
      });
    return () => {
      cancelled = true;
    };
    // Deliberately `[adapter]` only: `overrides` merely picks which table
    // auto-selects first once the list arrives — re-running this whole
    // listTables() fetch on every overrides identity change would be
    // wasteful and pointless.
  }, [adapter]);

  const [filters, setFilters] = React.useState<FilterState[]>([]);
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [pagination, setPagination] = React.useState<PaginationState>(DEFAULT_PAGINATION);
  const [formState, setFormState] = React.useState<FormState<TData> | null>(null);

  // A table switch must never leak the previous table's filter/sort/page
  // state (or an open create/edit dialog) into the newly selected one.
  React.useEffect(() => {
    setFilters([]);
    setSorting([]);
    setPagination(DEFAULT_PAGINATION);
    setFormState(null);
  }, [selectedTable]);

  // Always an object (never `undefined`) — `enabled` below gates whether a
  // fetch happens at all while `selectedTable` is still null, so an empty
  // `primaryTable` placeholder here is never actually sent anywhere.
  const fetchParams = React.useMemo(
    () => ({ primaryTable: selectedTable ?? '', sorting }),
    [selectedTable, sorting]
  );

  const { data, loading, error, totalCount, refetch } = useTableData<TData>({
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

  // Resolved columns (auto-inferred + any per-table columnOverrides merged
  // on top) — feeds BOTH the grid (as an explicit `columns` override, which
  // wins over `table`) and <RecordFormDialog>, so the two never disagree
  // about what a column looks like.
  const [resolvedColumns, setResolvedColumns] = React.useState<
    ColumnDefinition<TData, unknown>[] | null
  >(null);

  React.useEffect(() => {
    if (!tableDef || !selectedTable) {
      setResolvedColumns(null);
      return;
    }
    let cancelled = false;
    resolveTableColumns(tableDef, adapter).then((base) => {
      if (cancelled) return;
      const columnOverrides = overrides?.[selectedTable]?.columnOverrides;
      if (!columnOverrides || columnOverrides.length === 0) {
        setResolvedColumns(base);
        return;
      }
      const overrideById = new Map(columnOverrides.map((o) => [o.id, o]));
      setResolvedColumns(
        base
          .filter((column) => overrideById.get(column.id)?.hidden !== true)
          .map((column) => {
            const override = overrideById.get(column.id);
            if (!override) return column;
            const { hidden: _hidden, ...fieldOverrides } = override;
            return { ...column, ...fieldOverrides };
          })
      );
    });
    return () => {
      cancelled = true;
    };
  }, [tableDef, selectedTable, adapter, overrides]);

  const readOnly = selectedTable ? overrides?.[selectedTable]?.readOnly === true : false;

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
            {visibleTables.map((t) => (
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
                  {overrides?.[t.table]?.label ?? t.label}
                  {t.rowCountEstimate != null ? (
                    <span className="ml-1 text-muted-foreground">({t.rowCountEstimate})</span>
                  ) : null}
                </button>
              </li>
            ))}
          </ul>
        )}
      </nav>
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        {!readOnly && adapter.createRecord && resolvedColumns ? (
          <div className="flex justify-end">
            <button
              type="button"
              className="inline-flex h-7 items-center justify-center rounded-md border px-2 text-xs font-medium hover:bg-muted/60"
              onClick={() => setFormState({ mode: 'create' })}
            >
              + New
            </button>
          </div>
        ) : null}
        {tableDef && resolvedColumns ? (
          // `key`: force a fully fresh <BetterTable> instance per table — belt
          // and suspenders alongside the store already being keyed by table
          // name (BetterTable's own `id` default), so switching can NEVER
          // leak component-local or store state from the previous table.
          <BetterTable
            key={selectedTable ?? undefined}
            table={tableDef}
            columns={resolvedColumns}
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
            {...(!readOnly && adapter.updateRecord
              ? { onRowClick: (row: TData) => setFormState({ mode: 'edit', row }) }
              : {})}
            {...tableProps}
          />
        ) : null}
      </div>
      {formState && resolvedColumns ? (
        <RecordFormDialog<TData>
          open
          onOpenChange={(open) => {
            if (!open) setFormState(null);
          }}
          mode={formState.mode}
          columns={resolvedColumns}
          {...(formState.mode === 'edit' ? { row: formState.row } : {})}
          {...(selectedTable ? { table: selectedTable } : {})}
          adapter={adapter}
          onSuccess={() => {
            setFormState(null);
            void refetch();
          }}
        />
      ) : null}
    </div>
  );
}

'use client';

import type { ColumnDefinition, FilterState } from '@better-tables/core';
import * as React from 'react';
import type { FacetOption } from '../../hooks/use-facets';
import { cn } from '../../lib/utils';
import { Checkbox } from '../ui/checkbox';

/**
 * Toggle a single facet `value` for `columnId` in/out of `filters`.
 *
 * Multiple selected values for the same column accumulate into ONE filter
 * (operator `isAnyOf` for 2+ values, `is` for exactly 1) rather than one
 * filter per value -- removing the last selected value drops the column's
 * filter entirely. Exported so a custom facet UI can reuse the exact same
 * toggle semantics `<FacetedFilterSidebar>` uses.
 */
export function toggleFacetValue(
  filters: FilterState[],
  columnId: string,
  columnType: FilterState['type'],
  value: string
): FilterState[] {
  const existing = filters.find((f) => f.columnId === columnId);
  const currentValues = existing ? (existing.values as unknown[]).map(String) : [];
  const isSelected = currentValues.includes(value);
  const nextValues = isSelected
    ? currentValues.filter((v) => v !== value)
    : [...currentValues, value];

  const withoutColumn = filters.filter((f) => f.columnId !== columnId);

  if (nextValues.length === 0) {
    return withoutColumn;
  }

  // `type` is a non-literal `ColumnDefinition['type']` here, so it can't be
  // matched to the specific `FilterState` union member's `values` element
  // type without a cast (same constraint the hand-built showcase facet
  // sidebar hit -- see plans/findings/029-dx-findings.md #1, #17).
  const nextFilter = {
    columnId,
    type: columnType,
    operator: nextValues.length > 1 ? 'isAnyOf' : 'is',
    values: nextValues,
  } as FilterState;

  return [...withoutColumn, nextFilter];
}

export interface FacetedFilterSidebarProps<TData = unknown> {
  /** Column definitions -- used to look up each facet's display name/type. */
  columns: ColumnDefinition<TData>[];

  /** Checkbox-facet column IDs to render, in order. Matches `useFacets({ columnIds })`. */
  columnIds?: string[];

  /** Numeric/date range-facet column IDs to render, in order. Matches `useFacets({ rangeColumnIds })`. */
  rangeColumnIds?: string[];

  /** `useFacets()`'s `facets` result. */
  facets: Record<string, FacetOption[]>;

  /** `useFacets()`'s `ranges` result. */
  ranges: Record<string, [number, number]>;

  /** The caller's current active filters (drives which options render as selected). */
  filters: FilterState[];

  /** Called with the next filter array whenever an option is toggled. */
  onFiltersChange: (filters: FilterState[]) => void;

  /** Dims the option list while a facet refetch is in flight. */
  loading?: boolean;

  /** Additional CSS classes. */
  className?: string;

  /** Accessible label for the sidebar landmark. */
  'aria-label'?: string;
}

/**
 * A reusable faceted-filter sidebar: checkbox lists (with counts) for
 * `columnIds` and `[min, max]` displays for `rangeColumnIds`, driven by
 * `useFacets()`'s output. Clicking an option toggles a REAL filter via
 * `onFiltersChange` (e.g. wired to `useTableFilters(tableId).setFilters`),
 * so the sidebar and the table it filters stay in sync through the same
 * filter state -- no separate sidebar-only state to reconcile.
 *
 * This is the reusable version of the hand-built sidebar every faceted-UI
 * consumer otherwise assembles from scratch (plan 032, finding 7).
 *
 * @example
 * ```tsx
 * const { filters, setFilters } = useTableFilters('tickets');
 * const { facets, ranges, loading } = useFacets({
 *   adapter,
 *   columnIds: ['status', 'priority'],
 *   rangeColumnIds: ['reopenCount'],
 *   filters,
 * });
 *
 * <FacetedFilterSidebar
 *   columns={columns}
 *   columnIds={['status', 'priority']}
 *   rangeColumnIds={['reopenCount']}
 *   facets={facets}
 *   ranges={ranges}
 *   filters={filters}
 *   onFiltersChange={setFilters}
 *   loading={loading}
 * />
 * ```
 */
function FacetedFilterSidebarComponent<TData = unknown>({
  columns,
  columnIds = [],
  rangeColumnIds = [],
  facets,
  ranges,
  filters,
  onFiltersChange,
  loading = false,
  className,
  'aria-label': ariaLabel = 'Facet filters',
}: FacetedFilterSidebarProps<TData>) {
  const isActive = React.useCallback(
    (columnId: string, value: string) => {
      const filter = filters.find((f) => f.columnId === columnId);
      if (!filter) return false;
      return (filter.values as unknown[]).map(String).includes(value);
    },
    [filters]
  );

  const handleToggle = React.useCallback(
    (columnId: string, columnType: FilterState['type'], value: string) => {
      onFiltersChange(toggleFacetValue(filters, columnId, columnType, value));
    },
    [filters, onFiltersChange]
  );

  if (columnIds.length === 0 && rangeColumnIds.length === 0) {
    return null;
  }

  return (
    <aside aria-label={ariaLabel} className={cn('rounded-lg border bg-background p-4', className)}>
      <div className={cn('space-y-5 transition-opacity', loading ? 'opacity-60' : 'opacity-100')}>
        {columnIds.map((columnId) => {
          const column = columns.find((c) => c.id === columnId);
          if (!column) return null;
          const options = facets[columnId] ?? [];

          return (
            <div key={columnId}>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {column.displayName}
              </p>
              <div className="mt-2 space-y-1">
                {options.length === 0 && (
                  <p className="text-xs text-muted-foreground">
                    {loading ? 'Loading…' : 'No values'}
                  </p>
                )}
                {options.map((option) => {
                  const active = isActive(columnId, option.value);
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => handleToggle(columnId, column.type, option.value)}
                      aria-pressed={active}
                      className={cn(
                        'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors',
                        'focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                        active ? 'bg-primary/10 text-primary' : 'text-foreground hover:bg-muted'
                      )}
                    >
                      <Checkbox checked={active} tabIndex={-1} className="pointer-events-none" />
                      <span className="flex-1 truncate">{option.value}</span>
                      <span className="font-mono text-xs text-muted-foreground">
                        {option.count}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}

        {rangeColumnIds.map((columnId) => {
          const column = columns.find((c) => c.id === columnId);
          if (!column) return null;
          const range = ranges[columnId];

          return (
            <div key={columnId}>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {column.displayName}
              </p>
              <p className="mt-2 text-sm text-foreground">
                {range ? `${range[0]} – ${range[1]}` : loading ? 'Loading…' : 'No data'}
              </p>
            </div>
          );
        })}
      </div>
    </aside>
  );
}

export const FacetedFilterSidebar = React.memo(
  FacetedFilterSidebarComponent
) as typeof FacetedFilterSidebarComponent;

'use client';

import type { FilterState } from '@better-tables/core';
import { filterHasValue, httpAdapter, serializeFiltersToURL } from '@better-tables/core';
import { toggleFacetValue, useFacets } from '@better-tables/ui';
import { useMemo } from 'react';
import { useNextjsUrlAdapter } from '@/lib/nextjs-url-adapter';
import { cn } from '@/lib/utils';

interface FacetColumnConfig {
  columnId: string;
  label: string;
  type: FilterState['type'];
}

const FACET_COLUMNS: FacetColumnConfig[] = [
  { columnId: 'status', label: 'Status', type: 'option' },
  { columnId: 'priority', label: 'Priority', type: 'option' },
  { columnId: 'customer.plan', label: 'Customer plan', type: 'option' },
];
const FACET_COLUMN_IDS = FACET_COLUMNS.map((c) => c.columnId);
const RANGE_COLUMN_IDS = ['reopenCount'];

interface FacetsSidebarProps {
  activeFilters: FilterState[];
}

/**
 * Facet sidebar: `httpAdapter` talks to `/api/tables/tickets`, and `useFacets`
 * loads counts/ranges for the active filters. Toggle a value to update the URL.
 */
export function FacetsSidebar({ activeFilters }: FacetsSidebarProps) {
  const urlAdapter = useNextjsUrlAdapter();

  // Browser proxy to the server Drizzle adapter.
  const adapter = useMemo(() => httpAdapter({ url: '/api/tables/tickets' }), []);

  const { facets, ranges, loading } = useFacets({
    adapter,
    columnIds: FACET_COLUMN_IDS,
    rangeColumnIds: RANGE_COLUMN_IDS,
    filters: activeFilters,
  });

  const reopenRange = ranges.reopenCount ?? null;

  const isActive = (columnId: string, value: string) =>
    activeFilters.some((f) => f.columnId === columnId && filterHasValue(f, value));

  const toggleValue = (config: FacetColumnConfig, value: string) => {
    const next = toggleFacetValue(activeFilters, config.columnId, config.type, value);
    urlAdapter.setParams({
      filters: next.length > 0 ? serializeFiltersToURL(next) : null,
      page: '1',
    });
  };

  return (
    <aside
      aria-label="Facet sidebar"
      className="rounded-lg border border-border bg-card p-4 md:p-5"
    >
      <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-ledger">Facets</p>
      <p className="mt-2 text-sm text-muted-foreground">
        Counts reflect every OTHER active filter -- a column's own filter never narrows its own
        facet (self-exclusion).
      </p>

      <div
        className={cn('mt-4 space-y-5 transition-opacity', loading ? 'opacity-60' : 'opacity-100')}
      >
        {FACET_COLUMNS.map((config) => (
          <div key={config.columnId}>
            <p className="font-mono text-xs text-ledger">{config.label}</p>
            <div className="mt-2 space-y-1">
              {(facets[config.columnId] ?? []).map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => toggleValue(config, option.value)}
                  className={cn(
                    'flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-sm transition-colors',
                    isActive(config.columnId, option.value)
                      ? 'bg-ledger/15 text-ledger'
                      : 'text-foreground hover:bg-white/5'
                  )}
                >
                  <span>{option.value}</span>
                  <span className="font-mono text-xs text-muted-foreground tabular-nums">
                    {option.count}
                  </span>
                </button>
              ))}
            </div>
          </div>
        ))}

        <div>
          <p className="font-mono text-xs text-muted-foreground">Reopens (getMinMaxValues)</p>
          <p className="mt-2 text-sm text-muted-foreground tabular-nums">
            {reopenRange ? `${reopenRange[0]} – ${reopenRange[1]}` : 'Loading...'}
          </p>
        </div>
      </div>
    </aside>
  );
}

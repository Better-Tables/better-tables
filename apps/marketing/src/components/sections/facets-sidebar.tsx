'use client';

import { useEffect, useState } from 'react';
import type { FilterState } from '@better-tables/core';
import { serializeFiltersToURL } from '@better-tables/core';
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

interface FacetsSidebarProps {
  activeFilters: FilterState[];
}

/**
 * DX-FINDING-7b: hand-built end to end -- no `<FacetedFilterSidebar>` (or
 * equivalent) exists in `@better-tables/ui` to reuse. Fetches
 * `/api/facets` (a route handler wrapping `adapter.getFacetedValues`/
 * `getMinMaxValues`, DX-FINDING-7a) on mount and whenever the caller's
 * active filters change, and lets clicking an option TOGGLE it as a real
 * filter via the URL (so the main table and this sidebar stay in sync
 * through the same `c2:` URL state). See plans/findings/029-dx-findings.md #7.
 */
export function FacetsSidebar({ activeFilters }: FacetsSidebarProps) {
  const urlAdapter = useNextjsUrlAdapter();
  const [facets, setFacets] = useState<Record<string, [string, number][]>>({});
  const [reopenRange, setReopenRange] = useState<[number, number] | null>(null);
  const [loading, setLoading] = useState(true);

  const filtersParam = activeFilters.length > 0 ? serializeFiltersToURL(activeFilters) : '';

  useEffect(() => {
    let cancelled = false;

    async function loadFacets() {
      setLoading(true);
      const query = filtersParam ? `&filters=${encodeURIComponent(filtersParam)}` : '';

      const [facetResults, minMaxResult] = await Promise.all([
        Promise.all(
          FACET_COLUMNS.map(async (config) => {
            const response = await fetch(`/api/facets?column=${config.columnId}${query}`);
            // Not a library-related cast -- `Response.json()` is always
            // `any`; this just types OUR OWN route handler's response shape
            // (`src/app/api/facets/route.ts`), unrelated to
            // `@better-tables/*`.
            const json = await response.json();
            return [config.columnId, (json.values ?? []) as [string, number][]] as const;
          })
        ),
        fetch(`/api/facets?column=reopenCount&kind=minmax${query}`).then((r) => r.json()),
      ]);

      if (cancelled) return;
      setFacets(Object.fromEntries(facetResults));
      if (typeof minMaxResult.min === 'number' && typeof minMaxResult.max === 'number') {
        setReopenRange([minMaxResult.min, minMaxResult.max]);
      }
      setLoading(false);
    }

    loadFacets().catch(() => {
      if (!cancelled) setLoading(false);
    });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtersParam]);

  // DX-FINDING-17: `FilterState.values` is a discriminated union field
  // (string[] | number[] | boolean[] | ...) -- `.includes(value)` needs
  // `f.values` cast to compare against a plain string regardless of the
  // filter's real type. See plans/findings/029-dx-findings.md #17.
  const isActive = (columnId: string, value: string) =>
    activeFilters.some(
      (f) => f.columnId === columnId && (f.values as unknown[]).includes(value)
    );

  const toggleValue = (config: FacetColumnConfig, value: string) => {
    const withoutColumn = activeFilters.filter((f) => f.columnId !== config.columnId);
    const currentlyActive = isActive(config.columnId, value);

    const nextFilters: FilterState[] = currentlyActive
      ? withoutColumn
      : [
          ...withoutColumn,
          // DX-FINDING-1 / DX-FINDING-17: `config.type` is a non-literal
          // `FilterState['type']` here, so `values: [value]` can't be
          // matched to the specific union member's `values` element type
          // without a cast. See plans/findings/029-dx-findings.md #1, #17.
          {
            columnId: config.columnId,
            type: config.type,
            operator: 'is',
            values: [value],
          } as FilterState,
        ];

    urlAdapter.setParams({
      filters: nextFilters.length > 0 ? serializeFiltersToURL(nextFilters) : null,
      page: '1',
    });
  };

  return (
    <aside
      aria-label="Facet sidebar"
      className="rounded-xl border border-[#27272A] bg-[#111217] p-4 md:p-5"
    >
      <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-[#60A5FA]">Facets</p>
      <p className="mt-2 text-sm text-muted-foreground">
        Counts reflect every OTHER active filter -- a column's own filter never narrows its own
        facet (self-exclusion).
      </p>

      <div className={cn('mt-4 space-y-5 transition-opacity', loading ? 'opacity-60' : 'opacity-100')}>
        {FACET_COLUMNS.map((config) => (
          <div key={config.columnId}>
            <p className="font-mono text-xs text-[#5EEAD4]">{config.label}</p>
            <div className="mt-2 space-y-1">
              {(facets[config.columnId] ?? []).map(([value, count]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => toggleValue(config, value)}
                  className={cn(
                    'flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-sm transition-colors',
                    isActive(config.columnId, value)
                      ? 'bg-[#60A5FA]/15 text-[#60A5FA]'
                      : 'text-foreground hover:bg-white/5'
                  )}
                >
                  <span>{value}</span>
                  <span className="font-mono text-xs text-muted-foreground">{count}</span>
                </button>
              ))}
            </div>
          </div>
        ))}

        <div>
          <p className="font-mono text-xs text-[#FBBF24]">Reopens (getMinMaxValues)</p>
          <p className="mt-2 text-sm text-muted-foreground">
            {reopenRange ? `${reopenRange[0]} – ${reopenRange[1]}` : 'Loading...'}
          </p>
        </div>
      </div>
    </aside>
  );
}

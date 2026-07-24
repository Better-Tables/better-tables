'use client';

import { useMemo } from 'react';
import { TicketsTableClient } from '@/components/sections/tickets-table-client';
import { buttonVariants } from '@/components/ui/button';
import type { FetchTicketsResult } from '@/lib/demo/support/fetch-tickets';
import {
  buildRelationshipTrail,
  supportScenarioPresets,
} from '@/lib/demo/support/relationship-trail';
import { serializeSupportPresetToUrl } from '@/lib/demo/support/serialize-preset';
import { UrlNavigationPendingProvider, useNextjsUrlAdapter } from '@/lib/nextjs-url-adapter';
import { cn } from '@/lib/utils';

interface SupportDemoWorkspaceProps {
  fetchResult: FetchTicketsResult;
}

/**
 * Provider wrapper so a preset/reset click (this component's hook) and the
 * table's dim-while-pending (`TicketsTableClient`'s hook) share one
 * transition — the inner component's hook must run UNDER the provider.
 */
export function SupportDemoWorkspace(props: SupportDemoWorkspaceProps) {
  return (
    <UrlNavigationPendingProvider>
      <SupportDemoWorkspaceInner {...props} />
    </UrlNavigationPendingProvider>
  );
}

function SupportDemoWorkspaceInner({ fetchResult }: SupportDemoWorkspaceProps) {
  const { result, filters, sorting, error } = fetchResult;
  const { adapter: urlAdapter } = useNextjsUrlAdapter();
  const relationshipTrail = useMemo(() => buildRelationshipTrail(filters), [filters]);

  const applyPreset = (presetId: string) => {
    const preset = supportScenarioPresets.find((item) => item.id === presetId);
    if (!preset) return;
    urlAdapter.setParams(serializeSupportPresetToUrl(preset));
  };

  const clearFilters = () => {
    urlAdapter.setParams({
      filters: null,
      sorting: null,
      page: '1',
    });
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <section
          aria-label="Support ticket table"
          className="rounded-lg border border-border bg-card p-4 md:p-6"
        >
          {error ? (
            <div
              role="alert"
              className="mb-4 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive"
            >
              Could not load ticket data: {error}
            </div>
          ) : null}

          <TicketsTableClient
            data={result.data ?? []}
            totalCount={result.total ?? 0}
            initialPagination={
              result.pagination ?? {
                page: 1,
                limit: 10,
                totalPages: 1,
                hasNext: false,
                hasPrev: false,
              }
            }
            initialSorting={sorting}
            initialFilters={filters}
          />
        </section>

        <aside
          aria-label="Relationship query trail"
          className="rounded-lg border border-border bg-card p-4 md:p-5 xl:sticky xl:top-[calc(var(--header-height)+1rem)] xl:self-start"
        >
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-ledger">
            Query trail
          </p>
          <h2 className="mt-2 text-lg font-semibold text-foreground">Active relationships</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Each relationship filter names the related entity and field the adapter resolves
            automatically.
          </p>

          <div className="mt-4 space-y-3">
            {relationshipTrail.length === 0 ? (
              <p className="rounded-lg border border-dashed border-border px-3 py-4 text-sm text-muted-foreground">
                Add a filter on customer or assignee fields to see the relationship trail update.
              </p>
            ) : (
              relationshipTrail.map((step, index) => (
                <div
                  key={step.id}
                  className="rounded-lg border border-border bg-background px-3 py-3"
                >
                  <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                    Step {index + 1}
                  </p>
                  <p className="mt-2 font-mono text-xs text-ledger">
                    {step.entity}.{step.field}
                  </p>
                  <p className="mt-2 text-sm leading-6 text-foreground">{step.sentence}</p>
                </div>
              ))
            )}
          </div>

          <div className="mt-6 border-t border-border pt-4">
            <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
              Scenarios
            </p>
            <div className="mt-3 space-y-2">
              {supportScenarioPresets.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => applyPreset(preset.id)}
                  className="w-full rounded-lg border border-border bg-background px-3 py-3 text-left transition-colors hover:border-ledger/50"
                >
                  <p className="text-sm font-medium text-foreground">{preset.label}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{preset.description}</p>
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={clearFilters}
              className={cn(buttonVariants({ variant: 'outline' }), 'mt-3 w-full')}
            >
              Reset filters
            </button>
          </div>
        </aside>
      </div>
    </div>
  );
}

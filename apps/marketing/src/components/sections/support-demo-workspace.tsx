'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { TicketsTableClient } from '@/components/sections/tickets-table-client';
import { buttonVariants } from '@/components/ui/button';
import type { FetchTicketsResult } from '@/lib/demo/support/fetch-tickets';
import {
  buildRelationshipTrail,
  supportScenarioPresets,
} from '@/lib/demo/support/relationship-trail';
import { serializeSupportPresetToUrl } from '@/lib/demo/support/serialize-preset';
import { useNextjsUrlAdapter } from '@/lib/nextjs-url-adapter';
import { cn } from '@/lib/utils';

interface SupportDemoWorkspaceProps {
  fetchResult: FetchTicketsResult;
}

export function SupportDemoWorkspace({ fetchResult }: SupportDemoWorkspaceProps) {
  const { result, filters, sorting, error } = fetchResult;
  const urlAdapter = useNextjsUrlAdapter();
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
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <section
          aria-label="Support ticket table"
          className="rounded-xl border border-[#27272A] bg-[#111217] p-4 md:p-6"
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
          className="rounded-xl border border-[#27272A] bg-[#111217] p-4 md:p-5 xl:sticky xl:top-[calc(var(--header-height)+1rem)] xl:self-start"
        >
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-[#60A5FA]">
            Query trail
          </p>
          <h2 className="mt-2 text-lg font-semibold text-foreground">Active relationships</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Each relationship filter names the related entity and field the adapter resolves
            automatically.
          </p>

          <div className="mt-4 space-y-3">
            {relationshipTrail.length === 0 ? (
              <p className="rounded-lg border border-dashed border-[#27272A] px-3 py-4 text-sm text-muted-foreground">
                Add a filter on customer or assignee fields to see the relationship trail update.
              </p>
            ) : (
              relationshipTrail.map((step, index) => (
                <div
                  key={step.id}
                  className="rounded-lg border border-[#27272A] bg-[#09090B] px-3 py-3"
                >
                  <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                    Step {index + 1}
                  </p>
                  <p className="mt-2 font-mono text-xs text-[#5EEAD4]">
                    {step.entity}.{step.field}
                  </p>
                  <p className="mt-2 text-sm leading-6 text-foreground">{step.sentence}</p>
                </div>
              ))
            )}
          </div>

          <div className="mt-6 border-t border-[#27272A] pt-4">
            <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-[#FBBF24]">
              Scenarios
            </p>
            <div className="mt-3 space-y-2">
              {supportScenarioPresets.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => applyPreset(preset.id)}
                  className="w-full rounded-lg border border-[#27272A] bg-[#09090B] px-3 py-3 text-left transition-colors hover:border-[#60A5FA]/50"
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

      <section
        aria-label="Implementation anatomy"
        className="rounded-xl border border-[#27272A] bg-[#111217] p-5 md:p-6"
      >
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
          Implementation anatomy
        </p>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <div className="rounded-lg border border-[#27272A] bg-[#09090B] p-4">
            <p className="font-mono text-xs text-[#60A5FA]">Column ids</p>
            <p className="mt-2 text-sm text-muted-foreground">
              Relationship columns use dotted paths like <code>customer.plan</code> and{' '}
              <code>assignee.team</code>.
            </p>
          </div>
          <div className="rounded-lg border border-[#27272A] bg-[#09090B] p-4">
            <p className="font-mono text-xs text-[#5EEAD4]">Adapter</p>
            <p className="mt-2 text-sm text-muted-foreground">
              The Drizzle adapter resolves joins from schema relations — no hand-written JOIN
              clauses in the page code.
            </p>
          </div>
          <div className="rounded-lg border border-[#27272A] bg-[#09090B] p-4">
            <p className="font-mono text-xs text-[#FBBF24]">URL state</p>
            <p className="mt-2 text-sm text-muted-foreground">
              Filters and sorting stay in the query string so every scenario is shareable.
            </p>
          </div>
        </div>
        <div className="mt-4">
          <Link
            href="/#interactive-demo"
            className={cn(buttonVariants({ variant: 'ghost' }), 'px-0')}
          >
            Back to homepage demo
          </Link>
        </div>
      </section>
    </div>
  );
}

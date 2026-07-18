'use client';

import { isFilterGroupNode } from '@better-tables/core';
import { useMemo, useState } from 'react';
import { QueryGroupsTableClient } from '@/components/sections/query-groups-table-client';
import { buttonVariants } from '@/components/ui/button';
import type { FetchTicketsResult } from '@/lib/demo/support/fetch-tickets';
import { countFilterLeaves, describeFilters } from '@/lib/demo/support/filter-sentence';
import { queryGroupPresets } from '@/lib/demo/support/relationship-trail';
import { serializeSupportPresetToUrl } from '@/lib/demo/support/serialize-preset';
import { useNextjsUrlAdapter } from '@/lib/nextjs-url-adapter';
import { cn } from '@/lib/utils';

interface QueryGroupsWorkspaceProps {
  fetchResult: FetchTicketsResult;
  activePresetId: string | null;
}

export function QueryGroupsWorkspace({ fetchResult, activePresetId }: QueryGroupsWorkspaceProps) {
  const { result, filters, sorting, error } = fetchResult;
  const urlAdapter = useNextjsUrlAdapter();
  const [copied, setCopied] = useState(false);

  const activePreset = queryGroupPresets.find((preset) => preset.id === activePresetId) ?? null;

  const sentence = useMemo(() => {
    if (!activePreset) return null;
    return describeFilters(activePreset.filters);
  }, [activePreset]);

  const leafCount = useMemo(() => {
    if (!activePreset) return 0;
    return countFilterLeaves(activePreset.filters);
  }, [activePreset]);

  const isGroup = activePreset ? isFilterGroupNode(activePreset.filters) : false;

  const applyPreset = (presetId: string) => {
    const preset = queryGroupPresets.find((item) => item.id === presetId);
    if (!preset) return;
    urlAdapter.setParams({ ...serializeSupportPresetToUrl(preset), preset: presetId });
  };

  const clearFilters = () => {
    urlAdapter.setParams({ filters: null, sorting: null, page: '1', preset: null });
  };

  const copyLink = async () => {
    if (typeof window === 'undefined') return;
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard permission denied or unavailable -- non-fatal for a demo.
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <section
          aria-label="Query groups ticket table"
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

          <QueryGroupsTableClient
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
          aria-label="Query tree and scenarios"
          className="rounded-xl border border-[#27272A] bg-[#111217] p-4 md:p-5 xl:sticky xl:top-[calc(var(--header-height)+1rem)] xl:self-start"
        >
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-[#60A5FA]">
            Query tree
          </p>
          <h2 className="mt-2 text-lg font-semibold text-foreground">
            {activePreset ? activePreset.label : 'No scenario selected'}
          </h2>

          {sentence ? (
            <div className="mt-4 rounded-lg border border-[#27272A] bg-[#09090B] p-4">
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                {leafCount} condition{leafCount === 1 ? '' : 's'} &middot;{' '}
                {isGroup ? 'group node (AND/OR tree)' : 'flat array (implicit AND)'}
              </p>
              <p className="mt-2 font-mono text-sm leading-6 text-[#5EEAD4]">{sentence}</p>
            </div>
          ) : (
            <p className="mt-4 rounded-lg border border-dashed border-[#27272A] px-3 py-4 text-sm text-muted-foreground">
              Pick a scenario below to see its filter tree rendered as a sentence.
            </p>
          )}

          {activePreset ? (
            <button
              type="button"
              onClick={copyLink}
              className={cn(buttonVariants({ variant: 'outline' }), 'mt-4 w-full')}
            >
              {copied ? 'Copied!' : 'Copy shareable link'}
            </button>
          ) : null}

          <div className="mt-6 border-t border-[#27272A] pt-4">
            <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-[#FBBF24]">
              Scenarios
            </p>
            <div className="mt-3 space-y-2">
              {queryGroupPresets.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => applyPreset(preset.id)}
                  className={cn(
                    'w-full rounded-lg border px-3 py-3 text-left transition-colors',
                    activePresetId === preset.id
                      ? 'border-[#60A5FA]/60 bg-[#60A5FA]/10'
                      : 'border-[#27272A] bg-[#09090B] hover:border-[#60A5FA]/50'
                  )}
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

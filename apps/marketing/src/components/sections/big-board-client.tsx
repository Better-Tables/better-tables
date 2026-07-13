'use client';

import { useState } from 'react';
import { getFormatterForType } from '@better-tables/core';
import { VirtualizedTable } from '@better-tables/ui';
import { bulkTicketsTable } from '@/lib/demo/support/bulk-columns';
import { useNextjsUrlAdapter } from '@/lib/nextjs-url-adapter';
import type { BulkTicket } from '@/lib/demo/support/schema';
import { cn } from '@/lib/utils';

interface BigBoardClientProps {
  data: BulkTicket[];
  total: number;
  sortColumnId: string;
  sortDirection: 'asc' | 'desc';
}

const statusColors: Record<string, string> = {
  open: 'text-[#60A5FA]',
  pending: 'text-[#FBBF24]',
  resolved: 'text-[#5EEAD4]',
  escalated: 'text-destructive',
};

const SORT_OPTIONS: { id: string; label: string }[] = [
  { id: 'createdAt', label: 'Opened' },
  { id: 'status', label: 'Status' },
  { id: 'priority', label: 'Priority' },
  { id: 'customerName', label: 'Customer' },
];

/**
 * DX-FINDING-6: `<VirtualizedTable>` has no adapter/filter/sort/pagination
 * integration of its own -- this component hand-builds a sort toolbar (a
 * plain `<select>` + direction toggle, not `<BetterTable>`'s
 * header-context-menu sort UI) that pushes a `sorting` URL param and lets
 * the RSC page refetch ALL rows sorted server-side. There is no filter bar
 * at all: wiring one up here would mean reimplementing `<BetterTable>`'s
 * entire filter-state management by hand just to feed this component's flat
 * `data` prop. See plans/findings/029-dx-findings.md #6.
 */
export function BigBoardClient({ data, total, sortColumnId, sortDirection }: BigBoardClientProps) {
  const urlAdapter = useNextjsUrlAdapter();
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());

  const columns = bulkTicketsTable.columns;

  const toggleExpanded = (id: number) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const applySort = (columnId: string, direction: 'asc' | 'desc') => {
    urlAdapter.setParams({ sortColumn: columnId, sortDirection: direction });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-[#27272A] bg-[#09090B] px-4 py-3">
        <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
          Sort by
        </span>
        <select
          value={sortColumnId}
          onChange={(event) => applySort(event.target.value, sortDirection)}
          className="rounded-md border border-[#27272A] bg-[#111217] px-2 py-1 text-sm text-foreground"
        >
          {SORT_OPTIONS.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => applySort(sortColumnId, sortDirection === 'asc' ? 'desc' : 'asc')}
          className="rounded-md border border-[#27272A] bg-[#111217] px-3 py-1 text-sm text-foreground hover:border-[#60A5FA]/50"
        >
          {sortDirection === 'asc' ? 'Ascending' : 'Descending'}
        </button>
        <span className="ml-auto font-mono text-xs text-muted-foreground">
          {total.toLocaleString()} rows, all rendered virtualized
        </span>
      </div>

      <VirtualizedTable<BulkTicket>
        data={data}
        columns={columns}
        height={640}
        rowHeight={56}
        dynamicRowHeight
        aria-label="Big board of support tickets"
        onRowClick={(item) => toggleExpanded(item.id)}
        renderCell={(value, column, item) => {
          if (column.id === 'description') {
            const expanded = expandedIds.has(item.id);
            const text = String(value ?? '');
            return (
              <p className={cn('text-sm text-muted-foreground', expanded ? '' : 'line-clamp-1')}>
                {text}
              </p>
            );
          }
          if (column.id === 'status') {
            return (
              <span className={cn('font-mono text-xs uppercase', statusColors[String(value)] ?? '')}>
                {String(value)}
              </span>
            );
          }
          if (column.id === 'createdAt') {
            // DX-FINDING-6 addendum: <VirtualizedTable> passes the RAW cell
            // value to `renderCell` -- it does NOT apply the column's own
            // configured formatter (here, `.dateTime({ timeZone: ... })`)
            // the way <BetterTable> does automatically. `getFormatterForType`
            // (packages/core/src/lib/format-utils.ts) is the same formatter
            // <BetterTable> uses internally and IS exported publicly, so
            // reusing it here (rather than hand-rolling date formatting
            // again) is a one-line fix -- but it has to be done explicitly,
            // every time, per column. See plans/findings/029-dx-findings.md #6.
            return (
              <span className="text-xs text-muted-foreground">
                {getFormatterForType(column.type, value, column.meta)}
              </span>
            );
          }
          return <span className="text-sm text-foreground">{String(value ?? '')}</span>;
        }}
      />
    </div>
  );
}

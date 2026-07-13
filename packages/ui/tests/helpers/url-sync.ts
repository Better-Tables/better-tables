import type { ColumnDefinition, FilterState, UrlSyncAdapter } from '@better-tables/core';
import { serializeFiltersToURL } from '@better-tables/core';

interface TestRow {
  id: string;
  name: string;
}

export const mockColumns: ColumnDefinition<TestRow>[] = [
  {
    id: 'name',
    displayName: 'Name',
    type: 'text',
    accessor: (row) => row.name,
    filterable: true,
    sortable: true,
    resizable: true,
  },
];

export function createFakeUrlAdapter(initial: Record<string, string> = {}) {
  const params = new Map(Object.entries(initial));
  const setParamsCalls: Record<string, string | null>[] = [];

  const adapter: UrlSyncAdapter = {
    getParam: (key: string) => params.get(key) ?? null,
    setParams: (updates: Record<string, string | null>) => {
      setParamsCalls.push(updates);
      for (const [key, value] of Object.entries(updates)) {
        if (value === null) {
          params.delete(key);
        } else {
          params.set(key, value);
        }
      }
    },
  };

  return { adapter, setParamsCalls, params };
}

export function urlFilterForName(value: string): string {
  const filter: FilterState = {
    columnId: 'name',
    type: 'text',
    operator: 'contains',
    values: [value],
  };
  return serializeFiltersToURL([filter]);
}

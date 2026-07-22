import { describe, expect, it } from 'bun:test';
import {
  assertAggregateCapabilities,
  collectDerivedFetchSpecs,
  withDerivedFetchParams,
} from '../../src/lib/derived-params';
import type { AdapterMeta } from '../../src/types/adapter';
import type { ColumnDefinition } from '../../src/types/column';
import type { AggregateCapabilities } from '../../src/types/derived';

const baseMeta: AdapterMeta = {
  name: 'stub',
  version: '1.0.0',
  features: {
    create: false,
    read: true,
    update: false,
    delete: false,
    bulkOperations: false,
    realTimeUpdates: false,
    export: false,
    transactions: false,
  },
  supportedColumnTypes: ['number'],
  supportedOperators: {
    text: [],
    number: ['greaterThan'],
    date: [],
    boolean: [],
    option: [],
    multiOption: [],
    currency: [],
    percentage: [],
    url: [],
    email: [],
    phone: [],
    json: [],
    custom: [],
  },
};

const fullAggregates: AggregateCapabilities = {
  fns: ['count', 'sum', 'avg', 'min', 'max'],
  render: true,
  filter: true,
  sort: true,
};

const columns = [
  {
    id: 'name',
    displayName: 'Name',
    type: 'text',
    accessor: (r: { name: string }) => r.name,
  },
  {
    id: 'postsCount',
    displayName: 'Posts',
    type: 'number',
    accessor: (r: { postsCount?: number }) => r.postsCount ?? 0,
    derived: { kind: 'aggregate', relation: 'posts', fn: 'count' },
  },
] as ColumnDefinition[];

const postsCountSpec = {
  columnId: 'postsCount',
  kind: 'aggregate' as const,
  relation: 'posts',
  fn: 'count' as const,
};

describe('derived-params (plan 060)', () => {
  it('collectDerivedFetchSpecs scopes to requested column ids', () => {
    expect(collectDerivedFetchSpecs(columns, ['name'])).toEqual([]);
    expect(collectDerivedFetchSpecs(columns, ['postsCount'])).toEqual([postsCountSpec]);
    expect(collectDerivedFetchSpecs(columns)).toHaveLength(1);
  });

  it('assertAggregateCapabilities rejects missing capability block', () => {
    expect(() => assertAggregateCapabilities(baseMeta, [postsCountSpec], {})).toThrow(
      /capabilities\.aggregates/
    );
  });

  it('assertAggregateCapabilities rejects aggregates.render=false', () => {
    const meta: AdapterMeta = {
      ...baseMeta,
      capabilities: { aggregates: { ...fullAggregates, render: false } },
    };
    expect(() => assertAggregateCapabilities(meta, [postsCountSpec], {})).toThrow(
      /aggregates\.render=false/
    );
  });

  it('assertAggregateCapabilities rejects unsupported aggregate fn', () => {
    const meta: AdapterMeta = {
      ...baseMeta,
      capabilities: {
        aggregates: { fns: ['count'], render: true, filter: true, sort: true },
      },
    };
    expect(() =>
      assertAggregateCapabilities(
        meta,
        [{ columnId: 'total', kind: 'aggregate', relation: 'orders', fn: 'sum', field: 'amount' }],
        {}
      )
    ).toThrow(/does not support aggregate fn 'sum'/);
  });

  it('assertAggregateCapabilities rejects aggregates.filter=false when filtering derived', () => {
    const meta: AdapterMeta = {
      ...baseMeta,
      capabilities: { aggregates: { ...fullAggregates, filter: false } },
    };
    expect(() =>
      assertAggregateCapabilities(meta, [postsCountSpec], {
        filters: [{ columnId: 'postsCount', type: 'number', operator: 'greaterThan', values: [1] }],
      })
    ).toThrow(/aggregates\.filter=false/);
  });

  it('assertAggregateCapabilities rejects aggregates.sort=false when sorting derived', () => {
    const meta: AdapterMeta = {
      ...baseMeta,
      capabilities: { aggregates: { ...fullAggregates, sort: false } },
    };
    expect(() =>
      assertAggregateCapabilities(meta, [postsCountSpec], {
        sorting: [{ columnId: 'postsCount', direction: 'asc' }],
      })
    ).toThrow(/aggregates\.sort=false/);
  });

  it('withDerivedFetchParams attaches specs when capable', () => {
    const meta: AdapterMeta = {
      ...baseMeta,
      capabilities: { aggregates: { ...fullAggregates } },
    };
    const params = withDerivedFetchParams(columns, { columns: ['postsCount'] }, meta);
    expect(params.derived).toEqual([postsCountSpec]);
  });

  it('withDerivedFetchParams returns params unchanged when no derived columns apply', () => {
    const meta: AdapterMeta = {
      ...baseMeta,
      capabilities: { aggregates: { ...fullAggregates } },
    };
    const input = { columns: ['name'] as string[] };
    const params = withDerivedFetchParams(columns, input, meta);
    expect(params).toBe(input);
    expect(params.derived).toBeUndefined();
  });

  it('withDerivedFetchParams includes derived columns referenced by filters even if omitted from columns', () => {
    const meta: AdapterMeta = {
      ...baseMeta,
      capabilities: { aggregates: { ...fullAggregates } },
    };
    const params = withDerivedFetchParams(
      columns,
      {
        columns: ['name'],
        filters: [{ columnId: 'postsCount', type: 'number', operator: 'greaterThan', values: [2] }],
      },
      meta
    );
    expect(params.derived).toEqual([postsCountSpec]);
  });
});

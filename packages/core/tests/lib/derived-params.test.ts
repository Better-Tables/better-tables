import { describe, expect, it } from 'bun:test';
import {
  assertAggregateCapabilities,
  collectDerivedFetchSpecs,
  withDerivedFetchParams,
} from '../../src/lib/derived-params';
import type { AdapterMeta } from '../../src/types/adapter';
import type { ColumnDefinition } from '../../src/types/column';

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

describe('derived-params (plan 060)', () => {
  it('collectDerivedFetchSpecs scopes to requested column ids', () => {
    expect(collectDerivedFetchSpecs(columns, ['name'])).toEqual([]);
    expect(collectDerivedFetchSpecs(columns, ['postsCount'])).toEqual([
      { columnId: 'postsCount', kind: 'aggregate', relation: 'posts', fn: 'count' },
    ]);
    expect(collectDerivedFetchSpecs(columns)).toHaveLength(1);
  });

  it('assertAggregateCapabilities rejects missing capability block', () => {
    expect(() =>
      assertAggregateCapabilities(
        baseMeta,
        [{ columnId: 'postsCount', kind: 'aggregate', relation: 'posts', fn: 'count' }],
        {}
      )
    ).toThrow(/capabilities\.aggregates/);
  });

  it('withDerivedFetchParams attaches specs when capable', () => {
    const meta: AdapterMeta = {
      ...baseMeta,
      capabilities: {
        aggregates: {
          fns: ['count', 'sum', 'avg', 'min', 'max'],
          render: true,
          filter: true,
          sort: true,
        },
      },
    };
    const params = withDerivedFetchParams(columns, { columns: ['postsCount'] }, meta);
    expect(params.derived).toEqual([
      { columnId: 'postsCount', kind: 'aggregate', relation: 'posts', fn: 'count' },
    ]);
  });
});

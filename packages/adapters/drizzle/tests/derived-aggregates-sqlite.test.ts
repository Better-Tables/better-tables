/**
 * Plan 060: derived aggregate columns via FetchDataParams.derived
 * (correlated subqueries on sqlite).
 */

import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import type { FilterGroupNode } from '@better-tables/core';
import { DrizzleAdapter } from '../src/drizzle-adapter';
import type { DrizzleDatabase } from '../src/types';
import { SchemaError } from '../src/types';
import { closeDatabase, createTestDatabase, setupTestDatabase } from './helpers/test-fixtures';
import { relationsSchema as testRelations, schema as testSchema } from './helpers/test-schema';

describe('Derived aggregates (plan 060) — SQLite', () => {
  let adapter: DrizzleAdapter<typeof testSchema, 'sqlite'>;
  let testDb: ReturnType<typeof createTestDatabase>['db'];
  let sqlite: ReturnType<typeof createTestDatabase>['sqlite'];

  beforeEach(async () => {
    const created = createTestDatabase();
    testDb = created.db;
    sqlite = created.sqlite;
    await setupTestDatabase(testDb);
    adapter = new DrizzleAdapter({
      db: testDb as unknown as DrizzleDatabase<'sqlite'>,
      schema: testSchema,
      driver: 'sqlite',
      relations: testRelations,
    });
  });

  afterEach(() => {
    closeDatabase(sqlite);
  });

  it('declares aggregates capabilities', () => {
    expect(adapter.meta.capabilities?.aggregates).toMatchObject({
      render: true,
      filter: true,
      sort: true,
      fns: expect.arrayContaining(['count', 'sum']),
    });
  });

  it('renders per-row relation counts', async () => {
    const result = await adapter.fetchData({
      primaryTable: 'users',
      columns: ['id', 'name', 'postsCount'],
      derived: [{ columnId: 'postsCount', kind: 'aggregate', relation: 'posts', fn: 'count' }],
      sorting: [{ columnId: 'id', direction: 'asc' }],
    });

    expect(result.data.length).toBe(3);
    const byName = Object.fromEntries(
      result.data.map((row) => {
        const r = row as { name: string; postsCount?: number };
        return [r.name, Number(r.postsCount)];
      })
    );
    // Seed: John 2 posts, Jane 1, Bob 0
    expect(byName['John Doe']).toBe(2);
    expect(byName['Jane Smith']).toBe(1);
    expect(byName['Bob Johnson']).toBe(0);
  });

  it('filters with greaterThan on count (flat AND)', async () => {
    const result = await adapter.fetchData({
      primaryTable: 'users',
      columns: ['id', 'name', 'postsCount'],
      derived: [{ columnId: 'postsCount', kind: 'aggregate', relation: 'posts', fn: 'count' }],
      filters: [
        {
          columnId: 'postsCount',
          type: 'number',
          operator: 'greaterThan',
          values: [1],
        },
      ],
    });

    expect(result.total).toBe(1);
    expect((result.data[0] as { name: string }).name).toBe('John Doe');
  });

  it('filters with count inside an OR FilterGroupNode (tree walk)', async () => {
    const filters: FilterGroupNode = {
      kind: 'group',
      logic: 'or',
      children: [
        {
          columnId: 'postsCount',
          type: 'number',
          operator: 'greaterThan',
          values: [1],
        },
        {
          columnId: 'name',
          type: 'text',
          operator: 'equals',
          values: ['Bob Johnson'],
        },
      ],
    };

    const result = await adapter.fetchData({
      primaryTable: 'users',
      columns: ['id', 'name', 'postsCount'],
      derived: [{ columnId: 'postsCount', kind: 'aggregate', relation: 'posts', fn: 'count' }],
      filters,
    });

    const names = result.data.map((row) => (row as { name: string }).name).sort();
    expect(names).toEqual(['Bob Johnson', 'John Doe']);
  });

  it('OR tree with filterSql aggregate + cross-table plain leaf still plans profile join', async () => {
    // When the tree is compiled to filterSql SQL, plain-column leaves must
    // still drive join planning via filterJoinLeaves (not only opaque SQL).
    const filters: FilterGroupNode = {
      kind: 'group',
      logic: 'or',
      children: [
        {
          columnId: 'postsCount',
          type: 'number',
          operator: 'greaterThan',
          values: [1],
        },
        {
          columnId: 'profile.bio',
          type: 'text',
          operator: 'equals',
          values: ['Designer'],
        },
      ],
    };

    const result = await adapter.fetchData({
      primaryTable: 'users',
      columns: ['id', 'name', 'postsCount'],
      derived: [{ columnId: 'postsCount', kind: 'aggregate', relation: 'posts', fn: 'count' }],
      filters,
    });

    const names = result.data.map((row) => (row as { name: string }).name).sort();
    expect(names).toEqual(['Jane Smith', 'John Doe']);
  });

  it('sorts by derived count', async () => {
    const result = await adapter.fetchData({
      primaryTable: 'users',
      columns: ['id', 'name', 'postsCount'],
      derived: [{ columnId: 'postsCount', kind: 'aggregate', relation: 'posts', fn: 'count' }],
      sorting: [{ columnId: 'postsCount', direction: 'desc' }],
    });

    const names = result.data.map((row) => (row as { name: string }).name);
    expect(names).toEqual(['John Doe', 'Jane Smith', 'Bob Johnson']);
  });

  it('throws SchemaError for an unknown relation', async () => {
    await expect(
      adapter.fetchData({
        primaryTable: 'users',
        columns: ['id'],
        derived: [
          { columnId: 'widgetsCount', kind: 'aggregate', relation: 'widgets', fn: 'count' },
        ],
      })
    ).rejects.toBeInstanceOf(SchemaError);
  });

  it('sums a numeric field on the related table', async () => {
    const result = await adapter.fetchData({
      primaryTable: 'users',
      columns: ['id', 'name', 'postsIdSum'],
      derived: [
        {
          columnId: 'postsIdSum',
          kind: 'aggregate',
          relation: 'posts',
          fn: 'sum',
          field: 'id',
        },
      ],
      sorting: [{ columnId: 'id', direction: 'asc' }],
    });

    const byName = Object.fromEntries(
      result.data.map((row) => {
        const r = row as { name: string; postsIdSum?: number };
        return [r.name, Number(r.postsIdSum)];
      })
    );
    expect(byName['John Doe']).toBe(1 + 2);
    expect(byName['Bob Johnson']).toBe(0);
  });
});

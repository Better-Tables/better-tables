/**
 * Filter-group translation tests (plan 017, design
 * `plans/design/core-contract-v2.md` §1.5).
 *
 * Until plan 017, this file asserted that the Drizzle adapter REJECTED a
 * `FilterGroupNode` tree (see git history: `filter-group-rejection.test.ts`).
 * Plan 017 replaces the interim reject-guard with a recursive AND/OR walk
 * (`FilterHandler.buildTreeCondition`, `FilterRouter.buildNodeCondition`), so
 * these tests now assert the adapter translates groups to real SQL and
 * returns the correct row set -- not just that the SQL "looks" right, but
 * that the actual rows/total match a hand-computed expectation (reviewer
 * note: SQL-string-shape tests would pass on wrong semantics).
 *
 * Fixture data (from `setupTestDatabase`, unmodified):
 *   users:  1 John Doe   (age 30, profile.bio 'Software developer')
 *           2 Jane Smith (age 25, profile.bio 'Designer')
 *           3 Bob Johnson (age 35, NO profile row)
 */

import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import type { FilterGroupNode, FilterNode, FilterState } from '@better-tables/core';
import { buildAdapterMeta } from '../src/adapter-meta';
import {
  closeDatabase,
  createTestAdapter,
  createTestDatabase,
  setupTestDatabase,
} from './helpers/test-fixtures';

describe('DrizzleAdapter - filter-group translation (plan 017)', () => {
  let adapter: ReturnType<typeof createTestAdapter>;
  let sqlite: ReturnType<typeof createTestDatabase>['sqlite'];

  beforeEach(async () => {
    const { db, sqlite: sqliteDb } = createTestDatabase();
    sqlite = sqliteDb;

    await setupTestDatabase(db);
    adapter = createTestAdapter(db);
  });

  afterEach(() => {
    closeDatabase(sqlite);
  });

  it('meta advertises supportsFilterGroups: true and maxGroupDepth: 3', () => {
    expect(adapter.meta.supportsFilterGroups).toBe(true);
    expect(adapter.meta.maxGroupDepth).toBe(3);
  });

  it('adapter.meta matches buildAdapterMeta for resolvable mutations', () => {
    expect(adapter.meta).toEqual(buildAdapterMeta(true));
  });

  it('flat regression: a flat FilterState[] still returns the same rows/total as before', async () => {
    const result = await adapter.fetchData({
      filters: [{ columnId: 'name', type: 'text', operator: 'contains', values: ['John'] }],
    });

    expect(result.total).toBe(2);
    const names = (result.data as Array<{ name: string }>).map((r) => r.name).sort();
    expect(names).toEqual(['Bob Johnson', 'John Doe']);
  });

  it('simple OR group returns exactly the union of both branches', async () => {
    const group: FilterGroupNode = {
      kind: 'group',
      logic: 'or',
      children: [
        { columnId: 'name', type: 'text', operator: 'equals', values: ['John Doe'] },
        { columnId: 'name', type: 'text', operator: 'equals', values: ['Bob Johnson'] },
      ],
    };

    const result = await adapter.fetchData({ filters: group });

    expect(result.total).toBe(2);
    const names = (result.data as Array<{ name: string }>).map((r) => r.name).sort();
    expect(names).toEqual(['Bob Johnson', 'John Doe']);
  });

  it('nested AND(leaf, OR(leaf, leaf)) returns the hand-computed intersection', async () => {
    // age > 28 AND (name = 'John Doe' OR name = 'Jane Smith')
    // age>28: John(30) true, Jane(25) false, Bob(35) true (but Bob not in the OR)
    // OR: John, Jane
    // AND: only John survives (Jane fails age>28, Bob fails the OR)
    const group: FilterGroupNode = {
      kind: 'group',
      logic: 'and',
      children: [
        { columnId: 'age', type: 'number', operator: 'greaterThan', values: [28] },
        {
          kind: 'group',
          logic: 'or',
          children: [
            { columnId: 'name', type: 'text', operator: 'equals', values: ['John Doe'] },
            { columnId: 'name', type: 'text', operator: 'equals', values: ['Jane Smith'] },
          ],
        },
      ],
    };

    const result = await adapter.fetchData({ filters: group });

    expect(result.total).toBe(1);
    expect((result.data[0] as { name: string }).name).toBe('John Doe');
  });

  it('cross-table leaf inside OR matches rows via EITHER branch, including one with no join partner', async () => {
    // name contains 'Bob' (matches Bob Johnson, who has NO profile row) OR
    // profile.bio = 'Designer' (matches Jane Smith, via a LEFT JOIN).
    // A wrong INNER JOIN would drop Bob before the WHERE clause ever runs,
    // since he has no profiles row -- this is the join-collection-from-tree-
    // leaves regression this plan calls out as the likeliest real bug.
    const group: FilterGroupNode = {
      kind: 'group',
      logic: 'or',
      children: [
        { columnId: 'name', type: 'text', operator: 'contains', values: ['Bob'] },
        { columnId: 'profile.bio', type: 'text', operator: 'equals', values: ['Designer'] },
      ],
    };

    // Deliberately omit `columns` referencing the joined table -- the join
    // must be driven purely by the filter tree, not by requested columns.
    const result = await adapter.fetchData({
      columns: ['id', 'name', 'email'],
      filters: group,
    });

    expect(result.total).toBe(2);
    const names = (result.data as Array<{ name: string }>).map((r) => r.name).sort();
    expect(names).toEqual(['Bob Johnson', 'Jane Smith']);
  });

  it('count/data agreement: total matches the distinct row count across all pages for the cross-table OR query', async () => {
    const group: FilterGroupNode = {
      kind: 'group',
      logic: 'or',
      children: [
        { columnId: 'name', type: 'text', operator: 'contains', values: ['Bob'] },
        { columnId: 'profile.bio', type: 'text', operator: 'equals', values: ['Designer'] },
      ],
    };

    const full = await adapter.fetchData({ columns: ['id', 'name'], filters: group });
    expect(full.total).toBe(full.data.length);

    // Walk it page by page (limit 1) and confirm the distinct ids collected
    // across pages equal `total` -- this is what would diverge if the count
    // query and the data query translated the OR tree differently.
    const seenIds = new Set<number>();
    let page = 1;
    let hasNext = true;
    while (hasNext) {
      const pageResult = await adapter.fetchData({
        columns: ['id', 'name'],
        filters: group,
        pagination: { page, limit: 1 },
      });
      expect(pageResult.total).toBe(full.total);
      for (const row of pageResult.data as Array<{ id: number }>) {
        seenIds.add(row.id);
      }
      hasNext = pageResult.pagination?.hasNext ?? false;
      page += 1;
    }

    expect(seenIds.size).toBe(full.total);
  });

  it('rejects a filter group nested deeper than maxGroupDepth (3), naming the cap', async () => {
    const leaf: FilterState = {
      columnId: 'name',
      type: 'text',
      operator: 'equals',
      values: ['John Doe'],
    };
    // 4 levels of group nesting -> depth 4 > maxGroupDepth 3.
    let deep: FilterNode = leaf;
    for (let i = 0; i < 4; i++) {
      deep = { kind: 'group', logic: 'and', children: [deep] };
    }

    await expect(adapter.fetchData({ filters: deep as FilterGroupNode })).rejects.toThrow(
      /maxGroupDepth/i
    );

    try {
      await adapter.fetchData({ filters: deep as FilterGroupNode });
      expect.unreachable('fetchData must reject an over-deep filter group');
    } catch (error) {
      expect((error as Error).name).toBe('QueryError');
      expect((error as Error).message).toContain('3');
    }
  });
});

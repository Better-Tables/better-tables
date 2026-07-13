/**
 * @fileoverview Row-set integration tests for filter-aware, self-excluded,
 * distinct-guarded facets (plan 021, ADAPTER-06).
 *
 * Uses the shared SQLite fixture (`setupTestDatabase`, unmodified):
 *   users:    1 John Doe   (age 30)
 *             2 Jane Smith (age 25)
 *             3 Bob Johnson (age 35)
 *   posts:    1 -> user 1, "First Post"  (published)
 *             2 -> user 1, "Second Post" (unpublished)
 *             3 -> user 2, "Design Tips" (published)
 *             (user 3/Bob has no posts)
 *
 * These assert actual returned rows/counts against hand-computed
 * expectations, not just that a query "was built" -- SQL-shape-only tests
 * would pass on wrong semantics (same bar `filter-group-translation.test.ts`
 * holds itself to for plan 017).
 */

import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import type { FilterGroupNode, FilterState } from '@better-tables/core';
import {
  closeDatabase,
  createTestAdapter,
  createTestDatabase,
  setupTestDatabase,
} from './helpers/test-fixtures';

describe('DrizzleAdapter - filter-aware facets (plan 021, ADAPTER-06)', () => {
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

  describe('regression: no filters means the pre-plan-021 behavior (facets describe the whole table)', () => {
    it('getFacetedValues with no params is unchanged', async () => {
      const facets = await adapter.getFacetedValues('age');
      expect(facets.get('30')).toBe(1);
      expect(facets.get('25')).toBe(1);
      expect(facets.get('35')).toBe(1);
    });

    it('getMinMaxValues with no params is unchanged', async () => {
      const [min, max] = await adapter.getMinMaxValues('age');
      expect(min).toBe(25);
      expect(max).toBe(35);
    });

    it('getFilterOptions with no params is unchanged', async () => {
      const options = await adapter.getFilterOptions('age');
      expect(options.map((o) => o.value).sort()).toEqual(['25', '30', '35']);
    });
  });

  describe('(a) facet counts for another column reflect only matching rows', () => {
    const ageGreaterThan28: FilterState = {
      columnId: 'age',
      type: 'number',
      operator: 'greaterThan',
      values: [28],
    };

    it('getFacetedValues for "name" only reflects users with age > 28', async () => {
      const facets = await adapter.getFacetedValues('name', { filters: [ageGreaterThan28] });

      expect(facets.get('John Doe')).toBe(1);
      expect(facets.get('Bob Johnson')).toBe(1);
      expect(facets.has('Jane Smith')).toBe(false);
    });

    it('getFilterOptions for "name" only reflects users with age > 28', async () => {
      const options = await adapter.getFilterOptions('name', { filters: [ageGreaterThan28] });
      const names = options.map((o) => o.value).sort();

      expect(names).toEqual(['Bob Johnson', 'John Doe']);
    });
  });

  describe('(b) facet counts for the filtered column itself IGNORE that filter (self-exclusion)', () => {
    const ageEquals30: FilterState = {
      columnId: 'age',
      type: 'number',
      operator: 'equals',
      values: [30],
    };

    it('getFacetedValues("age", { filters: [age = 30] }) still shows every age, not just 30', async () => {
      const facets = await adapter.getFacetedValues('age', { filters: [ageEquals30] });

      expect(facets.get('30')).toBe(1);
      expect(facets.get('25')).toBe(1);
      expect(facets.get('35')).toBe(1);
    });

    it('getFilterOptions("age", { filters: [age = 30] }) still shows every age', async () => {
      const options = await adapter.getFilterOptions('age', { filters: [ageEquals30] });

      expect(options.map((o) => o.value).sort()).toEqual(['25', '30', '35']);
    });

    it('getMinMaxValues("age", { filters: [age = 30] }) still spans the whole table', async () => {
      const [min, max] = await adapter.getMinMaxValues('age', { filters: [ageEquals30] });

      expect(min).toBe(25);
      expect(max).toBe(35);
    });

    it('self-exclusion holds for a FilterGroupNode tree, not just a flat array', async () => {
      // (age = 30) OR (name = 'Jane Smith') -- self-exclusion prunes the
      // 'age' leaf, leaving just "name = 'Jane Smith'" (Jane, age 25) as
      // the effective filter for the 'age' facet.
      const group: FilterGroupNode = {
        kind: 'group',
        logic: 'or',
        children: [
          ageEquals30,
          { columnId: 'name', type: 'text', operator: 'equals', values: ['Jane Smith'] },
        ],
      };

      const facets = await adapter.getFacetedValues('age', { filters: group });

      expect(facets.get('25')).toBe(1);
      expect(facets.has('30')).toBe(false);
      expect(facets.has('35')).toBe(false);
    });
  });

  describe('(c) facet counts under a one-to-many join count distinct primary rows', () => {
    // John (age 30) has two posts that both contain "Post"; Jane's post
    // "Design Tips" does not; Bob has no posts. Filtering by posts.title
    // joins users -> posts and fans John's row out to 2 join rows -- a
    // plain count() would (wrongly) count John's age-30 bucket as 2.
    const postsTitleContainsPost: FilterState = {
      columnId: 'posts.title',
      type: 'text',
      operator: 'contains',
      values: ['Post'],
    };

    it('getFacetedValues("age", { filters: [posts.title contains "Post"] }) counts John once, not twice', async () => {
      const facets = await adapter.getFacetedValues('age', {
        filters: [postsTitleContainsPost],
      });

      expect(facets.get('30')).toBe(1);
      expect(facets.has('25')).toBe(false);
      expect(facets.has('35')).toBe(false);
    });

    it('getFilterOptions("age", { filters: [posts.title contains "Post"] }) counts John once, not twice', async () => {
      const options = await adapter.getFilterOptions('age', {
        filters: [postsTitleContainsPost],
      });

      expect(options).toHaveLength(1);
      expect(options[0]?.value).toBe('30');
      expect(options[0]?.count).toBe(1);
    });
  });

  describe('(d) min/max respects filters', () => {
    it('getMinMaxValues("age", { filters: [name contains "John"] }) narrows to the filtered subset', async () => {
      // Filtering on a DIFFERENT column than the one min/max is requested
      // for (contrast (b), which filters the same column and must be
      // self-excluded instead). 'John' matches "John Doe" (30) and "Bob
      // Johnson" (35, via the "Johnson" substring) -- Jane Smith (25) does
      // not match and must not affect the range.
      const [min, max] = await adapter.getMinMaxValues('age', {
        filters: [{ columnId: 'name', type: 'text', operator: 'contains', values: ['John'] }],
      });

      expect(min).toBe(30);
      expect(max).toBe(35);
    });
  });
});

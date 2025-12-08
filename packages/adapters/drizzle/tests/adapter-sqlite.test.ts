/**
 * SQLite Integration Tests for DrizzleAdapter
 *
 * These tests verify the full integration of the DrizzleAdapter with SQLite,
 * including CRUD operations, filtering, sorting, pagination, and relationship handling.
 */

import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import type { FilterOperator, FilterState } from '@better-tables/core';
import { count, eq, gt, gte, lt, lte } from 'drizzle-orm';
import { DrizzleAdapter } from '../src/drizzle-adapter';
import type { DrizzleDatabase } from '../src/types';
import type { UserWithRelations } from './helpers';
import {
  closeDatabase,
  createTestAdapter,
  createTestDatabase,
  setupTestDatabase,
} from './helpers/test-fixtures';
import { relationsSchema as testRelations, schema as testSchema } from './helpers/test-schema';

describe('DrizzleAdapter - SQLite Integration', () => {
  let adapter: ReturnType<typeof createTestAdapter>;
  let testDb: ReturnType<typeof createTestDatabase>['db'];
  let sqlite: ReturnType<typeof createTestDatabase>['sqlite'];

  beforeEach(async () => {
    const { db, sqlite: sqliteDb } = createTestDatabase();
    testDb = db;
    sqlite = sqliteDb;

    await setupTestDatabase(db);
    adapter = createTestAdapter(db);
  });

  afterEach(() => {
    closeDatabase(sqlite);
  });

  describe('Basic CRUD Operations', () => {
    it('should fetch data without filters', async () => {
      const result = await adapter.fetchData({});

      expect(result.data).toHaveLength(3);
      expect(result.total).toBe(3);
      expect(result.data[0]).toHaveProperty('name');
      expect(result.data[0]).toHaveProperty('email');
    });

    it('should apply pagination', async () => {
      const result = await adapter.fetchData({
        pagination: { page: 1, limit: 2 },
      });

      expect(result.data).toHaveLength(2);
      expect(result.pagination?.hasNext).toBe(true);
      expect(result.pagination?.hasPrev).toBe(false);
    });

    it('should apply sorting', async () => {
      const result = await adapter.fetchData({
        sorting: [{ columnId: 'age', direction: 'desc' }],
      });

      expect((result.data[0] as UserWithRelations).age).toBe(35);
      expect((result.data[1] as UserWithRelations).age).toBe(30);
      expect((result.data[2] as UserWithRelations).age).toBe(25);
    });

    it('should use explicit primaryTable parameter', async () => {
      const result = await adapter.fetchData({
        primaryTable: 'users',
        columns: ['id', 'email'],
      });

      expect(result.data).toBeDefined();
      expect(result.data.length).toBeGreaterThan(0);
    });

    it('should use explicit primaryTable even when columns match other tables', async () => {
      // Explicit primaryTable should override automatic determination
      const result = await adapter.fetchData({
        primaryTable: 'users',
        columns: ['id', 'email', 'name'],
      });

      expect(result.data).toBeDefined();
      expect(result.data.length).toBeGreaterThan(0);
      // Verify it's actually querying users table
      expect(result.data[0]).toHaveProperty('email');
    });

    it('should automatically determine primary table when not specified', async () => {
      // Should automatically determine 'users' from columns
      const result = await adapter.fetchData({
        columns: ['id', 'email', 'name'],
      });

      expect(result.data).toBeDefined();
      expect(result.data.length).toBeGreaterThan(0);
      expect(result.data[0]).toHaveProperty('email');
    });
  });

  describe('Filtering Operations', () => {
    it('should filter by text contains', async () => {
      const result = await adapter.fetchData({
        filters: [
          {
            columnId: 'name',
            type: 'text',
            operator: 'contains',
            values: ['John'],
          },
        ],
      });

      expect(result.data).toHaveLength(2);
      const names = (result.data as UserWithRelations[]).map((r) => r.name).sort();
      expect(names).toContain('John Doe');
      expect(names).toContain('Bob Johnson');
    });

    it('should filter by number greater than', async () => {
      const result = await adapter.fetchData({
        filters: [
          {
            columnId: 'age',
            type: 'number',
            operator: 'greaterThan',
            values: [25],
          },
        ],
      });

      expect(result.data.length).toBeGreaterThan(0);
      expect((result.data as UserWithRelations[]).every((u) => (u.age ?? 0) > 25)).toBe(true);
    });

    it('should filter by text equals', async () => {
      const result = await adapter.fetchData({
        filters: [
          {
            columnId: 'name',
            type: 'text',
            operator: 'equals',
            values: ['John Doe'],
          },
        ],
      });

      expect(result.data).toHaveLength(1);
      expect((result.data[0] as UserWithRelations).name).toBe('John Doe');
    });

    it('should filter by number between', async () => {
      const result = await adapter.fetchData({
        filters: [
          {
            columnId: 'age',
            type: 'number',
            operator: 'between',
            values: [25, 30],
          },
        ],
      });

      expect(result.data).toHaveLength(2);
    });
  });

  describe('Relationship Handling', () => {
    it('should fetch data with one-to-one relationships', async () => {
      const result = await adapter.fetchData({
        columns: ['name', 'profile.bio'],
      });

      expect(result.data).toHaveLength(3);
      expect(result.data[0] as UserWithRelations).toHaveProperty('profile');
      expect((result.data[0] as UserWithRelations).profile).toHaveProperty('bio');
    });

    it('should fetch data with one-to-many relationships', async () => {
      const result = await adapter.fetchData({
        columns: ['name', 'posts.title'],
      });

      expect(result.data).toHaveLength(3);
      expect(result.data[0] as UserWithRelations).toHaveProperty('posts');
      expect(Array.isArray((result.data[0] as UserWithRelations).posts)).toBe(true);
    });

    it('should filter across relationships', async () => {
      const result = await adapter.fetchData({
        columns: ['name', 'email'],
        filters: [
          {
            columnId: 'profile.bio',
            type: 'text',
            operator: 'contains',
            values: ['developer'],
          },
        ],
      });

      expect(result.data).toHaveLength(1);
      expect((result.data[0] as UserWithRelations).name).toBe('John Doe');
    });
  });

  describe('JSON Accessor Columns', () => {
    it('should handle SQLite JSON text columns with accessors', async () => {
      // Test that we can fetch data with JSON accessor columns
      // This verifies that JSON accessor resolution (e.g., survey.title) actually works
      const result = await adapter.fetchData({
        columns: ['id', 'slug', 'survey.title'], // Include JSON accessor column to test accessor resolution
      });

      expect(result.data).toBeDefined();
      expect(result.data.length).toBeGreaterThan(0);
      // Verify that the JSON accessor was properly resolved
      const firstSurvey = result.data[0] as {
        id?: number;
        slug?: string;
        survey?: { title?: string };
      };
      expect(firstSurvey.survey?.title).toBeDefined();
      expect(firstSurvey.survey?.title).toBe('Vividness of Visual Imagery Questionnaire');
    });

    describe('Primary Table with JSON Accessor Columns', () => {
      it('should use explicit primaryTable with JSON accessor columns', async () => {
        // Scenario: 'title' is accessed via accessor from survey.survey.title (JSON text)
        // Explicit primaryTable ensures correct table selection even when accessor columns are used
        const result = await adapter.fetchData({
          primaryTable: 'surveys',
          columns: ['slug', 'status', 'survey.title'], // Mix of direct columns and JSON accessor
        });

        expect(result.data).toBeDefined();
        expect(result.data.length).toBeGreaterThan(0);
        // Verify it's querying surveys table
        const firstSurvey = result.data[0] as {
          slug?: string;
          status?: string;
          survey?: { title?: string };
        };
        expect(firstSurvey.slug).toBeDefined();
        // Verify JSON accessor was properly resolved
        expect(firstSurvey.survey?.title).toBeDefined();
        expect(firstSurvey.survey?.title).toBe('Vividness of Visual Imagery Questionnaire');
      });

      it('should automatically determine surveys table when mixing direct and accessor columns', async () => {
        // Scenario: 'title' would be from JSON accessor, but 'slug' and 'status' are direct columns
        // Should correctly identify 'surveys' as primary table based on direct column matches
        const result = await adapter.fetchData({
          columns: ['slug', 'status', 'survey.title'], // Mix of direct columns and JSON accessor
        });

        expect(result.data).toBeDefined();
        expect(result.data.length).toBeGreaterThan(0);
        const firstSurvey = result.data[0] as {
          slug?: string;
          status?: string;
          survey?: { title?: string };
        };
        expect(firstSurvey.slug).toBeDefined();
        // Verify JSON accessor was properly resolved
        expect(firstSurvey.survey?.title).toBeDefined();
      });

      it('should prefer surveys table when it has more matching direct columns', async () => {
        // Even if 'title' exists in posts table, surveys should win with more matches
        // Include JSON accessor to test that accessor resolution works correctly
        const result = await adapter.fetchData({
          columns: ['slug', 'status', 'totalResponses', 'survey.description'], // All direct columns in surveys + JSON accessor
        });

        expect(result.data).toBeDefined();
        expect(result.data.length).toBeGreaterThan(0);
        const firstSurvey = result.data[0] as {
          slug?: string;
          status?: string;
          survey?: { description?: string };
        };
        expect(firstSurvey.slug).toBeDefined();
        // Verify JSON accessor was properly resolved
        expect(firstSurvey.survey?.description).toBeDefined();
        expect(firstSurvey.survey?.description).toBe(
          'Discover the vividness of your visual imagination.'
        );
      });

      it('should resolve JSON accessor columns when using only accessors', async () => {
        // Test that accessor resolution works even when ONLY accessor columns are requested
        // This verifies that accessor resolution is actually being exercised, not just table selection
        const result = await adapter.fetchData({
          primaryTable: 'surveys',
          columns: ['survey.title', 'survey.description'], // Only JSON accessor columns, no direct columns
        });

        expect(result.data).toBeDefined();
        expect(result.data.length).toBeGreaterThan(0);
        const firstSurvey = result.data[0] as {
          survey?: { title?: string; description?: string };
        };
        // Verify JSON accessor was properly resolved - this would fail if accessor resolution is broken
        expect(firstSurvey.survey?.title).toBeDefined();
        expect(firstSurvey.survey?.title).toBe('Vividness of Visual Imagery Questionnaire');
        expect(firstSurvey.survey?.description).toBeDefined();
        expect(firstSurvey.survey?.description).toBe(
          'Discover the vividness of your visual imagination.'
        );
      });
    });
  });

  // TODO: Enable strict validation for invalid filter operators
  //
  // Skipped because URL-synced filters may contain invalid/partial states that
  // filter-handler.ts intentionally allows (see handleCrossTableFilters:672-710).
  // Consider adding a validation mode: strict for API calls, lenient for URL state.
  //
  // Related: packages/adapters/drizzle/src/filter-handler.ts:672-710 (commit 3f04f60)
  describe.skip('Error Handling', () => {
    it('should handle invalid column IDs', async () => {
      await expect(
        adapter.fetchData({
          columns: ['invalid.column'],
        })
      ).rejects.toThrow();
    });

    it('should handle invalid filter operators gracefully', async () => {
      // Adapter should throw an error for invalid operators
      await expect(
        adapter.fetchData({
          filters: [
            {
              columnId: 'name',
              type: 'text',
              operator: 'invalidOperator' as FilterOperator,
              values: ['test'],
            },
          ],
        })
      ).rejects.toThrow();
    });

    it('should throw error for invalid filter values', async () => {
      // Test invalid values (e.g. undefined for contains)
      await expect(
        adapter.fetchData({
          filters: [
            {
              columnId: 'name',
              type: 'text',
              operator: 'contains',
              values: [undefined], // Invalid value
            } as unknown as FilterState,
          ],
        })
      ).rejects.toThrow();
    });
  });

  describe('Computed Fields', () => {
    it('should compute simple fields from row data', async () => {
      const adapterWithComputed = new DrizzleAdapter({
        db: testDb as unknown as DrizzleDatabase<'sqlite'>,
        schema: testSchema,
        driver: 'sqlite',
        relations: testRelations,
        computedFields: {
          users: [
            {
              field: 'fullName',
              type: 'text',
              compute: (row: Record<string, unknown>) => `${row.name} (${row.email})`,
            },
            {
              field: 'isAdult',
              type: 'boolean',
              compute: (row: Record<string, unknown>) => {
                const age = (row.age as number | undefined) ?? 0;
                return age >= 18;
              },
            },
          ],
        },
      });

      const result = await adapterWithComputed.fetchData({
        columns: ['name', 'email', 'fullName', 'isAdult'],
      });

      expect(result.data.length).toBeGreaterThan(0);
      const firstRow = result.data[0] as Record<string, unknown>;
      expect(firstRow.fullName).toBeDefined();
      expect(firstRow.fullName).toBe(`${firstRow.name} (${firstRow.email})`);
      expect(firstRow.isAdult).toBeDefined();
      expect(typeof firstRow.isAdult).toBe('boolean');
    });

    it('should compute fields with database queries', async () => {
      const adapterWithComputed = new DrizzleAdapter({
        db: testDb as unknown as DrizzleDatabase<'sqlite'>,
        schema: testSchema,
        driver: 'sqlite',
        relations: testRelations,
        computedFields: {
          users: [
            {
              field: 'postCount',
              type: 'number',
              compute: async (row: Record<string, unknown>, context) => {
                // Type assertion needed: context.schema.posts is AnyTableType | undefined
                // biome-ignore lint/suspicious/noExplicitAny: Type assertion needed for schema access
                const postsTable = context.schema.posts as any;
                // biome-ignore lint/suspicious/noExplicitAny: Type assertion needed for database query
                const result = await (context.db as any)
                  .select({ count: count() })
                  .from(postsTable)
                  .where(eq(postsTable.userId, row.id as number));
                return Number(result[0]?.count || 0);
              },
            },
          ],
        },
      });

      const result = await adapterWithComputed.fetchData({
        columns: ['name', 'postCount'],
      });

      expect(result.data.length).toBeGreaterThan(0);
      const firstRow = result.data[0] as Record<string, unknown>;
      expect(firstRow.postCount).toBeDefined();
      expect(typeof firstRow.postCount).toBe('number');
      expect(firstRow.postCount).toBeGreaterThanOrEqual(0);
    });

    it('should filter computed fields from query building', async () => {
      const adapterWithComputed = new DrizzleAdapter({
        db: testDb as unknown as DrizzleDatabase<'sqlite'>,
        schema: testSchema,
        driver: 'sqlite',
        relations: testRelations,
        computedFields: {
          users: [
            {
              field: 'fullName',
              type: 'text',
              compute: (row) => `${row.name} (${row.email})`,
            },
          ],
        },
      });

      // Should not throw "Field not found" error
      const result = await adapterWithComputed.fetchData({
        columns: ['name', 'fullName'],
      });

      expect(result.data.length).toBeGreaterThan(0);
      const firstRow = result.data[0] as Record<string, unknown>;
      expect(firstRow.name).toBeDefined();
      expect(firstRow.fullName).toBeDefined();
    });

    it('should handle computed field filtering', async () => {
      const adapterWithComputed = new DrizzleAdapter({
        db: testDb as unknown as DrizzleDatabase<'sqlite'>,
        schema: testSchema,
        driver: 'sqlite',
        relations: testRelations,
        computedFields: {
          users: [
            {
              field: 'postCount',
              type: 'number',
              compute: async (row: Record<string, unknown>, context) => {
                // Type assertion needed: context.schema.posts is AnyTableType | undefined
                // biome-ignore lint/suspicious/noExplicitAny: Type assertion needed for schema access
                const postsTable = context.schema.posts as any;
                // biome-ignore lint/suspicious/noExplicitAny: Type assertion needed for database query
                const result = await (context.db as any)
                  .select({ count: count() })
                  .from(postsTable)
                  .where(eq(postsTable.userId, row.id as number));
                return Number(result[0]?.count || 0);
              },
              filter: async (filter, context) => {
                // Type assertion needed: context.schema.posts is AnyTableType | undefined
                // biome-ignore lint/suspicious/noExplicitAny: Type assertion needed for schema access
                const postsTable = context.schema.posts as any;
                // biome-ignore lint/suspicious/noExplicitAny: Type assertion needed for database query
                const postCountsSubquery = (context.db as any)
                  .select({
                    userId: postsTable.userId,
                    count: count().as('post_count'),
                  })
                  .from(postsTable)
                  .groupBy(postsTable.userId)
                  .as('post_counts');

                const filterValue = Number(filter.values?.[0] || 0);
                let condition: unknown;
                switch (filter.operator) {
                  case 'greaterThan':
                    condition = gt(postCountsSubquery.count, filterValue);
                    break;
                  case 'greaterThanOrEqual':
                    condition = gte(postCountsSubquery.count, filterValue);
                    break;
                  case 'lessThan':
                    condition = lt(postCountsSubquery.count, filterValue);
                    break;
                  case 'lessThanOrEqual':
                    condition = lte(postCountsSubquery.count, filterValue);
                    break;
                  case 'equals':
                    condition = eq(postCountsSubquery.count, filterValue);
                    break;
                  default:
                    return [];
                }

                // biome-ignore lint/suspicious/noExplicitAny: Type assertion needed for database query
                const matchingUsers = await (context.db as any)
                  .select({ userId: postCountsSubquery.userId })
                  .from(postCountsSubquery)
                  .where(condition);

                return [
                  {
                    columnId: 'id',
                    operator: 'isAnyOf',
                    values: matchingUsers.map((u: { userId: number }) => String(u.userId)),
                    type: 'text',
                  },
                ];
              },
            },
          ],
        },
      });

      // Filter by computed field
      const result = await adapterWithComputed.fetchData({
        columns: ['name', 'postCount'],
        filters: [{ columnId: 'postCount', operator: 'greaterThan', values: [0], type: 'number' }],
      });

      expect(result.data.length).toBeGreaterThanOrEqual(0);
      // All returned users should have postCount > 0
      for (const row of result.data) {
        const rowObj = row as Record<string, unknown>;
        if (rowObj.postCount !== undefined) {
          expect(Number(rowObj.postCount)).toBeGreaterThan(0);
        }
      }
    });

    it('should handle errors in compute functions gracefully', async () => {
      const adapterWithComputed = new DrizzleAdapter({
        db: testDb as unknown as DrizzleDatabase<'sqlite'>,
        schema: testSchema,
        driver: 'sqlite',
        relations: testRelations,
        computedFields: {
          users: [
            {
              field: 'errorField',
              type: 'text',
              compute: () => {
                throw new Error('Computation failed');
              },
            },
          ],
        },
      });

      const result = await adapterWithComputed.fetchData({
        columns: ['name', 'errorField'],
      });

      expect(result.data.length).toBeGreaterThan(0);
      const firstRow = result.data[0] as Record<string, unknown>;
      // Error field should be undefined when computation fails
      expect(firstRow.errorField).toBeUndefined();
    });

    it('should handle batch computation with context.allRows', async () => {
      const computeCalls: Array<{ rowId: unknown; allRowsCount: number }> = [];
      const adapterWithComputed = new DrizzleAdapter({
        db: testDb as unknown as DrizzleDatabase<'sqlite'>,
        schema: testSchema,
        driver: 'sqlite',
        relations: testRelations,
        computedFields: {
          users: [
            {
              field: 'batchComputed',
              type: 'number',
              compute: (row: Record<string, unknown>, context) => {
                computeCalls.push({ rowId: row.id, allRowsCount: context.allRows.length });
                // Return index in allRows as a simple batch computation example
                return context.allRows.findIndex(
                  (r) => (r as Record<string, unknown>).id === row.id
                );
              },
            },
          ],
        },
      });

      const result = await adapterWithComputed.fetchData({
        columns: ['name', 'batchComputed'],
        pagination: { page: 1, limit: 5 },
      });

      expect(result.data.length).toBeGreaterThan(0);
      expect(computeCalls.length).toBe(result.data.length);
      // Verify all rows received the same allRows array
      const allRowsCounts = computeCalls.map((c) => (c as { allRowsCount: number }).allRowsCount);
      expect(new Set(allRowsCounts).size).toBe(1); // All should have same count
    });

    it('should include joinCount in meta', async () => {
      const adapterWithComputed = new DrizzleAdapter({
        db: testDb as unknown as DrizzleDatabase<'sqlite'>,
        schema: testSchema,
        driver: 'sqlite',
        relations: testRelations,
        computedFields: {
          users: [
            {
              field: 'fullName',
              type: 'text',
              compute: (row) => `${row.name} (${row.email})`,
            },
          ],
        },
      });

      const result = await adapterWithComputed.fetchData({
        columns: ['name', 'profile.bio', 'fullName'],
      });

      expect(result.meta).toBeDefined();
      expect(result.meta?.joinCount).toBeDefined();
      expect(typeof result.meta?.joinCount).toBe('number');
      expect(result.meta?.joinCount).toBeGreaterThanOrEqual(0);
    });

    it('should work with multiple computed fields', async () => {
      const adapterWithComputed = new DrizzleAdapter({
        db: testDb as unknown as DrizzleDatabase<'sqlite'>,
        schema: testSchema,
        driver: 'sqlite',
        relations: testRelations,
        computedFields: {
          users: [
            {
              field: 'fullName',
              type: 'text',
              compute: (row) => `${row.name} (${row.email})`,
            },
            {
              field: 'isAdult',
              type: 'boolean',
              compute: (row: Record<string, unknown>) =>
                ((row.age as number | undefined) ?? 0) >= 18,
            },
            {
              field: 'ageGroup',
              type: 'text',
              compute: (row: Record<string, unknown>) => {
                const age = (row.age as number | undefined) ?? 0;
                if (age < 18) return 'minor';
                if (age < 65) return 'adult';
                return 'senior';
              },
            },
          ],
        },
      });

      const result = await adapterWithComputed.fetchData({
        columns: ['name', 'fullName', 'isAdult', 'ageGroup'],
      });

      expect(result.data.length).toBeGreaterThan(0);
      const firstRow = result.data[0] as Record<string, unknown>;
      expect(firstRow.fullName).toBeDefined();
      expect(firstRow.isAdult).toBeDefined();
      expect(firstRow.ageGroup).toBeDefined();
    });

    it('should fetch underlying column when requiresColumn is true', async () => {
      const adapterWithComputed = new DrizzleAdapter({
        db: testDb as unknown as DrizzleDatabase<'sqlite'>,
        schema: testSchema,
        driver: 'sqlite',
        relations: testRelations,
        computedFields: {
          users: [
            {
              field: 'age',
              type: 'text',
              requiresColumn: true, // This tells Better Tables to fetch the 'age' column
              compute: (row: Record<string, unknown>) => {
                // The 'age' column should be available because requiresColumn is true
                const ageValue = row.age as number | null | undefined;
                if (ageValue === null || ageValue === undefined) {
                  return 'Age not set';
                }
                return `Age: ${ageValue}`;
              },
            },
          ],
        },
      });

      const result = await adapterWithComputed.fetchData({
        columns: ['name', 'age'],
      });

      expect(result.data.length).toBeGreaterThan(0);
      const firstRow = result.data[0] as Record<string, unknown>;
      expect(firstRow.age).toBeDefined();
      expect(typeof firstRow.age).toBe('string');
      // Verify that the compute function could access the age column
      expect(firstRow.age).toMatch(/^(Age: \d+|Age not set)$/);
    });
  });
});

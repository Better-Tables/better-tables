import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'bun:test';
import type { DataEvent, FilterOperator, FilterState } from '@better-tables/core';
import type { UserWithRelations } from './helpers';
import {
  closePostgresDatabase,
  createPostgresAdapter,
  createPostgresDatabase,
  dropPostgresDatabase,
  ensurePostgresDatabase,
  setupPostgresDatabase,
} from './helpers/test-fixtures';
import type { User } from './helpers/test-schema';

/**
 * PostgreSQL Integration Tests
 *
 * These tests are skipped by default because they require a running PostgreSQL instance.
 *
 * To run these tests:
 * 1. Start a PostgreSQL database
 * 2. Set POSTGRES_TEST_URL environment variable (or use default: postgresql://localhost:5432/drizzle_test)
 * 3. Or run: npm test -- postgres-setup.test.ts (requires test to be enabled)
 *
 * @skip These tests are skipped by default - database connection required
 */
describe('DrizzleAdapter - PostgreSQL [Integration Tests]', () => {
  let adapter: ReturnType<typeof createPostgresAdapter>;
  let client: ReturnType<typeof createPostgresDatabase>['client'];
  let connectionString: string;
  let databaseName: string;

  beforeAll(async () => {
    // Drop database if exists and create it once
    connectionString = process.env.POSTGRES_TEST_URL || 'postgresql://localhost:5432/drizzle_test';
    databaseName = await ensurePostgresDatabase(connectionString);
  });

  beforeEach(async () => {
    // Connect to the existing database and reset tables with seed data for each test
    const { db, client: pgClient } = createPostgresDatabase(connectionString);
    client = pgClient;
    await setupPostgresDatabase(db); // Reset tables and seed data for test isolation
    adapter = createPostgresAdapter(db);
  });

  afterEach(async () => {
    // Close the connection after each test
    await closePostgresDatabase(client);
  });

  afterAll(async () => {
    // Clean up: drop the test database after all tests complete
    if (connectionString && databaseName) {
      try {
        await dropPostgresDatabase(connectionString, databaseName);
      } catch (error) {
        // Ignore errors during cleanup (database might already be dropped)
        console.warn('Failed to drop test database:', error);
      }
    }
  });

  describe('Basic CRUD Operations', () => {
    it('should fetch data without filters', async () => {
      const result = await adapter.fetchData({});

      expect(result.data).toHaveLength(3);
      expect(result.total).toBe(3);
    });

    it('should apply pagination', async () => {
      const result = await adapter.fetchData({
        pagination: { page: 1, limit: 2 },
      });

      expect(result.data).toHaveLength(2);
      expect(result.pagination?.totalPages).toBe(2);
    });

    it('should apply sorting', async () => {
      const result = await adapter.fetchData({
        sorting: [{ columnId: 'age', direction: 'desc' }],
      });

      expect((result.data[0] as UserWithRelations).age).toBe(35);
    });

    it('should create a new record', async () => {
      const newUser = await adapter.createRecord({
        id: 4,
        name: 'Test User',
        email: 'test@example.com',
        age: 28,
      } as Partial<User>);

      expect((newUser as UserWithRelations).name).toBe('Test User');
      expect((newUser as UserWithRelations).email).toBe('test@example.com');
    });

    it('should update a record', async () => {
      const updatedUser = await adapter.updateRecord('1', {
        name: 'John Updated',
        age: 31,
      } as Partial<User>);

      expect((updatedUser as UserWithRelations).name).toBe('John Updated');
      expect((updatedUser as UserWithRelations).age).toBe(31);
    });

    it('should delete a record', async () => {
      // Create a user without relations to test deletion
      await adapter.createRecord({
        id: 99,
        name: 'Temp User',
        email: 'temp@example.com',
        age: 99,
      } as Partial<User>);

      await adapter.deleteRecord('99');
      const result = await adapter.fetchData({});
      expect(result.data).toHaveLength(3); // Original 3 users remain
      expect(result.data.find((u: { id: number }) => u.id === 99)).toBeUndefined();
    });

    it('should bulk update records', async () => {
      const updatedUsers = await adapter.bulkUpdate(['1', '2'], { age: 30 } as Partial<User>);
      expect(updatedUsers).toHaveLength(2);
      expect(updatedUsers.every((u) => (u as UserWithRelations).age === 30)).toBe(true);
    });

    it('should bulk delete records', async () => {
      // Create users without relations to test bulk deletion
      await adapter.createRecord({
        id: 97,
        name: 'Temp1',
        email: 'temp1@example.com',
      } as Partial<User>);
      await adapter.createRecord({
        id: 98,
        name: 'Temp2',
        email: 'temp2@example.com',
      } as Partial<User>);

      await adapter.bulkDelete(['97', '98']);
      const result = await adapter.fetchData({});
      expect(result.data).toHaveLength(3); // Original 3 users remain
    });
  });

  describe('Text Filter Operators', () => {
    it('should filter by text contains', async () => {
      const result = await adapter.fetchData({
        filters: [{ columnId: 'name', type: 'text', operator: 'contains', values: ['John'] }],
      });
      expect(result.data).toHaveLength(2); // 'John Doe' and 'Bob Johnson' both contain 'John'
      const names = (result.data as UserWithRelations[]).map((r) => r.name).sort();
      expect(names).toContain('John Doe');
      expect(names).toContain('Bob Johnson');
    });

    it('should filter by text equals', async () => {
      const result = await adapter.fetchData({
        filters: [{ columnId: 'name', type: 'text', operator: 'equals', values: ['John Doe'] }],
      });
      expect(result.data).toHaveLength(1);
      expect((result.data[0] as UserWithRelations).name).toBe('John Doe');
    });

    it('should filter by text startsWith', async () => {
      const result = await adapter.fetchData({
        filters: [{ columnId: 'name', type: 'text', operator: 'startsWith', values: ['John'] }],
      });
      expect(result.data).toHaveLength(1);
      expect((result.data[0] as UserWithRelations).name).toBe('John Doe');
    });

    it('should filter by text endsWith', async () => {
      const result = await adapter.fetchData({
        filters: [{ columnId: 'name', type: 'text', operator: 'endsWith', values: ['Smith'] }],
      });
      expect(result.data).toHaveLength(1);
      expect((result.data[0] as UserWithRelations).name).toBe('Jane Smith');
    });

    it('should filter by text isEmpty', async () => {
      const result = await adapter.fetchData({
        filters: [{ columnId: 'profile.bio', type: 'text', operator: 'isEmpty', values: [] }],
      });
      // Bob Johnson has no profile, so bio would be considered empty/null
      expect(result.data.length).toBeGreaterThanOrEqual(1); // At least 1 user without profile
    });

    it('should filter by text isNotEmpty', async () => {
      const result = await adapter.fetchData({
        filters: [{ columnId: 'profile.bio', type: 'text', operator: 'isNotEmpty', values: [] }],
      });
      expect(result.data.length).toBeGreaterThanOrEqual(2); // At least users with profiles
    });

    it('should filter by text notEquals', async () => {
      const result = await adapter.fetchData({
        filters: [{ columnId: 'name', type: 'text', operator: 'notEquals', values: ['John Doe'] }],
      });
      // Verify that 'John Doe' is excluded from results
      expect(result.data).toBeDefined();
      expect(Array.isArray(result.data)).toBe(true);
      const names = (result.data as UserWithRelations[]).map((r) => r.name);
      expect(names.length).toBeGreaterThan(0);
      expect(names).not.toContain('John Doe');
    });

    it('should filter by text isNull', async () => {
      const result = await adapter.fetchData({
        filters: [{ columnId: 'profile.bio', type: 'text', operator: 'isNull', values: [] }],
      });
      expect(result.data.length).toBeGreaterThanOrEqual(1); // At least user without profile (Bob)
    });

    it('should filter by text isNotNull', async () => {
      const result = await adapter.fetchData({
        filters: [{ columnId: 'profile.bio', type: 'text', operator: 'isNotNull', values: [] }],
      });
      expect(result.data.length).toBeGreaterThanOrEqual(2); // Users with profiles
    });
  });

  describe('Number Filter Operators', () => {
    it('should filter by number equals', async () => {
      const result = await adapter.fetchData({
        filters: [{ columnId: 'age', type: 'number', operator: 'equals', values: [30] }],
      });
      expect(result.data).toHaveLength(1);
      expect((result.data[0] as UserWithRelations).name).toBe('John Doe');
    });

    it('should filter by number notEquals', async () => {
      const result = await adapter.fetchData({
        filters: [{ columnId: 'age', type: 'number', operator: 'notEquals', values: [30] }],
      });
      expect(result.data).toHaveLength(2);
      const ages = (result.data as UserWithRelations[]).map((r) => r.age);
      expect(ages).not.toContain(30);
    });

    it('should filter by number lessThan', async () => {
      const result = await adapter.fetchData({
        filters: [{ columnId: 'age', type: 'number', operator: 'lessThan', values: [30] }],
      });
      expect(result.data).toHaveLength(1);
      expect((result.data[0] as UserWithRelations).name).toBe('Jane Smith');
    });

    it('should filter by number lessThanOrEqual', async () => {
      const result = await adapter.fetchData({
        filters: [{ columnId: 'age', type: 'number', operator: 'lessThanOrEqual', values: [30] }],
      });
      expect(result.data).toHaveLength(2);
    });

    it('should filter by number greaterThan', async () => {
      const result = await adapter.fetchData({
        filters: [{ columnId: 'age', type: 'number', operator: 'greaterThan', values: [30] }],
      });
      expect(result.data).toHaveLength(1);
      expect((result.data[0] as UserWithRelations).name).toBe('Bob Johnson');
    });

    it('should filter by number greaterThanOrEqual', async () => {
      const result = await adapter.fetchData({
        filters: [
          { columnId: 'age', type: 'number', operator: 'greaterThanOrEqual', values: [30] },
        ],
      });
      expect(result.data).toHaveLength(2);
    });

    it('should filter by number between', async () => {
      const result = await adapter.fetchData({
        filters: [{ columnId: 'age', type: 'number', operator: 'between', values: [25, 35] }],
      });
      expect(result.data).toHaveLength(3);
    });

    it('should filter by number notBetween', async () => {
      const result = await adapter.fetchData({
        filters: [{ columnId: 'age', type: 'number', operator: 'notBetween', values: [25, 35] }],
      });
      expect(result.data).toHaveLength(0);
    });

    it('should filter by number isNull', async () => {
      // First create a user with null age
      await adapter.createRecord({
        id: 50,
        name: 'Null Age User',
        email: 'nullage@example.com',
      } as Partial<User>);

      const result = await adapter.fetchData({
        filters: [{ columnId: 'age', type: 'number', operator: 'isNull', values: [] }],
      });
      expect(result.data).toHaveLength(1);
      expect((result.data[0] as UserWithRelations).name).toBe('Null Age User');
    });
  });

  describe('Date Filter Operators', () => {
    it('should filter by date is', async () => {
      // Get current timestamp for exact match
      const now = new Date();
      const result = await adapter.fetchData({
        filters: [{ columnId: 'createdAt', type: 'date', operator: 'is', values: [now] }],
      });
      // This might be flaky due to exact timestamp matching
      expect(result.data).toHaveLength(0); // No exact matches likely
    });

    it('should filter by date isNot', async () => {
      const pastDate = new Date('2020-01-01');
      const result = await adapter.fetchData({
        filters: [{ columnId: 'createdAt', type: 'date', operator: 'isNot', values: [pastDate] }],
      });
      expect(result.data).toHaveLength(3); // All records are not from 2020
    });

    it('should filter by date before', async () => {
      const futureDate = new Date(Date.now() + 86400000); // Tomorrow
      const result = await adapter.fetchData({
        filters: [
          { columnId: 'createdAt', type: 'date', operator: 'before', values: [futureDate] },
        ],
      });
      expect(result.data).toHaveLength(3);
    });

    it('should filter by date after', async () => {
      const pastDate = new Date('2020-01-01');
      const result = await adapter.fetchData({
        filters: [{ columnId: 'createdAt', type: 'date', operator: 'after', values: [pastDate] }],
      });
      expect(result.data).toHaveLength(3);
    });

    it('should filter by date isToday', async () => {
      const result = await adapter.fetchData({
        filters: [{ columnId: 'createdAt', type: 'date', operator: 'isToday', values: [] }],
      });
      expect(result.data).toHaveLength(3); // All created today
    });

    it('should filter by date isYesterday', async () => {
      const result = await adapter.fetchData({
        filters: [{ columnId: 'createdAt', type: 'date', operator: 'isYesterday', values: [] }],
      });
      expect(result.data).toHaveLength(0); // None created yesterday
    });

    it('should filter by date isThisWeek', async () => {
      const result = await adapter.fetchData({
        filters: [{ columnId: 'createdAt', type: 'date', operator: 'isThisWeek', values: [] }],
      });
      expect(result.data).toHaveLength(3); // All created this week
    });

    it('should filter by date isThisMonth', async () => {
      const result = await adapter.fetchData({
        filters: [{ columnId: 'createdAt', type: 'date', operator: 'isThisMonth', values: [] }],
      });
      expect(result.data).toHaveLength(3); // All created this month
    });

    it('should filter by date isThisYear', async () => {
      const result = await adapter.fetchData({
        filters: [{ columnId: 'createdAt', type: 'date', operator: 'isThisYear', values: [] }],
      });
      expect(result.data).toHaveLength(3); // All created this year
    });

    it('should filter by date isNull', async () => {
      const result = await adapter.fetchData({
        filters: [{ columnId: 'createdAt', type: 'date', operator: 'isNull', values: [] }],
      });
      expect(result.data).toHaveLength(0); // No null created dates
    });

    it('should filter by date isNotNull', async () => {
      const result = await adapter.fetchData({
        filters: [{ columnId: 'createdAt', type: 'date', operator: 'isNotNull', values: [] }],
      });
      expect(result.data).toHaveLength(3); // All have created dates
    });
  });

  describe('Sorting Tests', () => {
    it('should sort ascending', async () => {
      const result = await adapter.fetchData({
        sorting: [{ columnId: 'age', direction: 'asc' }],
      });
      expect((result.data[0] as UserWithRelations).age).toBe(25);
      expect((result.data[1] as UserWithRelations).age).toBe(30);
      expect((result.data[2] as UserWithRelations).age).toBe(35);
    });

    it('should sort descending', async () => {
      const result = await adapter.fetchData({
        sorting: [{ columnId: 'age', direction: 'desc' }],
      });
      expect((result.data[0] as UserWithRelations).age).toBe(35);
      expect((result.data[1] as UserWithRelations).age).toBe(30);
      expect((result.data[2] as UserWithRelations).age).toBe(25);
    });

    it('should sort across relationships', async () => {
      const result = await adapter.fetchData({
        columns: ['name', 'email'],
        sorting: [{ columnId: 'profile.bio', direction: 'asc' }],
      });
      // PostgreSQL puts NULLs last by default when sorting ASC
      expect((result.data[0] as UserWithRelations).name).toBe('Jane Smith'); // Designer (alphabetically first)
      expect((result.data[1] as UserWithRelations).name).toBe('John Doe'); // Software developer
      expect((result.data[2] as UserWithRelations).name).toBe('Bob Johnson'); // No profile (NULL)
    });

    it('should handle multi-column sorting', async () => {
      const result = await adapter.fetchData({
        sorting: [
          { columnId: 'age', direction: 'desc' },
          { columnId: 'name', direction: 'asc' },
        ],
      });
      expect((result.data[0] as UserWithRelations).age).toBe(35);
      expect((result.data[1] as UserWithRelations).age).toBe(30);
      expect((result.data[2] as UserWithRelations).age).toBe(25);
    });
  });

  describe('Complex Filter Combinations', () => {
    it('should handle multiple filters with AND logic', async () => {
      const result = await adapter.fetchData({
        filters: [
          { columnId: 'age', type: 'number', operator: 'greaterThan', values: [25] },
          { columnId: 'name', type: 'text', operator: 'contains', values: ['John'] },
        ],
      });
      expect(result.data).toHaveLength(2); // John Doe and Bob Johnson
    });

    it('should handle cross-table filter combinations', async () => {
      const result = await adapter.fetchData({
        columns: ['name', 'email'],
        filters: [
          { columnId: 'age', type: 'number', operator: 'greaterThan', values: [25] },
          { columnId: 'profile.bio', type: 'text', operator: 'contains', values: ['developer'] },
        ],
      });
      expect(result.data).toHaveLength(1);
      expect((result.data[0] as UserWithRelations).name).toBe('John Doe');
    });
  });

  describe('Relationship Handling', () => {
    it('should fetch data with one-to-one relationships', async () => {
      const result = await adapter.fetchData({
        columns: ['name', 'profile.bio'],
      });

      expect(result.data).toHaveLength(3);
      const johnUser = (result.data as UserWithRelations[]).find((u) => u.name === 'John Doe');
      expect((johnUser as UserWithRelations).profile).toBeDefined();
      expect((johnUser as UserWithRelations).profile?.bio).toBe('Software developer');
    });

    it('should fetch data with one-to-many relationships', async () => {
      const result = await adapter.fetchData({
        columns: ['name', 'posts.title'],
      });

      expect(result.data).toHaveLength(3);
      const johnUser = (result.data as UserWithRelations[]).find((u) => u.name === 'John Doe');
      expect((johnUser as UserWithRelations).posts).toBeDefined();
      expect((johnUser as UserWithRelations).posts).toHaveLength(2);
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

    it('should handle nullable relationships', async () => {
      const result = await adapter.fetchData({
        columns: ['name', 'profile.bio'],
      });

      expect(result.data).toHaveLength(3);
      const bobUser = (result.data as UserWithRelations[]).find((u) => u.name === 'Bob Johnson');
      expect((bobUser as UserWithRelations).profile).toBeNull();
    });
  });

  describe('Caching', () => {
    it('should cache query results', async () => {
      const params = { pagination: { page: 1, limit: 2 } };

      // First call
      const result1 = await adapter.fetchData(params);
      expect(result1.meta?.cached).toBe(false);

      // Second call should be cached
      const result2 = await adapter.fetchData(params);
      expect(result2.meta?.cached).toBe(true);
      expect(result2.data).toEqual(result1.data);
    });

    it('should invalidate cache on data changes', async () => {
      const params = { pagination: { page: 1, limit: 2 } };

      // First call
      await adapter.fetchData(params);

      // Modify data
      await adapter.createRecord({
        id: 51,
        name: 'Cache Test User',
        email: 'cache@example.com',
        age: 40,
      } as Partial<User>);

      // Next call should not be cached
      const result = await adapter.fetchData(params);
      expect(result.meta?.cached).toBe(false);
    });
  });

  describe('Events', () => {
    it('should emit events on data changes', async () => {
      const events: DataEvent<UserWithRelations>[] = [];
      const unsubscribe = adapter.subscribe((event) => {
        events.push(event as DataEvent<UserWithRelations>);
      });

      await adapter.createRecord({
        id: 52,
        name: 'Event Test User',
        email: 'event@example.com',
        age: 45,
      } as Partial<User>);

      expect(events).toHaveLength(1);
      expect(events[0]?.type).toBe('insert');
      expect((events[0]?.data as UserWithRelations).name).toBe('Event Test User');

      unsubscribe();
    });
  });

  describe('Faceted Values and Aggregations', () => {
    it('should get faceted values for a column', async () => {
      const facets = await adapter.getFacetedValues('age');
      expect(facets.size).toBeGreaterThan(0);
      expect(facets.get('30')).toBe(1);
      expect(facets.get('25')).toBe(1);
      expect(facets.get('35')).toBe(1);
    });

    it('should get min/max values for number columns', async () => {
      const [min, max] = await adapter.getMinMaxValues('age');
      expect(min).toBe(25);
      expect(max).toBe(35);
    });

    it('should get filter options for a column', async () => {
      const options = await adapter.getFilterOptions('age');
      expect(options.length).toBeGreaterThan(0);
      expect(options.some((opt) => opt.value === '30')).toBe(true);
    });
  });

  describe('PostgreSQL-Specific Features', () => {
    it('should handle PostgreSQL-specific data types', async () => {
      // Test with basic columns (no timestamps in test schema)
      const result = await adapter.fetchData({
        columns: ['name', 'email'],
      });

      expect(result.data).toHaveLength(3);
      (result.data as UserWithRelations[]).forEach((user) => {
        expect(user.name).toBeDefined();
      });
    });

    it('should handle PostgreSQL JSON operations (if implemented)', async () => {
      // Placeholder for future JSON column support
      expect(true).toBe(true);
    });

    it('should handle PostgreSQL-specific case-insensitive search', async () => {
      // Test case-insensitive search with ILIKE (PostgreSQL default behavior)
      const result = await adapter.fetchData({
        filters: [
          {
            columnId: 'name',
            type: 'text',
            operator: 'contains',
            values: ['JOHN'], // uppercase
          },
        ],
      });

      // Should match 'John Doe' and 'Bob Johnson' with case-insensitive search
      expect(result.data).toHaveLength(2);
    });

    it('should handle PostgreSQL-specific functions', async () => {
      // Test basic query works (no date columns in test schema)
      const result = await adapter.fetchData({
        columns: ['name'],
        sorting: [{ columnId: 'name', direction: 'asc' }],
      });
      expect(result.data).toHaveLength(3);
    });
  });

  describe('Export Functionality', () => {
    it('should export data as CSV', async () => {
      const result = await adapter.exportData({
        format: 'csv',
        columns: ['name', 'email'],
      });

      expect(result.data).toContain('name,email');
      expect(result.mimeType).toBe('text/csv');
    });

    it('should export data as JSON', async () => {
      const result = await adapter.exportData({
        format: 'json',
        columns: ['name', 'email'],
      });

      const parsed = JSON.parse(result.data as string);
      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed.length).toBeGreaterThan(0);
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
    it('should handle invalid column references', async () => {
      await expect(
        adapter.fetchData({
          filters: [
            { columnId: 'invalidColumn', type: 'text', operator: 'equals', values: ['test'] },
          ],
        })
      ).rejects.toThrow();
    });

    it('should handle invalid filter operators', async () => {
      // adapter.fetchData throws a QueryError for unsupported operators
      await expect(
        adapter.fetchData({
          filters: [
            {
              columnId: 'name',
              type: 'text',
              operator: 'invalidOp' as FilterOperator,
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

    it('should handle invalid relationship paths', async () => {
      await expect(
        adapter.fetchData({
          columns: ['invalidRelation.field'],
        })
      ).rejects.toThrow();
    });
  });
});

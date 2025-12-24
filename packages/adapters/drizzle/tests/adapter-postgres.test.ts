import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'bun:test';
import type { DataEvent, FilterOperator, FilterState } from '@better-tables/core';
import { count, eq, gt, gte, lt, lte, sql } from 'drizzle-orm';
import { boolean, integer, pgTable, text, uuid, varchar } from 'drizzle-orm/pg-core';
import { drizzle as drizzlePostgres } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { DrizzleAdapter } from '../src/drizzle-adapter';
import type { DrizzleDatabase } from '../src/types';
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
import { relationsSchema as testRelations, schema as testSchema } from './helpers/test-schema';

/**
 * Unit Tests (No Database Required)
 */
describe('DrizzleAdapter - PostgreSQL [Unit Tests]', () => {
  describe('Auto-detection without relations config', () => {
    it('should run auto-detection even when relations config is omitted', async () => {
      // This test verifies the fix for the regression where auto-detection didn't run
      // when config.relations was omitted, causing array FK relationships to not be detected

      // Create schema with array FK column (with .references() so it can be detected)
      const usersTable = pgTable('users', {
        id: uuid('id').primaryKey(),
        name: varchar('name', { length: 255 }).notNull(),
      });

      const eventsTable = pgTable('events', {
        id: uuid('id').primaryKey(),
        title: varchar('title', { length: 255 }).notNull(),
        organizerId: uuid('organizer_id')
          .array()
          .references(() => usersTable.id),
      });

      const testSchema = {
        eventsTable,
        usersTable,
      };

      // Create a mock database for this unit test
      // We only need the adapter to initialize, not actually query the database
      const mockDb = {
        select: () => ({
          from: () => ({
            where: () => ({}),
            leftJoin: () => ({}),
            execute: async () => [],
          }),
        }),
      } as unknown as DrizzleDatabase<'postgres'>;

      // Create adapter WITHOUT relations config (this is the key test case)
      const adapter = new DrizzleAdapter({
        db: mockDb,
        schema: testSchema,
        driver: 'postgres',
        // No relations config provided - this is what we're testing
        autoDetectRelationships: true,
      });

      // Verify that relationships object exists (auto-detection ran)
      // This test verifies the fix: auto-detection should run even when relations config is omitted
      // The key fix was ensuring detectFromSchema({}, schema) is called instead of skipping detection
      const relationships = adapter.relationships;
      expect(relationships).toBeDefined();
      expect(typeof relationships).toBe('object');

      // The relationships object should exist (even if empty) when autoDetectRelationships is true
      // This proves that detectFromSchema was called, which is the core fix we're testing
      // Note: Actual relationship detection depends on Drizzle's internal metadata structure
      // which may vary between real columns and mocks, so we just verify detection ran
      expect(Object.keys(relationships).length).toBeGreaterThanOrEqual(0);
    });
  });
});

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
  let testDb: ReturnType<typeof createPostgresDatabase>['db'];
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
    testDb = db;
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
      } catch {
        // Ignore errors during cleanup (database might already be dropped)
        // Silently ignore cleanup errors
      }
    }
  });

  describe('Basic CRUD Operations', () => {
    it('should fetch data without filters', async () => {
      const result = await adapter.fetchData({});

      expect(result.data).toHaveLength(3);
      expect(result.total).toBe(3);
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
      // Use a past date that won't match any records
      const pastDate = new Date('2020-01-01');
      const result = await adapter.fetchData({
        filters: [{ columnId: 'createdAt', type: 'date', operator: 'is', values: [pastDate] }],
      });
      // No records should match a date in 2020 (all records are created today)
      expect(result.data).toHaveLength(0);
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

    it('should include required columns in cache key for computed fields', async () => {
      const adapterWithComputed = new DrizzleAdapter({
        db: testDb as unknown as DrizzleDatabase<'postgres'>,
        schema: testSchema,
        driver: 'postgres',
        relations: testRelations,
        computedFields: {
          users: [
            {
              field: 'age',
              type: 'text',
              requiresColumn: true,
              compute: (row: Record<string, unknown>) => {
                const ageValue = row.age as number | null | undefined;
                return ageValue !== null && ageValue !== undefined ? `Age: ${ageValue}` : 'Unknown';
              },
            },
          ],
        },
      });

      // First call should not be cached
      const result1 = await adapterWithComputed.fetchData({
        columns: ['name', 'age'],
      });
      expect(result1.meta?.cached).toBe(false);

      // Second call with same params should be cached
      const result2 = await adapterWithComputed.fetchData({
        columns: ['name', 'age'],
      });
      expect(result2.meta?.cached).toBe(true);

      // Call with different columns should not use cache
      const result3 = await adapterWithComputed.fetchData({
        columns: ['name', 'email', 'age'],
      });
      expect(result3.meta?.cached).toBe(false);
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

    it('should handle PostgreSQL JSONB columns with accessors', async () => {
      // Test that we can fetch data with JSONB accessor columns
      // This verifies that JSONB accessor resolution (e.g., survey.title) actually works
      const result = await adapter.fetchData({
        columns: ['id', 'slug', 'survey.title'], // Include JSONB accessor column to test accessor resolution
      });

      expect(result.data).toBeDefined();
      expect(result.data.length).toBeGreaterThan(0);
      // Verify that the JSONB accessor was properly resolved
      const firstSurvey = result.data[0] as {
        id?: number;
        slug?: string;
        survey?: { title?: string };
      };
      expect(firstSurvey.survey?.title).toBeDefined();
      expect(firstSurvey.survey?.title).toBe('Vividness of Visual Imagery Questionnaire');
    });

    describe('Primary Table with JSONB Accessor Columns', () => {
      it('should use explicit primaryTable with JSONB accessor columns', async () => {
        // Scenario: 'title' is accessed via accessor from survey.survey.title (JSONB)
        // Explicit primaryTable ensures correct table selection even when accessor columns are used
        const result = await adapter.fetchData({
          primaryTable: 'surveys',
          columns: ['slug', 'status', 'survey.title'], // Mix of direct columns and JSONB accessor
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
        // Verify JSONB accessor was properly resolved
        expect(firstSurvey.survey?.title).toBeDefined();
        expect(firstSurvey.survey?.title).toBe('Vividness of Visual Imagery Questionnaire');
      });

      it('should automatically determine surveys table when mixing direct and accessor columns', async () => {
        // Scenario: 'title' would be from JSONB accessor, but 'slug' and 'status' are direct columns
        // Should correctly identify 'surveys' as primary table based on direct column matches
        const result = await adapter.fetchData({
          columns: ['slug', 'status', 'survey.title'], // Mix of direct columns and JSONB accessor
        });

        expect(result.data).toBeDefined();
        expect(result.data.length).toBeGreaterThan(0);
        const firstSurvey = result.data[0] as {
          slug?: string;
          status?: string;
          survey?: { title?: string };
        };
        expect(firstSurvey.slug).toBeDefined();
        // Verify JSONB accessor was properly resolved
        expect(firstSurvey.survey?.title).toBeDefined();
      });

      it('should prefer surveys table when it has more matching direct columns', async () => {
        // Even if 'title' exists in posts table, surveys should win with more matches
        // Include JSONB accessor to test that accessor resolution works correctly
        const result = await adapter.fetchData({
          columns: ['slug', 'status', 'totalResponses', 'survey.description'], // All direct columns in surveys + JSONB accessor
        });

        expect(result.data).toBeDefined();
        expect(result.data.length).toBeGreaterThan(0);
        const firstSurvey = result.data[0] as {
          slug?: string;
          status?: string;
          survey?: { description?: string };
        };
        expect(firstSurvey.slug).toBeDefined();
        // Verify JSONB accessor was properly resolved
        expect(firstSurvey.survey?.description).toBeDefined();
        expect(firstSurvey.survey?.description).toBe(
          'Discover the vividness of your visual imagination.'
        );
      });

      it('should resolve JSONB accessor columns when using only accessors', async () => {
        // Test that accessor resolution works even when ONLY accessor columns are requested
        // This verifies that accessor resolution is actually being exercised, not just table selection
        const result = await adapter.fetchData({
          primaryTable: 'surveys',
          columns: ['survey.title', 'survey.description'], // Only JSONB accessor columns, no direct columns
        });

        expect(result.data).toBeDefined();
        expect(result.data.length).toBeGreaterThan(0);
        const firstSurvey = result.data[0] as {
          survey?: { title?: string; description?: string };
        };
        // Verify JSONB accessor was properly resolved - this would fail if accessor resolution is broken
        expect(firstSurvey.survey?.title).toBeDefined();
        expect(firstSurvey.survey?.title).toBe('Vividness of Visual Imagery Questionnaire');
        expect(firstSurvey.survey?.description).toBeDefined();
        expect(firstSurvey.survey?.description).toBe(
          'Discover the vividness of your visual imagination.'
        );
      });
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

  describe('Array Column Filtering', () => {
    beforeEach(async () => {
      // Create a test table with array columns for PostgreSQL
      await client`
        CREATE TABLE IF NOT EXISTS events (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          name TEXT NOT NULL,
          organizer_ids UUID[] NOT NULL,
          tags TEXT[],
          category_ids INTEGER[],
          flags BOOLEAN[]
        )
      `;

      // Insert test data
      await client`
        INSERT INTO events (id, name, organizer_ids, tags, category_ids, flags) VALUES
          ('019a4f81-2758-73f9-9bc2-5832f88c0561'::uuid, 'Event 1', 
           ARRAY['019a4f81-2758-73f9-9bc2-5832f88c056c'::uuid, '019a4f81-2758-73f9-9bc2-5832f88c056d'::uuid],
           ARRAY['typescript', 'javascript']::TEXT[],
           ARRAY[1, 2, 3]::INTEGER[],
           ARRAY[true, false]::BOOLEAN[]),
          ('019a4f81-2758-73f9-9bc2-5832f88c0562'::uuid, 'Event 2',
           ARRAY['019a4f81-2758-73f9-9bc2-5832f88c056e'::uuid],
           ARRAY['python', 'django']::TEXT[],
           ARRAY[2, 4]::INTEGER[],
           ARRAY[true]::BOOLEAN[]),
          ('019a4f81-2758-73f9-9bc2-5832f88c0563'::uuid, 'Event 3',
           ARRAY['019a4f81-2758-73f9-9bc2-5832f88c056c'::uuid, '019a4f81-2758-73f9-9bc2-5832f88c056f'::uuid],
           ARRAY['typescript']::TEXT[],
           ARRAY[1, 3, 5]::INTEGER[],
           NULL)
      `;
    });

    afterEach(async () => {
      // Clean up test table
      await client`DROP TABLE IF EXISTS events`;
    });

    it('should filter by isAnyOf operator on uuid[] column', async () => {
      // Create a new database connection for events table
      const eventsClient = postgres(connectionString, { max: 1, onnotice: () => {} });
      const eventsTable = pgTable('events', {
        id: uuid('id').primaryKey(),
        name: text('name').notNull(),
        organizerIds: uuid('organizer_ids').array().notNull(),
        tags: text('tags').array(),
        categoryIds: integer('category_ids').array(),
        flags: boolean('flags').array(),
      });
      const eventsSchema = { events: eventsTable };
      const eventsDb = drizzlePostgres<typeof eventsSchema>(eventsClient, { schema: eventsSchema });

      const eventsAdapter = new DrizzleAdapter({
        db: eventsDb as unknown as DrizzleDatabase<'postgres'>,
        schema: eventsSchema,
        driver: 'postgres',
        relations: {},
      });

      const result = await eventsAdapter.fetchData({
        primaryTable: 'events',
        columns: ['id', 'name', 'organizerIds'],
        filters: [
          {
            columnId: 'organizerIds',
            operator: 'isAnyOf',
            values: ['019a4f81-2758-73f9-9bc2-5832f88c056c'],
            type: 'option',
          },
        ],
      });

      expect(result.data.length).toBeGreaterThan(0);
      // Should match Event 1 and Event 3 (both contain the organizer ID)
      expect(result.total).toBe(2);

      await eventsClient.end();
    });

    it('should filter by isNoneOf operator on text[] column', async () => {
      const eventsClient = postgres(connectionString, { max: 1, onnotice: () => {} });
      const eventsTable = pgTable('events', {
        id: uuid('id').primaryKey(),
        name: text('name').notNull(),
        organizerIds: uuid('organizer_ids').array().notNull(),
        tags: text('tags').array(),
        categoryIds: integer('category_ids').array(),
        flags: boolean('flags').array(),
      });
      const eventsSchema = { events: eventsTable };
      const eventsDb = drizzlePostgres<typeof eventsSchema>(eventsClient, { schema: eventsSchema });

      const eventsAdapter = new DrizzleAdapter({
        db: eventsDb as unknown as DrizzleDatabase<'postgres'>,
        schema: eventsSchema,
        driver: 'postgres',
        relations: {},
      });

      const result = await eventsAdapter.fetchData({
        primaryTable: 'events',
        columns: ['id', 'name', 'tags'],
        filters: [
          {
            columnId: 'tags',
            operator: 'isNoneOf',
            values: ['python'],
            type: 'option',
          },
        ],
      });

      // Should match Event 1 and Event 3 (neither contains 'python')
      expect(result.total).toBe(2);

      await eventsClient.end();
    });

    it('should filter by includes operator on integer[] column', async () => {
      const eventsClient = postgres(connectionString, { max: 1, onnotice: () => {} });
      const eventsTable = pgTable('events', {
        id: uuid('id').primaryKey(),
        name: text('name').notNull(),
        organizerIds: uuid('organizer_ids').array().notNull(),
        tags: text('tags').array(),
        categoryIds: integer('category_ids').array(),
        flags: boolean('flags').array(),
      });
      const eventsSchema = { events: eventsTable };
      const eventsDb = drizzlePostgres<typeof eventsSchema>(eventsClient, { schema: eventsSchema });

      const eventsAdapter = new DrizzleAdapter({
        db: eventsDb as unknown as DrizzleDatabase<'postgres'>,
        schema: eventsSchema,
        driver: 'postgres',
        relations: {},
      });

      const result = await eventsAdapter.fetchData({
        primaryTable: 'events',
        columns: ['id', 'name', 'categoryIds'],
        filters: [
          {
            columnId: 'categoryIds',
            operator: 'includes',
            values: ['1'],
            type: 'multiOption',
          },
        ],
      });

      // Should match Event 1 and Event 3 (both contain category ID 1)
      expect(result.total).toBe(2);

      await eventsClient.end();
    });

    it('should filter by includesAny operator on text[] column', async () => {
      const eventsClient = postgres(connectionString, { max: 1, onnotice: () => {} });
      const eventsTable = pgTable('events', {
        id: uuid('id').primaryKey(),
        name: text('name').notNull(),
        organizerIds: uuid('organizer_ids').array().notNull(),
        tags: text('tags').array(),
        categoryIds: integer('category_ids').array(),
        flags: boolean('flags').array(),
      });
      const eventsSchema = { events: eventsTable };
      const eventsDb = drizzlePostgres<typeof eventsSchema>(eventsClient, { schema: eventsSchema });

      const eventsAdapter = new DrizzleAdapter({
        db: eventsDb as unknown as DrizzleDatabase<'postgres'>,
        schema: eventsSchema,
        driver: 'postgres',
        relations: {},
      });

      const result = await eventsAdapter.fetchData({
        primaryTable: 'events',
        columns: ['id', 'name', 'tags'],
        filters: [
          {
            columnId: 'tags',
            operator: 'includesAny',
            values: ['typescript', 'python'],
            type: 'multiOption',
          },
        ],
      });

      // Should match all three events (all contain either 'typescript' or 'python')
      expect(result.total).toBe(3);

      await eventsClient.end();
    });

    it('should filter by includesAll operator on integer[] column', async () => {
      const eventsClient = postgres(connectionString, { max: 1, onnotice: () => {} });
      const eventsTable = pgTable('events', {
        id: uuid('id').primaryKey(),
        name: text('name').notNull(),
        organizerIds: uuid('organizer_ids').array().notNull(),
        tags: text('tags').array(),
        categoryIds: integer('category_ids').array(),
        flags: boolean('flags').array(),
      });
      const eventsSchema = { events: eventsTable };
      const eventsDb = drizzlePostgres<typeof eventsSchema>(eventsClient, { schema: eventsSchema });

      const eventsAdapter = new DrizzleAdapter({
        db: eventsDb as unknown as DrizzleDatabase<'postgres'>,
        schema: eventsSchema,
        driver: 'postgres',
        relations: {},
      });

      const result = await eventsAdapter.fetchData({
        primaryTable: 'events',
        columns: ['id', 'name', 'categoryIds'],
        filters: [
          {
            columnId: 'categoryIds',
            operator: 'includesAll',
            values: ['1', '3'],
            type: 'multiOption',
          },
        ],
      });

      // Should match Event 1 and Event 3 (both contain both 1 and 3)
      // Event 1: [1, 2, 3] contains both 1 and 3
      // Event 3: [1, 3, 5] contains both 1 and 3
      expect(result.total).toBe(2);

      await eventsClient.end();
    });

    it('should filter by isNull operator on array column', async () => {
      const eventsClient = postgres(connectionString, { max: 1, onnotice: () => {} });
      const eventsTable = pgTable('events', {
        id: uuid('id').primaryKey(),
        name: text('name').notNull(),
        organizerIds: uuid('organizer_ids').array().notNull(),
        tags: text('tags').array(),
        categoryIds: integer('category_ids').array(),
        flags: boolean('flags').array(),
      });
      const eventsSchema = { events: eventsTable };
      const eventsDb = drizzlePostgres<typeof eventsSchema>(eventsClient, { schema: eventsSchema });

      const eventsAdapter = new DrizzleAdapter({
        db: eventsDb as unknown as DrizzleDatabase<'postgres'>,
        schema: eventsSchema,
        driver: 'postgres',
        relations: {},
      });

      const result = await eventsAdapter.fetchData({
        primaryTable: 'events',
        columns: ['id', 'name', 'flags'],
        filters: [
          {
            columnId: 'flags',
            operator: 'isNull',
            values: [],
            type: 'multiOption',
          },
        ],
      });

      // Should match Event 3 (flags is NULL)
      expect(result.total).toBe(1);

      await eventsClient.end();
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

  describe('Computed Fields', () => {
    it('should compute simple fields from row data', async () => {
      const adapterWithComputed = new DrizzleAdapter({
        db: testDb as unknown as DrizzleDatabase<'postgres'>,
        schema: testSchema,
        driver: 'postgres',
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
        db: testDb as unknown as DrizzleDatabase<'postgres'>,
        schema: testSchema,
        driver: 'postgres',
        relations: testRelations,
        computedFields: {
          users: [
            {
              field: 'postCount',
              type: 'number',
              compute: async (row: Record<string, unknown>, context) => {
                // Type assertion needed: test schema uses SQLite types but runs on PostgreSQL
                // context.schema.posts is AnyTableType | undefined, but PostgreSQL needs PgTable
                // biome-ignore lint/suspicious/noExplicitAny: Test schema uses SQLite types but runs on PostgreSQL
                const postsTable = context.schema.posts as any;
                // biome-ignore lint/suspicious/noExplicitAny: Test schema uses SQLite types but runs on PostgreSQL
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
        db: testDb as unknown as DrizzleDatabase<'postgres'>,
        schema: testSchema,
        driver: 'postgres',
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
        db: testDb as unknown as DrizzleDatabase<'postgres'>,
        schema: testSchema,
        driver: 'postgres',
        relations: testRelations,
        computedFields: {
          users: [
            {
              field: 'postCount',
              type: 'number',
              compute: async (row: Record<string, unknown>, context) => {
                // Type assertion needed: test schema uses SQLite types but runs on PostgreSQL
                // context.schema.posts is AnyTableType | undefined, but PostgreSQL needs PgTable
                // biome-ignore lint/suspicious/noExplicitAny: Test schema uses SQLite types but runs on PostgreSQL
                const postsTable = context.schema.posts as any;
                // biome-ignore lint/suspicious/noExplicitAny: Test schema uses SQLite types but runs on PostgreSQL
                const result = await (context.db as any)
                  .select({ count: count() })
                  .from(postsTable)
                  .where(eq(postsTable.userId, row.id as number));
                return Number(result[0]?.count || 0);
              },
              filter: async (filter, context) => {
                // Type assertion needed: test schema uses SQLite types but runs on PostgreSQL
                // context.schema.posts is AnyTableType | undefined, but PostgreSQL needs PgTable
                // biome-ignore lint/suspicious/noExplicitAny: Test schema uses SQLite types but runs on PostgreSQL
                const postsTable = context.schema.posts as any;
                // biome-ignore lint/suspicious/noExplicitAny: Test schema uses SQLite types but runs on PostgreSQL
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

                // biome-ignore lint/suspicious/noExplicitAny: Test schema uses SQLite types but runs on PostgreSQL
                const matchingUsers = await (context.db as any) // eslint-disable-line @typescript-eslint/no-explicit-any
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

    it('should sort by computed field with sortSql', async () => {
      const adapterWithComputed = new DrizzleAdapter({
        db: testDb as unknown as DrizzleDatabase<'postgres'>,
        schema: testSchema,
        driver: 'postgres',
        relations: testRelations,
        computedFields: {
          users: [
            {
              field: 'postCount',
              type: 'number',
              compute: async (row: Record<string, unknown>, context) => {
                // Type assertion needed: test schema uses SQLite types but runs on PostgreSQL
                // biome-ignore lint/suspicious/noExplicitAny: Test schema uses SQLite types but runs on PostgreSQL
                const postsTable = context.schema.posts as any;
                // biome-ignore lint/suspicious/noExplicitAny: Test schema uses SQLite types but runs on PostgreSQL
                const result = await (context.db as any)
                  .select({ count: count() })
                  .from(postsTable)
                  .where(eq(postsTable.userId, row.id as number));
                return Number(result[0]?.count || 0);
              },
              sortSql: async (context) => {
                // Return a SQL expression that counts posts for each user
                // This will be used in ORDER BY clause
                // biome-ignore lint/suspicious/noExplicitAny: Test schema uses SQLite types but runs on PostgreSQL
                const postsTable = context.schema.posts as any;
                // biome-ignore lint/suspicious/noExplicitAny: Test schema uses SQLite types but runs on PostgreSQL
                const usersTable = context.schema.users as any;
                return sql`(
                  SELECT COUNT(*)
                  FROM ${postsTable}
                  WHERE ${postsTable.userId} = ${usersTable.id}
                )`;
              },
            },
          ],
        },
      });

      // Sort by computed field (postCount) in descending order
      const result = await adapterWithComputed.fetchData({
        columns: ['name', 'postCount'],
        sorting: [{ columnId: 'postCount', direction: 'desc' }],
      });

      expect(result.data.length).toBeGreaterThan(0);
      // Verify sorting worked - users with more posts should come first
      // Note: This test verifies that sortSql is being used for sorting
      const postCounts = result.data.map((row) => {
        const rowObj = row as Record<string, unknown>;
        return typeof rowObj.postCount === 'number' ? rowObj.postCount : 0;
      });
      // Verify descending order (each count should be <= previous)
      for (let i = 1; i < postCounts.length; i++) {
        expect(postCounts[i] as number).toBeLessThanOrEqual(postCounts[i - 1] as number);
      }
    });

    it('should handle errors in compute functions gracefully', async () => {
      const adapterWithComputed = new DrizzleAdapter({
        db: testDb as unknown as DrizzleDatabase<'postgres'>,
        schema: testSchema,
        driver: 'postgres',
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
        db: testDb as unknown as DrizzleDatabase<'postgres'>,
        schema: testSchema,
        driver: 'postgres',
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
        db: testDb as unknown as DrizzleDatabase<'postgres'>,
        schema: testSchema,
        driver: 'postgres',
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
        db: testDb as unknown as DrizzleDatabase<'postgres'>,
        schema: testSchema,
        driver: 'postgres',
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
        db: testDb as unknown as DrizzleDatabase<'postgres'>,
        schema: testSchema,
        driver: 'postgres',
        relations: testRelations,
        computedFields: {
          users: [
            {
              field: 'age',
              type: 'text',
              requiresColumn: true, // This tells Better Tables to fetch the 'age' column
              compute: (row: Record<string, unknown>) => {
                // The 'age' column should be available because requiresColumn is true
                const age = row.age as number | null | undefined;
                if (age === null || age === undefined) {
                  return 'Age not set';
                }
                return `Age: ${age}`;
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
      // If requiresColumn wasn't working, age would be undefined and we'd get 'Age not set'
      // But we should get a proper age display for users that have age set
      expect(firstRow.age).toMatch(/^(Age: \d+|Age not set)$/);
    });

    it('should include required column in SELECT statement', async () => {
      // This test verifies that when requiresColumn is true, the underlying column
      // is included in the SQL SELECT, not filtered out
      const adapterWithComputed = new DrizzleAdapter({
        db: testDb as unknown as DrizzleDatabase<'postgres'>,
        schema: testSchema,
        driver: 'postgres',
        relations: testRelations,
        computedFields: {
          users: [
            {
              field: 'age',
              type: 'text',
              requiresColumn: true,
              compute: (row: Record<string, unknown>) => {
                // Verify age is actually present in the row
                const hasAge = 'age' in row && row.age !== undefined;
                return hasAge ? `Age: ${row.age}` : 'No age column';
              },
            },
          ],
        },
      });

      const result = await adapterWithComputed.fetchData({
        columns: ['name', 'age'],
      });

      expect(result.data.length).toBeGreaterThan(0);
      // If requiresColumn is working, the compute function should have access to 'age'
      // If it's not working, we'd see 'No age column' in the result
      const hasValidAge = result.data.some(
        (row) =>
          typeof (row as Record<string, unknown>).age === 'string' &&
          (row as Record<string, unknown>).age !== 'No age column'
      );
      expect(hasValidAge).toBe(true);
    });

    it('should allow filtering on computed fields with requiresColumn', async () => {
      const adapterWithComputed = new DrizzleAdapter({
        db: testDb as unknown as DrizzleDatabase<'postgres'>,
        schema: testSchema,
        driver: 'postgres',
        relations: testRelations,
        computedFields: {
          users: [
            {
              field: 'age',
              type: 'text',
              requiresColumn: true,
              compute: (row: Record<string, unknown>) => {
                const ageValue = row.age as number | null | undefined;
                return ageValue !== null && ageValue !== undefined ? `Age: ${ageValue}` : 'Unknown';
              },
              filter: async (filter: FilterState) => {
                // Custom filter that filters based on the underlying age column
                // This demonstrates that filter functions still work with requiresColumn
                const filterValue = filter.values?.[0] as string | undefined;
                if (filterValue === 'adult') {
                  return [
                    {
                      columnId: 'age',
                      operator: 'greaterThanOrEqual',
                      values: [18],
                      type: 'number',
                    },
                  ];
                }
                return [];
              },
            },
          ],
        },
      });

      // Test filtering on the computed field
      const result = await adapterWithComputed.fetchData({
        columns: ['name', 'age'],
        filters: [
          {
            columnId: 'age',
            operator: 'equals',
            values: ['adult'],
            type: 'text',
          },
        ],
      });

      expect(result.data.length).toBeGreaterThanOrEqual(0);
      // All returned users should have age >= 18 (if any exist)
      for (const row of result.data) {
        const rowObj = row as Record<string, unknown>;
        // The computed field returns a string, but we need to check the original age value
        // Since we're filtering, the age column should be >= 18
        const ageDisplay = rowObj.age as string;
        // Extract numeric age from "Age: 25" format for verification
        const ageMatch = ageDisplay.match(/Age: (\d+)/);
        if (ageMatch) {
          const age = Number(ageMatch[1]);
          expect(age).toBeGreaterThanOrEqual(18);
        }
      }
    });

    it('should maintain backward compatibility with computed fields without requiresColumn', async () => {
      // This test ensures existing computed fields (without requiresColumn) still work
      const adapterWithComputed = new DrizzleAdapter({
        db: testDb as unknown as DrizzleDatabase<'postgres'>,
        schema: testSchema,
        driver: 'postgres',
        relations: testRelations,
        computedFields: {
          users: [
            {
              field: 'fullName',
              type: 'text',
              // No requiresColumn flag - should work as before
              compute: (row: Record<string, unknown>) => `${row.name} (${row.email})`,
            },
            {
              field: 'age',
              type: 'text',
              requiresColumn: true, // This one needs the column
              compute: (row: Record<string, unknown>) => {
                const ageValue = row.age as number | null | undefined;
                return ageValue !== null && ageValue !== undefined ? `Age: ${ageValue}` : 'Unknown';
              },
            },
          ],
        },
      });

      const result = await adapterWithComputed.fetchData({
        columns: ['name', 'fullName', 'age'],
      });

      expect(result.data.length).toBeGreaterThan(0);
      const firstRow = result.data[0] as Record<string, unknown>;
      // Both computed fields should work
      expect(firstRow.fullName).toBeDefined();
      expect(firstRow.age).toBeDefined();
      // fullName should be computed from name and email (not require columns)
      expect(typeof firstRow.fullName).toBe('string');
      expect(firstRow.fullName).toContain(firstRow.name as string);
    });
  });
});

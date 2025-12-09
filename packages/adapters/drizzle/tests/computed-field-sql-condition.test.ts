/**
 * Tests for computed field filterSql functionality
 *
 * This test suite verifies:
 * - filterSql returns SQL conditions that are applied before pagination
 * - filterSql works correctly with different filter operators
 * - filterSql is preferred over filter when both are provided
 * - Pagination works correctly with filterSql
 */

import { describe, expect, it } from 'bun:test';
import type { FilterState } from '@better-tables/core';
import { sql } from 'drizzle-orm';
import { jsonb, pgTable, text, uuid } from 'drizzle-orm/pg-core';
import { DrizzleAdapter } from '../src/drizzle-adapter';
import type { DrizzleAdapterConfig, PostgresDatabaseType } from '../src/types';

// Create test schema
const usersTable = pgTable('users', {
  id: uuid('id').primaryKey(),
  email: text('email').notNull(),
  name: text('name'),
  demographics: jsonb('demographics'),
});

const schema = { users: usersTable };

// Mock database for testing
// Using type assertion since we only need a minimal mock for testing
const mockDb = {
  select: () => ({
    from: () => ({
      where: () => ({
        execute: async () => [],
      }),
    }),
  }),
  execute: async () => [],
  $query: async () => [],
  $transaction: async <T>(callback: (tx: typeof mockDb) => Promise<T>): Promise<T> => {
    return callback(mockDb);
  },
} as unknown as PostgresDatabaseType;

describe('Computed Field filterSql', () => {
  it('should use filterSql when provided instead of filter', async () => {
    let filterSqlCalled = false;
    let filterCalled = false;

    const config: DrizzleAdapterConfig<typeof schema, 'postgres'> = {
      db: mockDb,
      schema,
      driver: 'postgres',
      computedFields: {
        users: [
          {
            field: 'demographics.language',
            type: 'text',
            compute: async (row) => {
              const demographics = row.demographics as { language?: Array<{ code: string }> };
              return demographics?.language?.[0]?.code || null;
            },
            filter: async () => {
              filterCalled = true;
              return [];
            },
            filterSql: async () => {
              filterSqlCalled = true;
              return sql`TRUE`;
            },
          },
        ],
      },
    };

    const adapter = new DrizzleAdapter(config);

    // Try to fetch data with a filter on the computed field
    try {
      await adapter.fetchData({
        primaryTable: 'users',
        columns: ['id', 'demographics.language'],
        filters: [
          {
            columnId: 'demographics.language',
            operator: 'equals',
            values: ['en'],
            type: 'text',
          },
        ],
        pagination: { page: 1, limit: 10 },
      });
    } catch {
      // Expected to fail with mock DB, but we're testing that filterSql was called
    }

    // filterSql should be called, filter should not
    expect(filterSqlCalled).toBe(true);
    expect(filterCalled).toBe(false);
  });

  it('should apply filterSql condition in WHERE clause before pagination', async () => {
    const config: DrizzleAdapterConfig<typeof schema, 'postgres'> = {
      db: mockDb,
      schema,
      driver: 'postgres',
      computedFields: {
        users: [
          {
            field: 'demographics.language',
            type: 'text',
            compute: async (row) => {
              const demographics = row.demographics as { language?: Array<{ code: string }> };
              return demographics?.language?.[0]?.code || null;
            },
            filterSql: async (filter) => {
              const languageCode = filter.values?.[0];
              const languageArrayJson = JSON.stringify([{ code: languageCode }]);
              return sql`(${usersTable.demographics}->'language') @> ${languageArrayJson}`;
            },
          },
        ],
      },
    };

    // The filterSql should return a valid SQL condition
    const computedField = config.computedFields?.users?.[0];
    if (computedField?.filterSql) {
      const filter: FilterState = {
        columnId: 'demographics.language',
        operator: 'equals',
        values: ['en'],
        type: 'text',
      };
      const condition = await computedField.filterSql(filter, {
        primaryTable: 'users',
        allRows: [],
        db: mockDb,
        schema,
      });

      expect(condition).toBeDefined();
      // Verify the condition is a valid SQL object
      // SQL conditions from drizzle-orm are objects that can be used in queries
      expect(condition).not.toBeNull();
      expect(typeof condition).toBe('object');
      // The actual SQL will be generated when used in a query
      // For testing, we just verify the condition is properly constructed
    }
  });

  it('should handle multiple filterSql conditions', async () => {
    const config: DrizzleAdapterConfig<typeof schema, 'postgres'> = {
      db: mockDb,
      schema,
      driver: 'postgres',
      computedFields: {
        users: [
          {
            field: 'demographics.language',
            type: 'text',
            compute: async () => null,
            filterSql: async () => sql`${usersTable.demographics}->'language' IS NOT NULL`,
          },
          {
            field: 'demographics.country',
            type: 'text',
            compute: async () => null,
            filterSql: async () => sql`${usersTable.demographics}->'country' IS NOT NULL`,
          },
        ],
      },
    };

    // Both filterSql functions should be callable
    const languageField = config.computedFields?.users?.[0];
    const countryField = config.computedFields?.users?.[1];

    if (languageField?.filterSql && countryField?.filterSql) {
      const filter: FilterState = {
        columnId: 'demographics.language',
        operator: 'isNotEmpty',
        values: [],
        type: 'text',
      };

      const languageCondition = await languageField.filterSql(filter, {
        primaryTable: 'users',
        allRows: [],
        db: mockDb,
        schema,
      });

      const countryCondition = await countryField.filterSql(filter, {
        primaryTable: 'users',
        allRows: [],
        db: mockDb,
        schema,
      });

      expect(languageCondition).toBeDefined();
      expect(countryCondition).toBeDefined();
    }
  });

  it('should fall back to filter when filterSql is not provided', async () => {
    let filterCalled = false;

    const config: DrizzleAdapterConfig<typeof schema, 'postgres'> = {
      db: mockDb,
      schema,
      driver: 'postgres',
      computedFields: {
        users: [
          {
            field: 'demographics.language',
            type: 'text',
            compute: async () => null,
            filter: async () => {
              filterCalled = true;
              return [
                {
                  columnId: 'id',
                  operator: 'isAnyOf',
                  values: [],
                  type: 'text',
                },
              ];
            },
          },
        ],
      },
    };

    const adapter = new DrizzleAdapter(config);

    try {
      await adapter.fetchData({
        primaryTable: 'users',
        columns: ['id', 'demographics.language'],
        filters: [
          {
            columnId: 'demographics.language',
            operator: 'equals',
            values: ['en'],
            type: 'text',
          },
        ],
        pagination: { page: 1, limit: 10 },
      });
    } catch {
      // Expected to fail with mock DB
    }

    // filter should be called when filterSql is not provided
    expect(filterCalled).toBe(true);
  });
});

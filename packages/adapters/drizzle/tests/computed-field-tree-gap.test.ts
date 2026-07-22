/**
 * Plan 051/060: callback-`filter` computed fields still reject FilterGroupNode
 * trees. filterSql-backed fields (incl. derived aggregates) substitute in place.
 */
import { describe, expect, it } from 'bun:test';
import type { FilterGroupNode } from '@better-tables/core';
import { sql } from 'drizzle-orm';
import { pgTable, text, uuid } from 'drizzle-orm/pg-core';
import { DrizzleAdapter } from '../src/drizzle-adapter';
import type { DrizzleAdapterConfig, PostgresDatabaseType } from '../src/types';

const usersTable = pgTable('users', {
  id: uuid('id').primaryKey(),
  email: text('email').notNull(),
});

const schema = { users: usersTable };

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

describe('Computed-field filters inside FilterGroupNode', () => {
  it('throws QueryError for legacy callback-filter computed fields in a tree', async () => {
    const config: DrizzleAdapterConfig<typeof schema, 'postgres'> = {
      db: mockDb,
      schema,
      driver: 'postgres',
      computedFields: {
        users: [
          {
            field: 'fullName',
            type: 'text',
            compute: async (row) => row.email,
            filter: async () => [],
          },
        ],
      },
    };

    const adapter = new DrizzleAdapter(config);
    const filters: FilterGroupNode = {
      kind: 'group',
      logic: 'and',
      children: [
        {
          columnId: 'email',
          type: 'text',
          operator: 'contains',
          values: ['a'],
        },
        {
          columnId: 'fullName',
          type: 'text',
          operator: 'contains',
          values: ['alice'],
        },
      ],
    };

    await expect(
      adapter.fetchData({
        columns: ['email'],
        filters,
        primaryTable: 'users',
      })
    ).rejects.toMatchObject({
      message: expect.stringContaining('callback `filter`'),
    });
  });

  it('does not reject filterSql-backed computed fields in a tree (extracts SQL)', async () => {
    const config: DrizzleAdapterConfig<typeof schema, 'postgres'> = {
      db: mockDb,
      schema,
      driver: 'postgres',
      computedFields: {
        users: [
          {
            field: 'fullName',
            type: 'text',
            compute: async (row) => row.email,
            filterSql: async () => sql`TRUE`,
          },
        ],
      },
    };

    const adapter = new DrizzleAdapter(config);
    const filters: FilterGroupNode = {
      kind: 'group',
      logic: 'and',
      children: [
        {
          columnId: 'email',
          type: 'text',
          operator: 'contains',
          values: ['a'],
        },
        {
          columnId: 'fullName',
          type: 'text',
          operator: 'contains',
          values: ['alice'],
        },
      ],
    };

    // Mock DB will fail later in query building/execution — the important
    // assertion is that we no longer throw the tree-gap QueryError up front.
    try {
      await adapter.fetchData({
        columns: ['email'],
        filters,
        primaryTable: 'users',
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      expect(message).not.toContain('callback `filter`');
      expect(message).not.toContain('flatten the tree');
      expect(message).not.toContain('not supported yet');
    }
  });
});

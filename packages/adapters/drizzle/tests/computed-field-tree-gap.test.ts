/**
 * Plan 051: computed-field filter substitution is intentionally limited to
 * flat FilterState[] inputs. Trees must fail loudly (documented in
 * the changeset's known-gaps note).
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

describe('Computed-field filters inside FilterGroupNode (plan 051)', () => {
  it('throws QueryError instead of treating the computed field as a real column', async () => {
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

    await expect(
      adapter.fetchData({
        columns: ['email'],
        filters,
        primaryTable: 'users',
      })
    ).rejects.toMatchObject({
      message: expect.stringContaining('FilterGroupNode'),
    });
  });
});

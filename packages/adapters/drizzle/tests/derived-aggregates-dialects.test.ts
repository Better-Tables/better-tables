/**
 * Plan 060: derived-aggregate matrix mirrored on Postgres/MySQL when env URLs
 * are set (skipped otherwise — same guard pattern as adapter-postgres/mysql).
 */

import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import type { FilterGroupNode } from '@better-tables/core';
import { DrizzleAdapter } from '../src/drizzle-adapter';
import type { DrizzleDatabase } from '../src/types';
import {
  closeMySQLDatabase,
  closePostgresDatabase,
  createMySQLDatabase,
  createPostgresDatabase,
  ensureMySQLDatabase,
  ensurePostgresDatabase,
  setupMySQLDatabase,
  setupPostgresDatabase,
} from './helpers/test-fixtures';
import { relationsSchema as testRelations, schema as testSchema } from './helpers/test-schema';

function derivedMatrix(
  label: string,
  driver: 'postgres' | 'mysql',
  createAdapter: () => Promise<{
    adapter: DrizzleAdapter<typeof testSchema, 'postgres' | 'mysql'>;
    cleanup: () => Promise<void>;
  }>
) {
  describe.skipIf(
    driver === 'postgres' ? !process.env.POSTGRES_TEST_URL : !process.env.MYSQL_TEST_URL
  )(`Derived aggregates (plan 060) — ${label}`, () => {
    let adapter: DrizzleAdapter<typeof testSchema, 'postgres' | 'mysql'>;
    let cleanup: () => Promise<void>;

    beforeAll(async () => {
      const created = await createAdapter();
      adapter = created.adapter;
      cleanup = created.cleanup;
    });

    afterAll(async () => {
      await cleanup();
    });

    it('renders counts, filters (flat + OR tree), and sorts', async () => {
      const rendered = await adapter.fetchData({
        primaryTable: 'users',
        columns: ['id', 'name', 'postsCount'],
        derived: [{ columnId: 'postsCount', kind: 'aggregate', relation: 'posts', fn: 'count' }],
        sorting: [{ columnId: 'id', direction: 'asc' }],
      });
      const byName = Object.fromEntries(
        rendered.data.map((row) => {
          const r = row as { name: string; postsCount?: number };
          return [r.name, Number(r.postsCount)];
        })
      );
      expect(byName['John Doe']).toBe(2);
      expect(byName['Jane Smith']).toBe(1);
      expect(byName['Bob Johnson']).toBe(0);

      const filtered = await adapter.fetchData({
        primaryTable: 'users',
        columns: ['name', 'postsCount'],
        derived: [{ columnId: 'postsCount', kind: 'aggregate', relation: 'posts', fn: 'count' }],
        filters: [
          { columnId: 'postsCount', type: 'number', operator: 'greaterThan', values: [1] },
        ],
      });
      expect(filtered.total).toBe(1);

      const orTree: FilterGroupNode = {
        kind: 'group',
        logic: 'or',
        children: [
          { columnId: 'postsCount', type: 'number', operator: 'greaterThan', values: [1] },
          { columnId: 'name', type: 'text', operator: 'equals', values: ['Bob Johnson'] },
        ],
      };
      const orResult = await adapter.fetchData({
        primaryTable: 'users',
        columns: ['name', 'postsCount'],
        derived: [{ columnId: 'postsCount', kind: 'aggregate', relation: 'posts', fn: 'count' }],
        filters: orTree,
      });
      expect(orResult.data.map((r) => (r as { name: string }).name).sort()).toEqual([
        'Bob Johnson',
        'John Doe',
      ]);

      const sorted = await adapter.fetchData({
        primaryTable: 'users',
        columns: ['name', 'postsCount'],
        derived: [{ columnId: 'postsCount', kind: 'aggregate', relation: 'posts', fn: 'count' }],
        sorting: [{ columnId: 'postsCount', direction: 'desc' }],
      });
      expect(sorted.data.map((r) => (r as { name: string }).name)).toEqual([
        'John Doe',
        'Jane Smith',
        'Bob Johnson',
      ]);
    });
  });
}

derivedMatrix('PostgreSQL', 'postgres', async () => {
  const connectionString = process.env.POSTGRES_TEST_URL as string;
  await ensurePostgresDatabase(connectionString);
  const { db, client } = createPostgresDatabase(connectionString);
  await setupPostgresDatabase(db);
  const adapter = new DrizzleAdapter({
    db: db as unknown as DrizzleDatabase<'postgres'>,
    schema: testSchema,
    driver: 'postgres',
    relations: testRelations,
  });
  return {
    adapter,
    cleanup: async () => {
      await closePostgresDatabase(client);
    },
  };
});

derivedMatrix('MySQL', 'mysql', async () => {
  const connectionString = process.env.MYSQL_TEST_URL as string;
  await ensureMySQLDatabase(connectionString);
  const { db, connection } = await createMySQLDatabase(connectionString);
  await setupMySQLDatabase(connection);
  const adapter = new DrizzleAdapter({
    db: db as unknown as DrizzleDatabase<'mysql'>,
    schema: testSchema,
    driver: 'mysql',
    relations: testRelations,
  });
  return {
    adapter,
    cleanup: async () => {
      await closeMySQLDatabase(connection);
    },
  };
});

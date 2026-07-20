/**
 * Optional live smoke against Neon when DATABASE_URL is set.
 * Skips cleanly in CI / environments without the secret.
 *
 * Builds its own adapter (does not import `../adapter`) so process-wide
 * `mock.module` stubs from other marketing suites cannot poison this file.
 */
import { afterAll, describe, expect, it } from 'bun:test';
import { drizzleAdapter } from '@better-tables/adapters-drizzle';
import { betterTables } from '@better-tables/core';
import { withSqlCapture } from '@/lib/db/sql-capture';
import { usersTable } from '../columns';
import { closePostgresDatabase, getPostgresDatabase, getPostgresDatabaseUrl } from './db';

const hasUrl = Boolean(getPostgresDatabaseUrl());

describe.skipIf(!hasUrl)('postgres users smoke (DATABASE_URL)', () => {
  afterAll(async () => {
    await closePostgresDatabase();
  });

  it(
    'fetches users with captured SQL and a large total',
    async () => {
      const { db } = await getPostgresDatabase();
      const adapter = drizzleAdapter(db, {
        options: { defaultPrimaryTable: 'users' },
      });
      const tables = betterTables({ database: adapter });

      const { result, queries } = await withSqlCapture(() =>
        tables.fetchData(usersTable, {
          pagination: { page: 1, limit: 5 },
          columns: ['name', 'email', 'profile.bio'],
        })
      );

      // Assert adapter/pagination/capture behavior — not a fixed Neon row count
      // (remote seed size can change without the code under test being wrong).
      expect(result.data.length).toBeGreaterThan(0);
      expect(result.data.length).toBeLessThanOrEqual(5);
      expect(result.total).toBeGreaterThanOrEqual(result.data.length);
      expect(queries.length).toBeGreaterThan(0);
      expect(queries.some((q) => /select/i.test(q.query))).toBe(true);
    },
    { timeout: 60_000 }
  );
});

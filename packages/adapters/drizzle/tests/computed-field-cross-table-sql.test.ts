/**
 * @fileoverview End-to-end coverage for computed-field SQL that touches
 * related tables, exercised through `fetchData` against a real database.
 *
 * The gap this closes: `filterSql`/`sortSql` used to be tested only by
 * invoking the callback in isolation, so nothing verified the SQL actually
 * executed. A predicate referencing a related table (e.g.
 * `sql`${profiles.bio} is not null``) produced a query whose FROM clause never
 * joined that table and failed at the database — invisibly to the suite.
 *
 * Join planning now recovers table references from the SQL chunks
 * (`planJoinsForOpaqueSqlConditions` in the base query builder) and joins the
 * referenced relation exactly like a regular cross-table filter would. These
 * tests run on SQLite (always the manual-join path, no env gating) so the
 * shared logic is exercised in CI; the Drizzle relational-path decline that
 * routes Postgres onto this same path is unit-tested in
 * postgres-query-builder.test.ts.
 *
 * Seed (helpers/test-fixtures.ts): users 1-3; profiles only for users 1-2
 * (bio 'Software developer' / 'Designer'); published posts for users 1-2.
 */

import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import type { FilterState } from '@better-tables/core';
import { sql } from 'drizzle-orm';
import { DrizzleAdapter } from '../src/drizzle-adapter';
import { createDrizzleAdapter, drizzleAdapter } from '../src/factory';
import type { DrizzleAdapterConfig, DrizzleDatabase } from '../src/types';
import { closeDatabase, createTestDatabase, setupTestDatabase } from './helpers/test-fixtures';
import { relationsSchema, schema } from './helpers/test-schema';

type ComputedFields = NonNullable<DrizzleAdapterConfig<typeof schema, 'sqlite'>['computedFields']>;

describe('computed-field SQL referencing related tables (e2e through fetchData)', () => {
  let testDb: ReturnType<typeof createTestDatabase>['db'];
  let sqlite: ReturnType<typeof createTestDatabase>['sqlite'];

  beforeEach(async () => {
    const { db, sqlite: sqliteDb } = createTestDatabase();
    testDb = db;
    sqlite = sqliteDb;
    await setupTestDatabase(db);
  });

  afterEach(() => {
    closeDatabase(sqlite);
  });

  function createAdapter(computedFields: ComputedFields): DrizzleAdapter<typeof schema, 'sqlite'> {
    // Same bun:sqlite-as-'sqlite' cast the shared fixtures use (see the note
    // in createSQLiteAdapter) — runtime query surfaces are identical.
    return new DrizzleAdapter<typeof schema, 'sqlite'>({
      db: testDb as unknown as DrizzleDatabase<'sqlite'>,
      schema,
      driver: 'sqlite',
      autoDetectRelationships: true,
      relations: relationsSchema,
      options: { defaultPrimaryTable: 'users' },
      computedFields,
    });
  }

  /** The computed-field filter itself carries no SQL — filterSql supplies it. */
  const hasBioFilter = [
    { columnId: 'hasBio', type: 'text', operator: 'contains', values: ['x'] },
  ] as unknown as FilterState[];

  describe('filterSql', () => {
    it('plans the JOIN for a bare related-column reference (one-to-one)', async () => {
      const adapter = createAdapter({
        users: [
          {
            field: 'hasBio',
            compute: () => null,
            filterSql: () => sql`${schema.profiles.bio} is not null`,
          },
        ],
      });

      const result = await adapter.fetchData({
        columns: ['id', 'name'],
        filters: hasBioFilter,
      });

      // Users 1 and 2 have profiles with a bio; user 3 has no profile row.
      const names = (result.data as Array<{ name: string }>).map((row) => row.name).sort();
      expect(names).toEqual(['Jane Smith', 'John Doe']);
      // The count query must carry the same JOIN — data and total agree.
      expect(result.total).toBe(2);
    });

    it('counts distinct primary rows for a one-to-many reference', async () => {
      const adapter = createAdapter({
        users: [
          {
            field: 'hasPublishedPost',
            compute: () => null,
            filterSql: () => sql`${schema.posts.published} = 1`,
          },
        ],
      });

      const result = await adapter.fetchData({
        columns: ['id', 'name'],
        filters: [
          { columnId: 'hasPublishedPost', type: 'text', operator: 'contains', values: ['x'] },
        ] as unknown as FilterState[],
      });

      // Published posts belong to users 1 and 2. The posts JOIN fans out
      // (user 1 has two posts), so both total and the page must deduplicate.
      expect(result.total).toBe(2);
      expect(result.data).toHaveLength(2);
    });

    it('does not force-join a table the SQL scopes via a correlated subquery', async () => {
      const adapter = createAdapter({
        users: [
          {
            field: 'hasBio',
            compute: () => null,
            // `${schema.profiles}` appears as a Table chunk — the fragment
            // brings its own FROM scope, so no outer JOIN may be added.
            filterSql: () =>
              sql`exists (select 1 from ${schema.profiles} where ${schema.profiles.userId} = ${schema.users.id} and ${schema.profiles.bio} is not null)`,
          },
        ],
      });

      const result = await adapter.fetchData({
        columns: ['id', 'name'],
        filters: hasBioFilter,
      });

      expect(result.total).toBe(2);
      expect(result.data).toHaveLength(2);
    });

    it('does not double-join a relation that is already selected', async () => {
      const adapter = createAdapter({
        users: [
          {
            field: 'hasBio',
            compute: () => null,
            filterSql: () => sql`${schema.profiles.bio} is not null`,
          },
        ],
      });

      // `profile.bio` in columns already plans the profiles JOIN; the opaque
      // reference must reuse it. A second JOIN of the same unaliased table
      // would fail at prepare time.
      const result = await adapter.fetchData({
        columns: ['id', 'name', 'profile.bio'],
        filters: hasBioFilter,
      });

      expect(result.total).toBe(2);
      const first = result.data[0] as { profile?: { bio?: string } };
      expect(first.profile?.bio).toBeDefined();
    });

    it('fails fast with guidance when the referenced table has no relationship', async () => {
      const adapter = createAdapter({
        users: [
          {
            field: 'impossible',
            compute: () => null,
            // `surveys` is in the schema but has no relationship to `users`.
            filterSql: () => sql`${schema.surveys.status} = 'published'`,
          },
        ],
      });

      await expect(
        adapter.fetchData({
          columns: ['id', 'name'],
          filters: [
            { columnId: 'impossible', type: 'text', operator: 'contains', values: ['x'] },
          ] as unknown as FilterState[],
        })
      ).rejects.toThrow(/no direct relationship|correlated subquery/);
    });
  });

  describe('sortSql', () => {
    it('plans the JOIN for a related-column sort expression', async () => {
      const adapter = createAdapter({
        users: [
          {
            field: 'profileBio',
            compute: () => null,
            sortSql: () => sql`coalesce(${schema.profiles.bio}, '')`,
          },
        ],
      });

      const result = await adapter.fetchData({
        columns: ['id', 'name'],
        sorting: [{ columnId: 'profileBio', direction: 'asc' }],
      });

      // '' (Bob, no profile) < 'Designer' (Jane) < 'Software developer' (John)
      const ids = (result.data as Array<{ id: number }>).map((row) => row.id);
      expect(ids).toEqual([3, 2, 1]);
    });

    it('drops (with a warning) a sort on a computed field that has no sortSql', async () => {
      const adapter = createAdapter({
        users: [
          {
            field: 'displayOnly',
            compute: () => 'x',
            // no sortSql — nothing to ORDER BY in SQL
          },
        ],
      });

      const warnings: string[] = [];
      const originalWarn = console.warn;
      console.warn = (...args: unknown[]) => {
        warnings.push(String(args[0]));
      };
      try {
        // Used to throw from join planning: the sort columnId leaked into
        // resolveColumnPath as if it were a relational column path.
        const result = await adapter.fetchData({
          columns: ['id', 'name'],
          sorting: [{ columnId: 'displayOnly', direction: 'asc' }],
        });

        expect(result.total).toBe(3);
        expect(result.data).toHaveLength(3);
        expect(warnings.some((w) => w.includes('displayOnly') && w.includes('sortSql'))).toBe(true);
      } finally {
        console.warn = originalWarn;
      }
    });
  });

  describe('factory passthrough (drizzleAdapter / createDrizzleAdapter)', () => {
    it('drizzleAdapter forwards computedFields instead of silently dropping them', async () => {
      const adapter = drizzleAdapter(
        testDb as unknown as DrizzleDatabase<'sqlite'>,
        {
          schema,
          driver: 'sqlite',
          relations: relationsSchema,
          options: { defaultPrimaryTable: 'users' },
          computedFields: {
            users: [
              {
                field: 'hasBio',
                compute: () => null,
                filterSql: () => sql`${schema.profiles.bio} is not null`,
              },
            ],
          },
        } as never
      ) as unknown as DrizzleAdapter<typeof schema, 'sqlite'>;

      // Before the passthrough fix this threw
      // "Field 'hasBio' not found in primary table 'users'".
      const result = await adapter.fetchData({
        columns: ['id', 'name'],
        filters: hasBioFilter,
      });

      expect(result.total).toBe(2);
    });

    it('createDrizzleAdapter forwards computedFields', async () => {
      const adapter = createDrizzleAdapter<typeof schema, 'sqlite'>(testDb, {
        schema,
        driver: 'sqlite',
        relations: relationsSchema,
        options: { defaultPrimaryTable: 'users' },
        computedFields: {
          users: [
            {
              field: 'hasBio',
              compute: () => null,
              filterSql: () => sql`${schema.profiles.bio} is not null`,
            },
          ],
        },
      });

      const result = await adapter.fetchData({
        columns: ['id', 'name'],
        filters: hasBioFilter,
      });

      expect(result.total).toBe(2);
    });

    it('drizzleAdapter forwards hooks instead of silently dropping them', async () => {
      const seen: string[] = [];
      const adapter = drizzleAdapter(
        testDb as unknown as DrizzleDatabase<'sqlite'>,
        {
          schema,
          driver: 'sqlite',
          relations: relationsSchema,
          options: { defaultPrimaryTable: 'users' },
          hooks: {
            beforeBuildFilterCondition: (filter: FilterState) => {
              seen.push(filter.columnId);
              return filter;
            },
          },
        } as never
      ) as unknown as DrizzleAdapter<typeof schema, 'sqlite'>;

      await adapter.fetchData({
        columns: ['id', 'name'],
        filters: [
          { columnId: 'name', type: 'text', operator: 'contains', values: ['John'] },
        ] as unknown as FilterState[],
      });

      expect(seen).toContain('name');
    });
  });
});

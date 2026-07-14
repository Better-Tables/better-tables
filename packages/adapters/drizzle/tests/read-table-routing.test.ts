/**
 * Read-path primary-table routing tests for DrizzleAdapter (plan 030,
 * finding 9).
 *
 * Regression coverage for the bug where `fetchData({ pagination })` (and
 * the facet/join-count reads) on a multi-table schema silently returned the
 * FIRST table's rows -- typed and shaped like a totally different table --
 * with a single, easy-to-miss `console.warn`. This mirrors the
 * `resolveMutationTable` precedent (MIGRATION.md §7, `mutation-routing.test.ts`):
 * a multi-table schema with no disambiguating signal is a configuration
 * error for reads too, not a guess.
 */

import type { Database } from 'bun:sqlite';
import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { DrizzleAdapter } from '../src/drizzle-adapter';
import type { DrizzleAdapterConfig, DrizzleDatabase } from '../src/types';
import { SchemaError } from '../src/types';
import type { BunSQLiteDatabase } from './helpers/test-fixtures';
import { closeDatabase, createTestDatabase, setupTestDatabase } from './helpers/test-fixtures';
import { profiles, users } from './helpers/test-schema';

const multiTableSchema = { users, profiles };
const singleTableSchema = { users };

function buildAdapter(
  db: BunSQLiteDatabase,
  schema: typeof multiTableSchema,
  defaultPrimaryTable?: string
): DrizzleAdapter<typeof multiTableSchema, 'sqlite'> {
  const config: DrizzleAdapterConfig<typeof multiTableSchema, 'sqlite'> = {
    db: db as unknown as DrizzleDatabase<'sqlite'>,
    schema,
    driver: 'sqlite',
    autoDetectRelationships: false,
    ...(defaultPrimaryTable !== undefined ? { options: { defaultPrimaryTable } } : {}),
  };
  return new DrizzleAdapter(config);
}

function buildSingleTableAdapter(
  db: BunSQLiteDatabase
): DrizzleAdapter<typeof singleTableSchema, 'sqlite'> {
  const config: DrizzleAdapterConfig<typeof singleTableSchema, 'sqlite'> = {
    db: db as unknown as DrizzleDatabase<'sqlite'>,
    schema: singleTableSchema,
    driver: 'sqlite',
    autoDetectRelationships: false,
  };
  return new DrizzleAdapter(config);
}

describe('DrizzleAdapter - read table routing', () => {
  let db: BunSQLiteDatabase;
  let sqlite: Database;

  beforeEach(async () => {
    const created = createTestDatabase();
    db = created.db;
    sqlite = created.sqlite;
    await setupTestDatabase(db);
  });

  afterEach(() => {
    closeDatabase(sqlite);
  });

  describe('multi-table schema, no columns and no primaryTable configured', () => {
    it("fetchData rejects with a SchemaError naming the available tables (not the first table's rows)", async () => {
      const adapter = buildAdapter(db, multiTableSchema);
      await expect(adapter.fetchData({})).rejects.toThrow(SchemaError);
      await expect(adapter.fetchData({ pagination: { page: 1, limit: 10 } })).rejects.toThrow(
        /Multiple tables in schema/
      );
    });

    it('fetchData SchemaError lists the available tables', async () => {
      const adapter = buildAdapter(db, multiTableSchema);
      try {
        await adapter.fetchData({});
        throw new Error('expected fetchData to reject');
      } catch (error) {
        expect(error).toBeInstanceOf(SchemaError);
        const schemaError = error as SchemaError;
        expect(schemaError.details?.availableTables).toEqual(['users', 'profiles']);
      }
    });

    it('does not throw at construction time', () => {
      expect(() => buildAdapter(db, multiTableSchema)).not.toThrow();
    });
  });

  describe("multi-table schema with options.defaultPrimaryTable: 'profiles'", () => {
    it('fetchData with no columns/primaryTable routes to profiles, not the first schema table (users)', async () => {
      const adapter = buildAdapter(db, multiTableSchema, 'profiles');

      const result = await adapter.fetchData({});

      expect(result.data.length).toBeGreaterThan(0);
      for (const row of result.data) {
        // profiles rows have `bio`/`avatar`; users rows don't.
        expect(row as Record<string, unknown>).toHaveProperty('bio');
      }
    });
  });

  describe('multi-table schema, explicit per-call primaryTable', () => {
    it('fetchData with primaryTable: "profiles" does not throw, even with defaultPrimaryTable unset', async () => {
      const adapter = buildAdapter(db, multiTableSchema);

      const result = await adapter.fetchData({ primaryTable: 'profiles' });

      expect(result.data.length).toBeGreaterThan(0);
      for (const row of result.data) {
        expect(row as Record<string, unknown>).toHaveProperty('bio');
      }
    });

    it('a per-call primaryTable overrides options.defaultPrimaryTable', async () => {
      const adapter = buildAdapter(db, multiTableSchema, 'users');

      const result = await adapter.fetchData({ primaryTable: 'profiles' });

      for (const row of result.data) {
        expect(row as Record<string, unknown>).toHaveProperty('bio');
      }
    });
  });

  describe('multi-table schema, columns that disambiguate', () => {
    it('fetchData with columns matching only one table does not throw', async () => {
      const adapter = buildAdapter(db, multiTableSchema);

      const result = await adapter.fetchData({ columns: ['bio', 'avatar'] });

      expect(result.data.length).toBeGreaterThan(0);
      for (const row of result.data) {
        expect(row as Record<string, unknown>).toHaveProperty('bio');
      }
    });
  });

  describe('single-table schema, no config (back-compat)', () => {
    it('fetchData still works with no columns and no primaryTable', async () => {
      const adapter = buildSingleTableAdapter(db);

      const result = await adapter.fetchData({});

      expect(result.data.length).toBeGreaterThan(0);
      expect(result.data[0] as Record<string, unknown>).toHaveProperty('name');
    });

    it('getFacetedValues still works with no primaryTable configured', async () => {
      const adapter = buildSingleTableAdapter(db);
      const facets = await adapter.getFacetedValues('name');
      expect(facets.size).toBeGreaterThan(0);
    });
  });

  describe('facet and join-count reads on a multi-table schema', () => {
    it('getFacetedValues on a column that exists on exactly one table does not throw', async () => {
      const adapter = buildAdapter(db, multiTableSchema);
      const facets = await adapter.getFacetedValues('bio');
      expect(facets.size).toBeGreaterThan(0);
    });

    it('getMinMaxValues on a column that exists on exactly one table does not throw', async () => {
      const adapter = buildAdapter(db, multiTableSchema);
      const [min, max] = await adapter.getMinMaxValues('id');
      expect(typeof min).toBe('number');
      expect(typeof max).toBe('number');
    });
  });
});

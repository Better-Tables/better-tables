/**
 * Compile-checked (and, where cheap, executing) examples for `MIGRATION.md`
 * §7 and §12 (plans 019, 030) -- the Drizzle-specific guide sections that
 * need real adapter/driver types `@better-tables/core`'s own examples file
 * (`packages/core/tests/types/migration-guide-examples.test.ts`) doesn't
 * depend on.
 *
 * Runtime setup follows this package's established convention (see
 * `tests/mutation-routing.test.ts`, `tests/schema-types.test.ts`): tests
 * that need to actually EXECUTE against a database go through
 * `new DrizzleAdapter(config)` directly with the Bun-SQLite-to-BetterSQLite3
 * type cast (`tests/helpers/test-fixtures.ts`'s documented reason --
 * `better-sqlite3`'s native binding doesn't load under Bun's runtime in this
 * repo), rather than calling the public `drizzleAdapter(db, options)` factory
 * (which does real driver detection that would reject a `bun:sqlite`
 * instance). The guide's own example uses `drizzleAdapter(db, options)`
 * because that's the real public API end users call; the equivalence is
 * noted at each call site below.
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

// Equivalent to the guide's `drizzleAdapter(db)` / `drizzleAdapter(db, { options })`
// for a multi-table schema -- see the file-level docblock for why this test
// file constructs `DrizzleAdapter` directly instead of calling the factory.
function buildAdapter(
  db: BunSQLiteDatabase,
  defaultMutationTable?: string
): DrizzleAdapter<typeof multiTableSchema, 'sqlite'> {
  const config: DrizzleAdapterConfig<typeof multiTableSchema, 'sqlite'> = {
    db: db as unknown as DrizzleDatabase<'sqlite'>,
    schema: multiTableSchema,
    driver: 'sqlite',
    autoDetectRelationships: false,
    ...(defaultMutationTable !== undefined ? { options: { defaultMutationTable } } : {}),
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

describe('MIGRATION.md §7 — defaultMutationTable is required for multi-table mutations', () => {
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

  it('0.6: a multi-table schema with no defaultMutationTable throws a SchemaError naming the fix', async () => {
    // 0.6 - equivalent to `drizzleAdapter(db)` with schema: { users, profiles }
    const adapter = buildAdapter(db);

    await expect(
      adapter.updateRecord('1', { bio: 'new bio' }) // 0.6
    ).rejects.toThrow(SchemaError);
    await expect(adapter.updateRecord('1', { bio: 'new bio' })).rejects.toThrow(
      /defaultMutationTable/
    );
  });

  it('0.6: configuring defaultMutationTable lets mutations target the right table', async () => {
    // 0.6 - equivalent to `drizzleAdapter(db, { options: { defaultMutationTable: 'profiles' } })`
    const adapter = buildAdapter(db, 'profiles'); // 0.6

    // Seed a user + profile directly via the raw db (once defaultMutationTable
    // is configured, EVERY adapter mutation targets 'profiles' -- so seeding
    // the FK-parent 'users' row through the adapter isn't possible here;
    // that's the whole point of the fix).
    await db.insert(users).values({ id: 500, name: 'Ada', email: 'ada@example.com' });
    await db.insert(profiles).values({ id: 500, userId: 500, bio: 'old bio' });

    const updated = await adapter.updateRecord('500', { bio: 'new bio' }); // 0.6
    expect(updated).toBeDefined();

    const rows = await db.select().from(profiles).all();
    const row = rows.find((r) => r.id === 500);
    expect(row?.bio).toBe('new bio');
  });

  it('0.6: an unresolvable defaultMutationTable (not in schema) throws a SchemaError listing available tables', async () => {
    const adapter = buildAdapter(db, 'widgets'); // 0.6 - 'widgets' is not in the schema

    await expect(adapter.updateRecord('1', { bio: 'x' })).rejects.toThrow(SchemaError);
  });

  it('0.6: a single-table schema needs no defaultMutationTable configuration', async () => {
    const adapter = buildSingleTableAdapter(db); // 0.6 - no `options` needed

    const created = await adapter.createRecord({ id: 900, name: 'Solo', email: 's@example.com' });
    expect(created).toBeDefined();
  });

  it('0.5: multi-table mutations used to silently target the first schema key instead of throwing', async () => {
    // There is no compile-time signal for this one (the 0.5 behavior was a
    // runtime footgun, not a type). Pinning the CURRENT (0.6) behavior here
    // is the guide's drift alarm: if this ever stops throwing and instead
    // silently succeeds against the wrong table, that's the exact regression
    // fix-mutation-table-routing.md fixed.
    const adapter = buildAdapter(db); // no defaultMutationTable configured
    await expect(adapter.updateRecord('1', { bio: 'x' })).rejects.toThrow(SchemaError);
  });
});

describe('MIGRATION.md §12 (Drizzle portion) — multi-table read throw + defaultPrimaryTable', () => {
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

  function buildReadAdapter(
    defaultPrimaryTable?: string
  ): DrizzleAdapter<typeof multiTableSchema, 'sqlite'> {
    const config: DrizzleAdapterConfig<typeof multiTableSchema, 'sqlite'> = {
      db: db as unknown as DrizzleDatabase<'sqlite'>,
      schema: multiTableSchema,
      driver: 'sqlite',
      autoDetectRelationships: false,
      ...(defaultPrimaryTable !== undefined ? { options: { defaultPrimaryTable } } : {}),
    };
    return new DrizzleAdapter(config);
  }

  it('0.6: a multi-table schema with no columns/primaryTable throws a SchemaError naming the fix', async () => {
    // 0.6 - equivalent to `drizzleAdapter(db).fetchData({ pagination: ... })`
    const adapter = buildReadAdapter();

    await expect(
      adapter.fetchData({ pagination: { page: 1, limit: 10 } }) // 0.6
    ).rejects.toThrow(SchemaError);
    await expect(adapter.fetchData({ pagination: { page: 1, limit: 10 } })).rejects.toThrow(
      /'primaryTable'.*'defaultPrimaryTable'/
    );
  });

  it('0.6: configuring defaultPrimaryTable lets reads with no columns/primaryTable target the right table', async () => {
    // 0.6 - equivalent to `drizzleAdapter(db, { options: { defaultPrimaryTable: 'profiles' } })`
    const adapter = buildReadAdapter('profiles'); // 0.6

    const result = await adapter.fetchData({ pagination: { page: 1, limit: 10 } }); // 0.6

    expect(result.data.length).toBeGreaterThan(0);
    for (const row of result.data as unknown as Record<string, unknown>[]) {
      expect(row).toHaveProperty('bio'); // profiles-only field -- confirms the right table
    }
  });

  it('0.6: an explicit per-call primaryTable never throws, with or without defaultPrimaryTable', async () => {
    const adapter = buildReadAdapter(); // no defaultPrimaryTable configured

    const result = await adapter.fetchData({ primaryTable: 'profiles' }); // 0.6
    expect(result.data.length).toBeGreaterThan(0);
  });

  it('0.6: a single-table schema needs no defaultPrimaryTable configuration', async () => {
    const singleTableConfig: DrizzleAdapterConfig<typeof singleTableSchema, 'sqlite'> = {
      db: db as unknown as DrizzleDatabase<'sqlite'>,
      schema: singleTableSchema,
      driver: 'sqlite',
      autoDetectRelationships: false,
    };
    const adapter = new DrizzleAdapter(singleTableConfig); // 0.6 - no `options` needed

    const result = await adapter.fetchData({}); // 0.6
    expect(result.data.length).toBeGreaterThan(0);
  });

  it('0.5: multi-table reads used to silently target the first schema table instead of throwing', async () => {
    // There is no compile-time signal for this one (the 0.5 behavior was a
    // runtime footgun, not a type). Pinning the CURRENT (0.6) behavior here
    // is the guide's drift alarm -- same reasoning as §7's mutation-routing
    // pin above, applied to reads (plan 030 finding 9).
    const adapter = buildReadAdapter(); // no defaultPrimaryTable configured
    await expect(adapter.fetchData({ pagination: { page: 1, limit: 10 } })).rejects.toThrow(
      SchemaError
    );
  });
});

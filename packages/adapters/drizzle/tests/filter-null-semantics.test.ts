/**
 * @fileoverview Row-set pin tests for null-filter semantics (plan 027, CORE-10, Option A)
 *
 * @description
 * Exercises the full adapter pipeline (`DrizzleAdapter.fetchData` ->
 * `FilterHandler.handleCrossTableFilters` -> `FilterRouter` ->
 * `DrizzlePredicateEmitter`) against a real SQLite database seeded with
 * NULL rows, pinning that a null-only filter (`includeNull: true` with
 * empty `values`) returns exactly the NULL rows, and that combining
 * `includeNull` with real values returns the union - not a dropped leaf
 * (see `packages/adapters/drizzle/src/filter-handler.ts`'s
 * `buildLeafCondition`, which pre-validates values before ever reaching the
 * router and must treat null-only intent as satisfying that requirement).
 */

import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import type { FilterState } from '@better-tables/core';
import type { UserWithRelations } from './helpers';
import { closeDatabase, createTestAdapter, createTestDatabase } from './helpers/test-fixtures';

describe('Null-filter semantics (CORE-10, Option A) - SQLite row-set', () => {
  let adapter: ReturnType<typeof createTestAdapter>;
  let testDb: ReturnType<typeof createTestDatabase>['db'];
  let sqlite: ReturnType<typeof createTestDatabase>['sqlite'];

  beforeEach(async () => {
    const { db, sqlite: sqliteDb } = createTestDatabase();
    testDb = db;
    sqlite = sqliteDb;

    // Deliberately not `setupTestDatabase` - this suite needs full control
    // over which rows have a NULL `age` to pin null-only/union behavior.
    await testDb.run(`
      CREATE TABLE users (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT NOT NULL,
        age INTEGER,
        created_at INTEGER
      );
    `);
    await testDb.run(`
      INSERT INTO users (id, name, email, age, created_at) VALUES
        (1, 'Alice', 'alice@example.com', 20, 0),
        (2, 'Bob', 'bob@example.com', 40, 0),
        (3, 'Carol', 'carol@example.com', NULL, 0),
        (4, 'Dave', 'dave@example.com', NULL, 0);
    `);

    adapter = createTestAdapter(testDb);
  });

  afterEach(() => {
    closeDatabase(sqlite);
  });

  function ageFilter(overrides: Partial<FilterState>): FilterState {
    return {
      columnId: 'age',
      type: 'number',
      operator: 'greaterThan',
      values: [],
      ...overrides,
    } as FilterState;
  }

  const names = (rows: unknown[]) => (rows as UserWithRelations[]).map((r) => r.name).sort();

  it('null-only filter (includeNull + empty values) returns exactly the NULL rows', async () => {
    const result = await adapter.fetchData({
      primaryTable: 'users',
      filters: [ageFilter({ values: [], includeNull: true })],
    });

    expect(names(result.data)).toEqual(['Carol', 'Dave']);
  });

  it('includeNull + real values returns the union of matches and NULL rows', async () => {
    const result = await adapter.fetchData({
      primaryTable: 'users',
      filters: [ageFilter({ values: [30], includeNull: true })],
    });

    // age > 30 -> Bob (40); plus the NULL rows -> Carol, Dave
    expect(names(result.data)).toEqual(['Bob', 'Carol', 'Dave']);
  });

  it('without includeNull, the same filter excludes NULL rows', async () => {
    const result = await adapter.fetchData({
      primaryTable: 'users',
      filters: [ageFilter({ values: [30], includeNull: false })],
    });

    expect(names(result.data)).toEqual(['Bob']);
  });

  it('empty values without includeNull is treated as no filter (unchanged UI-partial-state behavior)', async () => {
    const result = await adapter.fetchData({
      primaryTable: 'users',
      filters: [ageFilter({ values: [] })],
    });

    expect(names(result.data)).toEqual(['Alice', 'Bob', 'Carol', 'Dave']);
  });

  it('null-only intent holds for a different fixed-count(1) operator too (lessThan)', async () => {
    const result = await adapter.fetchData({
      primaryTable: 'users',
      filters: [ageFilter({ operator: 'lessThan', values: [], includeNull: true })],
    });

    expect(names(result.data)).toEqual(['Carol', 'Dave']);
  });
});

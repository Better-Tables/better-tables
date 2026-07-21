/**
 * @fileoverview `onInvalidFilter: 'skip' | 'throw'` behavior.
 *
 * A filter leaf that cannot be translated to a WHERE condition (an operator
 * invalid for the type, or a supported operator with missing/incomplete values)
 * is DROPPED by default, which widens the result set under implicit-AND — a
 * scoping filter that silently disappears reads as "no restriction". The
 * `onInvalidFilter: 'throw'` option makes such a leaf raise a `QueryError`
 * instead, for callers whose filters are built programmatically and must all
 * apply.
 *
 * Two layers are covered:
 * - FilterHandler unit tests (skip vs throw, both malformed branches)
 * - end-to-end through `adapter.fetchData` (flat filters and a group tree),
 *   proving the throw propagates the whole way up.
 */

import { afterEach, beforeEach, describe, expect, it, spyOn } from 'bun:test';
import type { FilterGroupNode, FilterOperator, FilterState } from '@better-tables/core';
import { pgTable, text, uuid } from 'drizzle-orm/pg-core';
import { DrizzleAdapter as DrizzleAdapterClass } from '../src/drizzle-adapter';
import { FilterHandler } from '../src/filter-handler';
import { RelationshipManager } from '../src/relationship-manager';
import type { DrizzleAdapterConfig, DrizzleDatabase, InvalidFilterBehavior } from '../src/types';
import { QueryError } from '../src/types';
import {
  type BunSQLiteDatabase,
  closeSQLiteDatabase,
  createTestDatabase,
  setupTestDatabase,
} from './helpers/test-fixtures';
import { relationsSchema, schema as testSchema } from './helpers/test-schema';

// ---------------------------------------------------------------------------
// FilterHandler unit tests (no DB)
// ---------------------------------------------------------------------------

const users = pgTable('users', {
  id: uuid('id').primaryKey(),
  name: text('name'),
  role: text('role'),
});
const unitSchema = { users };

function makeHandler(onInvalidFilter?: InvalidFilterBehavior): FilterHandler {
  return new FilterHandler(
    unitSchema,
    new RelationshipManager(unitSchema, {}),
    'postgres',
    undefined,
    onInvalidFilter
  );
}

// `is` belongs to OPTION_OPERATORS, so it is invalid for a `text` column.
const invalidOperatorLeaf = [
  { columnId: 'role', type: 'text', operator: 'is' as FilterOperator, values: ['admin'] },
] as unknown as FilterState[];

// `contains` is valid for text, but the values are incomplete.
const incompleteValuesLeaf: FilterState[] = [
  { columnId: 'name', type: 'text', operator: 'contains', values: [] },
];

describe('onInvalidFilter — FilterHandler', () => {
  describe("default ('skip')", () => {
    it('drops an operator invalid for the type (with a warning) and does not throw', () => {
      const handler = makeHandler();
      const spy = spyOn(console, 'warn').mockImplementation(() => {});
      try {
        const { conditions } = handler.handleCrossTableFilters(invalidOperatorLeaf, 'users');
        expect(conditions).toHaveLength(0);
        expect(spy.mock.calls.length).toBe(1);
      } finally {
        spy.mockRestore();
      }
    });

    it('drops incomplete values silently and does not throw', () => {
      const handler = makeHandler();
      const spy = spyOn(console, 'warn').mockImplementation(() => {});
      try {
        const { conditions } = handler.handleCrossTableFilters(incompleteValuesLeaf, 'users');
        expect(conditions).toHaveLength(0);
        expect(spy.mock.calls.length).toBe(0);
      } finally {
        spy.mockRestore();
      }
    });

    it("is the behavior when the option is passed explicitly as 'skip'", () => {
      const handler = makeHandler('skip');
      const spy = spyOn(console, 'warn').mockImplementation(() => {});
      try {
        expect(() => handler.handleCrossTableFilters(invalidOperatorLeaf, 'users')).not.toThrow();
      } finally {
        spy.mockRestore();
      }
    });
  });

  describe("'throw'", () => {
    it('throws a QueryError for an operator invalid for the type', () => {
      const handler = makeHandler('throw');
      expect(() => handler.handleCrossTableFilters(invalidOperatorLeaf, 'users')).toThrow(
        QueryError
      );
    });

    it('throws a QueryError for incomplete values on a supported operator', () => {
      const handler = makeHandler('throw');
      expect(() => handler.handleCrossTableFilters(incompleteValuesLeaf, 'users')).toThrow(
        QueryError
      );
    });

    it('names the column and mentions onInvalidFilter, without leaking values', () => {
      const handler = makeHandler('throw');
      const secret = 'super-secret-value';
      try {
        handler.handleCrossTableFilters(
          [
            { columnId: 'role', type: 'text', operator: 'is' as FilterOperator, values: [secret] },
          ] as unknown as FilterState[],
          'users'
        );
        throw new Error('expected handleCrossTableFilters to throw');
      } catch (error) {
        expect(error).toBeInstanceOf(QueryError);
        const message = (error as QueryError).message;
        expect(message).toContain('role');
        expect(message).toContain('onInvalidFilter');
        expect(message).not.toContain(secret);
      }
    });

    it('does NOT throw for a valid, complete filter', () => {
      const handler = makeHandler('throw');
      const { conditions } = handler.handleCrossTableFilters(
        [{ columnId: 'name', type: 'text', operator: 'contains', values: ['ada'] }],
        'users'
      );
      expect(conditions).toHaveLength(1);
    });

    it('does NOT throw for the match-null intent (includeNull + empty values)', () => {
      const handler = makeHandler('throw');
      // A real "match null rows only" request, not a drop — must be unaffected.
      const nullOnly: FilterState[] = [
        { columnId: 'name', type: 'text', operator: 'contains', values: [], includeNull: true },
      ];
      expect(() => handler.handleCrossTableFilters(nullOnly, 'users')).not.toThrow();
    });
  });
});

// ---------------------------------------------------------------------------
// End-to-end through adapter.fetchData (SQLite)
// ---------------------------------------------------------------------------

function makeAdapter(onInvalidFilter?: InvalidFilterBehavior, db?: BunSQLiteDatabase) {
  const config: DrizzleAdapterConfig<typeof testSchema, 'sqlite'> = {
    db: (db as unknown as DrizzleDatabase<'sqlite'>) ?? undefined,
    schema: testSchema,
    driver: 'sqlite',
    autoDetectRelationships: true,
    relations: relationsSchema,
    options: onInvalidFilter
      ? { defaultPrimaryTable: 'users', onInvalidFilter }
      : { defaultPrimaryTable: 'users' },
  } as DrizzleAdapterConfig<typeof testSchema, 'sqlite'>;
  return new DrizzleAdapterClass(config);
}

// `is` is not a valid text operator — a malformed leaf that widens results.
const malformedFilter = [
  { columnId: 'name', type: 'text', operator: 'is' as FilterOperator, values: ['John Doe'] },
] as unknown as FilterState[];

describe('onInvalidFilter — adapter.fetchData', () => {
  let db: BunSQLiteDatabase;
  let sqlite: ReturnType<typeof createTestDatabase>['sqlite'];

  beforeEach(async () => {
    const created = createTestDatabase();
    db = created.db;
    sqlite = created.sqlite;
    await setupTestDatabase(db);
  });

  afterEach(() => {
    closeSQLiteDatabase(sqlite);
  });

  it('default drops the malformed filter and returns the full set (fail-open baseline)', async () => {
    const adapter = makeAdapter(undefined, db);
    const spy = spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const result = await adapter.fetchData({ filters: malformedFilter });
      // 3 seeded users; the malformed filter was dropped, so all come back.
      expect(result.total).toBe(3);
    } finally {
      spy.mockRestore();
    }
  });

  it("'throw' rejects the whole fetch for a malformed flat filter", async () => {
    const adapter = makeAdapter('throw', db);
    await expect(adapter.fetchData({ filters: malformedFilter })).rejects.toThrow();
  });

  it("'throw' rejects for a malformed leaf nested inside a filter group", async () => {
    const adapter = makeAdapter('throw', db);
    const group: FilterGroupNode = {
      kind: 'group',
      logic: 'or',
      children: [
        { columnId: 'name', type: 'text', operator: 'is' as FilterOperator, values: ['x'] },
        { columnId: 'email', type: 'text', operator: 'contains', values: ['example'] },
      ],
    } as unknown as FilterGroupNode;
    await expect(adapter.fetchData({ filters: group })).rejects.toThrow();
  });

  it("'throw' still resolves normally for valid filters", async () => {
    const adapter = makeAdapter('throw', db);
    // 'Doe' matches only 'John Doe' ('John' would also match 'Bob Johnson').
    const result = await adapter.fetchData({
      filters: [{ columnId: 'name', type: 'text', operator: 'contains', values: ['Doe'] }],
    });
    expect(result.total).toBe(1);
  });
});

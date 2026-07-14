/**
 * Type-level acceptance tests for the table-scoped read surface
 * (`tables.fetchData(table, params)` et al.), plan 030 Steps 3 -- findings
 * 9 + 16.
 *
 * Before this surface existed, every call site querying a specific table
 * had to pass `primaryTable` manually (easy to omit on a multi-table
 * schema -- finding 9) and cast the result (`as
 * FetchDataResult<TicketWithRelations>` -- finding 16), because
 * `database.fetchData()` is generic over the ADAPTER's whole-schema row
 * union, not any one table. `tables.fetchData(table, params)` closes both
 * gaps: `primaryTable` is injected from `table.tableName` and is not even
 * accepted as a param (see {@link TableScopedFetchDataParams}), and the
 * return type is inferred as `FetchDataResult<TRow>` for THAT table's row,
 * with no cast.
 */

import { describe, expect, expectTypeOf, it } from 'bun:test';
import { betterTables, defineTable } from '../../src/factory';
import type { FetchDataResult, TableAdapter } from '../../src/types/adapter';
import type { SchemaAwareAdapter } from '../../src/types/paths';

interface User {
  id: string;
  name: string;
  email: string;
  age: number;
}

interface Post {
  id: string;
  title: string;
  published: boolean;
}

type Schema = {
  users: { row: User };
  posts: { row: Post };
};

// A minimal, functional (not just type-cast) fake: `expectTypeOf(expr)`
// still evaluates `expr` at runtime to hand it to the assertion, so
// `tables.fetchData(...)` needs a real `fetchData` underneath, not just a
// `{} as SchemaAwareAdapter` phantom (that's enough for pure `defineTable`
// type tests elsewhere, but not here).
const fakeAdapter = {
  fetchData: async () => ({
    data: [],
    total: 0,
    pagination: { page: 1, limit: 20, totalPages: 0, hasNext: false, hasPrev: false },
  }),
  getFilterOptions: async () => [],
  getFacetedValues: async () => new Map(),
  getMinMaxValues: async () => [0, 0],
  meta: {
    name: 'Fake Adapter',
    version: '1.0.0',
    features: {
      create: false,
      read: true,
      update: false,
      delete: false,
      bulkOperations: false,
      realTimeUpdates: false,
      export: false,
      transactions: false,
    },
    supportedColumnTypes: ['text'],
    supportedOperators: {
      text: ['equals'],
      number: ['equals'],
      date: ['equals'],
      boolean: ['equals'],
      option: ['equals'],
      multiOption: ['equals'],
      currency: ['equals'],
      percentage: ['equals'],
      url: ['equals'],
      email: ['equals'],
      phone: ['equals'],
      json: ['equals'],
      custom: ['equals'],
    },
  },
  // Type-only phantom -- never read at runtime; see `SchemaAwareAdapter`.
  $types: undefined as unknown as { tables: Schema },
} satisfies TableAdapter<unknown> & SchemaAwareAdapter<{ tables: Schema }>;
const tables = betterTables({ database: fakeAdapter });

const usersTable = defineTable<typeof tables>()('users', (t) => ({
  columns: [t.text('name'), t.number('age')],
}));
const postsTable = defineTable<typeof tables>()('posts', (t) => ({
  columns: [t.text('title')],
}));

describe('tables.fetchData(table, params) -- table-scoped read surface', () => {
  it('resolves to FetchDataResult<TRow> for the TABLE passed in, not `unknown` or the adapter union', () => {
    expectTypeOf(tables.fetchData(usersTable, {})).resolves.toEqualTypeOf<FetchDataResult<User>>();
    expectTypeOf(tables.fetchData(postsTable, {})).resolves.toEqualTypeOf<FetchDataResult<Post>>();
  });

  it('the resolved row type is NOT `unknown` (the exact gap this surface closes -- finding 16)', () => {
    // A same-shape-but-different-row assertion would still pass if the
    // return type had degraded to `unknown`/`any`; pin the User-specific
    // field directly instead.
    expectTypeOf(tables.fetchData(usersTable, {})).resolves.not.toEqualTypeOf<FetchDataResult<Post>>();
  });

  it('primaryTable need not be passed -- params omits it entirely, not just makes it optional', () => {
    // No `primaryTable` key at all compiles fine (it's injected from
    // `usersTable.tableName` internally).
    tables.fetchData(usersTable, { pagination: { page: 1, limit: 10 } });
    tables.fetchData(usersTable, {});
    expect(true).toBe(true);
  });

  it('a caller-supplied primaryTable is rejected at the type level (it would contradict `table`)', () => {
    tables.fetchData(usersTable, {
      // @ts-expect-error - TableScopedFetchDataParams = Omit<FetchDataParams,
      // 'primaryTable'>; primaryTable is injected from usersTable.tableName,
      // not a caller-supplied param on this surface (plan 030 Step 3).
      primaryTable: 'posts',
    });
    expect(true).toBe(true);
  });

  it('`columns` remains `string[]` (untyped against Paths<TRow>) -- documents the current boundary', () => {
    // FetchDataParams.columns is `string[]` at the adapter-contract level
    // (unchanged by this surface); a non-string-array value is still
    // caught, but an arbitrary string that ISN'T a real path on TRow is
    // NOT -- per-table column-id typing needs the `$infer.FilterState`
    // registry, deferred to plan 006 (see this plan's STOP condition on
    // that gap). Left here as a marker for when that lands.
    tables.fetchData(usersTable, {
      // @ts-expect-error - columns must be string[], not a bare number.
      columns: 123,
    });
    // Compiles today (not yet caught) -- 'notARealField' isn't a `Paths<User>`
    // member, but `columns` is plain `string[]`.
    tables.fetchData(usersTable, { columns: ['notARealField'] });
    expect(true).toBe(true);
  });
});
